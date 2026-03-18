/**
 * One-time backfill script: fetch attendance from all historical boxscores
 * in scores.json and populate game-attendance.json.
 *
 * Usage: node scripts/backfill-attendance.js
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const BOXSCORE_BASE =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

const TEAMS = {
  74:  { id: 74,  city: "Adirondack" },     66:  { id: 66,  city: "Allen" },
  10:  { id: 10,  city: "Atlanta" },         107: { id: 107, city: "Bloomington" },
  5:   { id: 5,   city: "Cincinnati" },      8:   { id: 8,   city: "Florida" },
  60:  { id: 60,  city: "Fort Wayne" },      108: { id: 108, city: "Greensboro" },
  52:  { id: 52,  city: "Greenville" },      11:  { id: 11,  city: "Idaho" },
  65:  { id: 65,  city: "Indy" },            98:  { id: 98,  city: "Iowa" },
  79:  { id: 79,  city: "Jacksonville" },    53:  { id: 53,  city: "Kalamazoo" },
  56:  { id: 56,  city: "Kansas City" },     101: { id: 101, city: "Maine" },
  63:  { id: 63,  city: "Norfolk" },         13:  { id: 13,  city: "Orlando" },
  85:  { id: 85,  city: "Rapid City" },      55:  { id: 55,  city: "Reading" },
  97:  { id: 97,  city: "Savannah" },        50:  { id: 50,  city: "South Carolina" },
  109: { id: 109, city: "Tahoe" },           70:  { id: 70,  city: "Toledo" },
  103: { id: 103, city: "Trois-Rivières" },  72:  { id: 72,  city: "Tulsa" },
  106: { id: 106, city: "Utah" },            61:  { id: 61,  city: "Wheeling" },
  96:  { id: 96,  city: "Wichita" },         104: { id: 104, city: "Worcester" },
};

function findTeamByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return Object.values(TEAMS).find(
    (t) => lower.includes(t.city.toLowerCase())
  ) || null;
}

function nt(s) { return (s || "").replace(/\s+/g, " ").trim(); }

function directRows($, table) {
  return $(table).children("tbody").length
    ? $(table).children("tbody").children("tr")
    : $(table).children("tr");
}

async function fetchAttendance(gameId) {
  const res = await fetch(`${BOXSCORE_BASE}${gameId}`);
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  // Teams + score from SCORING table
  let scoringTable = null;
  $("table.tSides").each((_, t) => {
    const firstCell = nt(directRows($, t).first().find("td").first().text());
    if (firstCell.toUpperCase().includes("SCORING")) { scoringTable = t; return false; }
  });
  const sRow1 = scoringTable ? directRows($, scoringTable).eq(1).find("td").map((_, td) => nt($(td).text())).get() : [];
  const sRow2 = scoringTable ? directRows($, scoringTable).eq(2).find("td").map((_, td) => nt($(td).text())).get() : [];
  const visitingTeam = sRow1[0] || "";
  const homeTeam = sRow2[0] || "";
  const visitingScore = parseInt(sRow1[sRow1.length - 1]) || 0;
  const homeScore = parseInt(sRow2[sRow2.length - 1]) || 0;

  // Arena + date
  let arena = "", date = "";
  const headerCellHtml = $("table").first().children("tbody").children("tr").first()
    .children("td").eq(1).html() || "";
  const headerLines = headerCellHtml.split(/<br\s*\/?>/i)
    .map((l) => nt(cheerio.load(l).text())).filter(Boolean);
  for (const line of headerLines) {
    if (/^[A-Z][a-z]{2}\s+\d/.test(line)) date = line;
    else if (line && !line.match(/^ECHL Game/i) && !line.match(/\d+\s+at\s+/)) arena = line;
  }

  // Attendance
  let attendance = 0;
  $("table").each((_, t) => {
    const firstCell = nt(directRows($, t).first().find("td").first().text());
    if (firstCell !== "Game Start:") return;
    directRows($, t).each((_, row) => {
      const cells = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (cells[0] === "Attendance:") attendance = parseInt(cells[1]) || 0;
    });
    return false;
  });

  if (!attendance || !homeTeam) return null;

  const homeConfig = findTeamByName(homeTeam);
  return {
    gameId,
    homeTeam,
    homeTeamId: homeConfig?.id || null,
    visitingTeam,
    date,
    arena,
    attendance,
    score: `${visitingScore}-${homeScore}`,
  };
}

async function main() {
  // Load scores.json to get all game IDs
  const scores = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "scores.json"), "utf8"));
  const gameIds = scores.scores
    .filter((s) => s.gameId)
    .map((s) => s.gameId);
  console.log(`Found ${gameIds.length} games with IDs in scores.json`);

  // Load existing game-attendance.json
  const gameAttPath = path.join(DATA_DIR, "game-attendance.json");
  let gameAttData;
  try { gameAttData = JSON.parse(fs.readFileSync(gameAttPath, "utf8")); }
  catch (_) { gameAttData = { games: [] }; }
  const existingIds = new Set(gameAttData.games.map((g) => g.gameId));
  console.log(`Already have ${existingIds.size} games in game-attendance.json`);

  const toFetch = gameIds.filter((id) => !existingIds.has(id));
  console.log(`Need to fetch ${toFetch.length} games\n`);

  let added = 0;
  let failed = 0;
  for (let i = 0; i < toFetch.length; i++) {
    const gameId = toFetch[i];
    try {
      const result = await fetchAttendance(gameId);
      if (result) {
        gameAttData.games.push(result);
        added++;
        process.stdout.write(`\r  ${i + 1}/${toFetch.length} — ${added} added, ${failed} failed`);
      } else {
        failed++;
        process.stdout.write(`\r  ${i + 1}/${toFetch.length} — ${added} added, ${failed} failed`);
      }
    } catch (err) {
      failed++;
      process.stdout.write(`\r  ${i + 1}/${toFetch.length} — ${added} added, ${failed} failed`);
    }
    // Small delay to be nice to the server
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n\nDone. Added ${added} games, ${failed} failed.`);

  // Sort by attendance desc and save
  gameAttData.games.sort((a, b) => b.attendance - a.attendance);
  gameAttData.scrapedAt = new Date().toISOString();
  fs.writeFileSync(gameAttPath, JSON.stringify(gameAttData, null, 2));
  console.log(`Saved ${gameAttData.games.length} total games to game-attendance.json`);
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
