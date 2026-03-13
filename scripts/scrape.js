#!/usr/bin/env node
/**
 * ECHL data scraper — run by GitHub Actions on a schedule.
 * Writes JSON files to /data/ for the static frontend to consume.
 *
 * Usage: node scripts/scrape.js
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BOXSCORES_DIR = path.join(DATA_DIR, "boxscores");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BOXSCORES_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

const DAILY_REPORT_URL =
  "https://cluster.leaguestat.com/download.php?client_code=echl&file_path=daily-report/daily-report.html";

const BOXSCORE_BASE =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

// ─── Team config (inlined from server/src/config/teamConfig.js) ───────────────

const TEAMS = {
  74:  { id: 74,  name: "Adirondack Thunder",       city: "Adirondack",    abbr: "ADK", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  66:  { id: 66,  name: "Allen Americans",           city: "Allen",         abbr: "ALN", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#BF0D3E" },
  10:  { id: 10,  name: "Atlanta Gladiators",        city: "Atlanta",       abbr: "ATL", division: "South",    conference: "Eastern", primaryColor: "#C8102E", secondaryColor: "#000000" },
  107: { id: 107, name: "Bloomington Bison",         city: "Bloomington",   abbr: "BLM", division: "Central",  conference: "Western", primaryColor: "#003087", secondaryColor: "#7A7C80" },
  5:   { id: 5,   name: "Cincinnati Cyclones",       city: "Cincinnati",    abbr: "CIN", division: "Central",  conference: "Western", primaryColor: "#003DA5", secondaryColor: "#FC4C02" },
  8:   { id: 8,   name: "Florida Everblades",        city: "Florida",       abbr: "FLA", division: "South",    conference: "Eastern", primaryColor: "#00703C", secondaryColor: "#C8A951" },
  60:  { id: 60,  name: "Fort Wayne Komets",         city: "Fort Wayne",    abbr: "FW",  division: "Central",  conference: "Western", primaryColor: "#F47920", secondaryColor: "#231F20" },
  108: { id: 108, name: "Greensboro Gargoyles",      city: "Greensboro",    abbr: "GRN", division: "South",    conference: "Eastern", primaryColor: "#005EB8", secondaryColor: "#9B2335" },
  52:  { id: 52,  name: "Greenville Swamp Rabbits",  city: "Greenville",    abbr: "GVL", division: "South",    conference: "Eastern", primaryColor: "#00563F", secondaryColor: "#A2AAAD" },
  11:  { id: 11,  name: "Idaho Steelheads",          city: "Idaho",         abbr: "IDH", division: "Mountain", conference: "Western", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  65:  { id: 65,  name: "Indy Fuel",                 city: "Indy",          abbr: "IND", division: "Central",  conference: "Western", primaryColor: "#002868", secondaryColor: "#BF0D3E" },
  98:  { id: 98,  name: "Iowa Heartlanders",         city: "Iowa",          abbr: "IA",  division: "Central",  conference: "Western", primaryColor: "#00843D", secondaryColor: "#FFCD00" },
  79:  { id: 79,  name: "Jacksonville Icemen",       city: "Jacksonville",  abbr: "JAX", division: "South",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#A2AAAD" },
  53:  { id: 53,  name: "Kalamazoo Wings",           city: "Kalamazoo",     abbr: "KAL", division: "Central",  conference: "Western", primaryColor: "#E03A3E", secondaryColor: "#231F20" },
  56:  { id: 56,  name: "Kansas City Mavericks",     city: "Kansas City",   abbr: "KC",  division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#00843D" },
  101: { id: 101, name: "Maine Mariners",            city: "Maine",         abbr: "MNE", division: "North",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#C8102E" },
  63:  { id: 63,  name: "Norfolk Admirals",          city: "Norfolk",       abbr: "NOR", division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  13:  { id: 13,  name: "Orlando Solar Bears",       city: "Orlando",       abbr: "ORL", division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#A67C52" },
  85:  { id: 85,  name: "Rapid City Rush",           city: "Rapid City",    abbr: "RC",  division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#C8102E" },
  55:  { id: 55,  name: "Reading Royals",            city: "Reading",       abbr: "REA", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  97:  { id: 97,  name: "Savannah Ghost Pirates",    city: "Savannah",      abbr: "SAV", division: "South",    conference: "Eastern", primaryColor: "#006341", secondaryColor: "#A2AAAD" },
  50:  { id: 50,  name: "South Carolina Stingrays",  city: "South Carolina",abbr: "SC",  division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  109: { id: 109, name: "Tahoe Knight Monsters",     city: "Tahoe",         abbr: "TAH", division: "Mountain", conference: "Western", primaryColor: "#B9975B", secondaryColor: "#231F20" },
  70:  { id: 70,  name: "Toledo Walleye",            city: "Toledo",        abbr: "TOL", division: "Central",  conference: "Western", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  103: { id: 103, name: "Trois-Rivières Lions",      city: "Trois-Rivières",abbr: "TR",  division: "North",    conference: "Eastern", primaryColor: "#FFD700", secondaryColor: "#231F20" },
  72:  { id: 72,  name: "Tulsa Oilers",              city: "Tulsa",         abbr: "TUL", division: "Mountain", conference: "Western", primaryColor: "#003DA5", secondaryColor: "#FF8200" },
  106: { id: 106, name: "Utah Grizzlies",            city: "Utah",          abbr: "UTA", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#A2AAAD" },
  61:  { id: 61,  name: "Wheeling Nailers",          city: "Wheeling",      abbr: "WHL", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  96:  { id: 96,  name: "Wichita Thunder",           city: "Wichita",       abbr: "WIC", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#C8102E" },
  104: { id: 104, name: "Worcester Railers",         city: "Worcester",     abbr: "WOR", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
};

function findTeamByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return Object.values(TEAMS).find(
    (t) =>
      t.name.toLowerCase() === lower ||
      lower.includes(t.city.toLowerCase()) ||
      t.name.toLowerCase().includes(lower)
  ) || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(str) {
  const v = parseFloat(String(str || "").replace(/[^0-9.\-]/g, ""));
  return isNaN(v) ? 0 : v;
}

function cleanTeamName(raw) {
  return raw.replace(/^\d+\.\s*/, "").replace(/^[a-zA-Z\*]\s+/, "").trim();
}

function cleanName(raw) {
  return (raw || "").trim().replace(/^[\*xyz]\s+/, "").replace(/\s+/g, " ").trim();
}

function writeJSON(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  // Only write if contents changed
  try {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing === json) return false; // no change
  } catch (_) {}
  fs.writeFileSync(filePath, json, "utf8");
  return true;
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ─── Standings ───────────────────────────────────────────────────────────────

async function scrapeStandings(html) {
  const $ = cheerio.load(html);
  const standings = [];

  let divH2 = null;
  $("h2").each((_, el) => {
    if ($(el).text().includes("Division Standings")) divH2 = $(el);
  });
  if (!divH2) throw new Error("Division Standings section not found");

  const table = divH2.nextAll("table.drtable").first();
  if (!table.length) throw new Error("Standings table not found");

  let currentConference = "";
  let currentDivision = "";

  table.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) return;

    if ($(cells[0]).hasClass("drtable-spanner") || $(row).hasClass("drtable-spanner")) {
      const raw = $(cells[0]).text().trim();
      currentConference = raw.charAt(0) + raw.slice(1).toLowerCase();
      return;
    }
    if ($(cells[0]).hasClass("drtable-fake-th")) {
      const raw = $(cells[0]).text().trim();
      currentDivision = raw.charAt(0) + raw.slice(1).toLowerCase();
      return;
    }

    if (cells.length < 9) return;
    const rawName = $(cells[0]).text().trim();
    if (!rawName) return;
    const teamName = cleanTeamName(rawName);
    if (!teamName || teamName.length < 2) return;

    const config = findTeamByName(teamName);
    const gp  = num($(cells[1]).text());
    const w   = num($(cells[3]).text());
    const l   = num($(cells[4]).text());
    const otl = num($(cells[5]).text());
    const sol = num($(cells[6]).text());
    const pts = num($(cells[7]).text());
    const pct = num($(cells[8]).text());
    const gf  = num($(cells[9]).text());
    const ga  = num($(cells[10]).text());
    const home   = $(cells[14])?.text().trim() || "";
    const away   = $(cells[15])?.text().trim() || "";
    const streak = $(cells[17])?.text().trim() || "";

    standings.push({
      teamId:        config?.id || null,
      teamName,
      division:      currentDivision   || config?.division   || null,
      conference:    currentConference || config?.conference  || null,
      primaryColor:  config?.primaryColor   || "#555",
      secondaryColor:config?.secondaryColor || "#999",
      logoUrl: config ? `https://assets.leaguestat.com/echl/logos/${config.id}.png` : null,
      gp, w, l, otl, sol, pts, pct, gf, ga,
      diff: gf - ga,
      home, away, streak,
    });
  });

  if (standings.length === 0) throw new Error("No standings rows parsed");
  return standings;
}

// ─── Leaders + Scores ────────────────────────────────────────────────────────

function parseLeaderTable($, table, nameColHeader, statColHeader) {
  const headers = $(table).find("tr").first().find("th")
    .map((_, th) => $(th).text().trim().toUpperCase()).get();

  const nameIdx = headers.findIndex((h) => h === nameColHeader.toUpperCase());
  const teamIdx = headers.findIndex((h) => h === "TEAM");
  const statIdx = headers.findIndex((h) => h === statColHeader.toUpperCase());
  if (nameIdx < 0 || statIdx < 0) return [];

  const leaders = [];
  $(table).find("tr").each((i, row) => {
    if (i === 0) return;
    const cells = $(row).find("td");
    if (cells.length <= statIdx) return;
    const name = cleanName($(cells[nameIdx]).text());
    const team = teamIdx >= 0 ? $(cells[teamIdx]).text().trim() : "";
    const value = num($(cells[statIdx]).text());
    const rank = num($(cells[0]).text()) || i;
    if (name && !name.toLowerCase().includes("several") && !name.toLowerCase().includes("tied")) {
      leaders.push({ rank, name, team, value });
    }
  });
  return leaders;
}

async function scrapeLeadersAndScores(html) {
  const $ = cheerio.load(html);
  const leaders = { goals: [], assists: [], points: [], gaa: [], svPct: [] };

  // Overall Leaders section
  $("h2").each((_, h2) => {
    const title = $(h2).text().trim();
    if (title.includes("Overall Leaders")) {
      let el = $(h2).next();
      while (el.length && el.prop("tagName") !== "H2") {
        el.find("table.drtable").each((_, table) => {
          const hdrs = $(table).find("tr").first().find("th")
            .map((_, th) => $(th).text().trim().toUpperCase()).get();
          if (hdrs.includes("POINTS") && hdrs.includes("PTS")) {
            leaders.points = parseLeaderTable($, table, "POINTS", "PTS");
            // Derive goals/assists from the points table's G/A columns if not found separately
            const gIdx = hdrs.indexOf("G");
            const aIdx = hdrs.indexOf("A");
            if (gIdx >= 0 && leaders.goals.length === 0) {
              const gItems = [], aItems = [];
              $(table).find("tr").each((i, row) => {
                if (i === 0) return;
                const cells = $(row).find("td");
                const name = cleanName($(cells[1])?.text() || "");
                const team = $(cells[2])?.text().trim() || "";
                if (name) {
                  gItems.push({ rank: i, name, team, value: num($(cells[gIdx]).text()) });
                  if (aIdx >= 0) aItems.push({ rank: i, name, team, value: num($(cells[aIdx]).text()) });
                }
              });
              leaders.goals = gItems.sort((a, b) => b.value - a.value);
              leaders.assists = aItems.sort((a, b) => b.value - a.value);
            }
          } else if (hdrs.includes("GOALS") && hdrs.includes("G")) {
            leaders.goals = parseLeaderTable($, table, "GOALS", "G");
          } else if (hdrs.includes("ASSISTS") && hdrs.includes("A")) {
            leaders.assists = parseLeaderTable($, table, "ASSISTS", "A");
          }
        });
        el = el.next();
      }
    } else if (title.includes("Goaltending Leaders")) {
      const tbl = $(h2).nextAll("table.drtable").first();
      if (!tbl.length) return;
      const hdrs = tbl.find("tr").first().find("th")
        .map((_, th) => $(th).text().trim().toUpperCase()).get();
      const gaaIdx = hdrs.indexOf("GAA");
      const svIdx  = hdrs.indexOf("SV%");
      tbl.find("tr").each((i, row) => {
        if (i === 0) return;
        const cells = $(row).find("td");
        if (cells.length < 3) return;
        const rank = num($(cells[0]).text()) || i;
        const name = cleanName($(cells[1]).text());
        const team = $(cells[2]).text().trim();
        if (!name) return;
        if (gaaIdx >= 0) leaders.gaa.push({ rank, name, team, value: num($(cells[gaaIdx]).text()) });
        if (svIdx  >= 0) leaders.svPct.push({ rank, name, team, value: num($(cells[svIdx]).text()) });
      });
    }
  });

  // Scores: first `.smallertext` cell with "X at Y" score patterns
  const scores = [];
  $("td").each((_, el) => {
    const html = $(el).html() || "";
    if (!html.includes(" at ")) return;
    const lines = html.split(/<br\s*\/?>/i);
    let found = false;
    lines.forEach((line) => {
      const text = cheerio.load(line).text().trim();
      const m = text.match(/^(.+?)\s+(\d+)\s+at\s+(.+?)\s+(\d+)(?:\s*\((OT|SO)\))?/);
      if (m) {
        found = true;
        scores.push({
          visitingTeam:  m[1].trim(),
          visitingScore: parseInt(m[2]),
          homeTeam:      m[3].trim(),
          homeScore:     parseInt(m[4]),
          overtime:      m[5] || null,
          score:         `${m[2]}-${m[4]}${m[5] ? ` (${m[5]})` : ""}`,
          gameId:        null,
          date:          "Yesterday",
        });
      }
    });
    if (found) return false;
  });

  return { leaders, scores };
}

// ─── Box Score ───────────────────────────────────────────────────────────────

async function scrapeBoxscore(gameId) {
  const html = await fetchHTML(`${BOXSCORE_BASE}${gameId}`);
  const $ = cheerio.load(html);

  const gameInfo = {
    gameId,
    homeTeam: "", visitingTeam: "", date: "", arena: "", attendance: 0,
    finalScore: { home: 0, visiting: 0 },
  };

  $("[class*='team-name'],[class*='teamName'],.home-team,.away-team").each((i, el) => {
    const name = $(el).text().trim();
    if (i === 0) gameInfo.visitingTeam = name;
    else gameInfo.homeTeam = name;
  });

  const periodScoring = [];
  $("table").each((_, table) => {
    const hStr = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get().join(" ");
    if (hStr.includes("period") && hStr.includes("scorer")) {
      $(table).find("tbody tr").each((_, row) => {
        const c = $(row).find("td");
        if (c.length < 4) return;
        periodScoring.push({
          period:   $(c[0]).text().trim(),
          time:     $(c[1]).text().trim(),
          team:     $(c[2]).text().trim(),
          scorer:   $(c[3]).text().trim(),
          assists:  $(c[4])?.text().trim() || "",
          strength: $(c[5])?.text().trim() || "EV",
        });
      });
    }
  });

  const shotsByPeriod = [];
  $("table").each((_, table) => {
    const hStr = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get().join(" ");
    if (hStr.includes("shots") && (hStr.includes("1st") || hStr.includes("period"))) {
      $(table).find("tbody tr").each((_, row) => {
        const c = $(row).find("td");
        if (c.length < 4) return;
        shotsByPeriod.push({
          team: $(c[0]).text().trim(),
          p1: parseInt($(c[1]).text()) || 0,
          p2: parseInt($(c[2]).text()) || 0,
          p3: parseInt($(c[3]).text()) || 0,
          ot: parseInt($(c[4])?.text()) || 0,
          total: parseInt($(c[c.length - 1]).text()) || 0,
        });
      });
    }
  });

  const skaterStats = { home: [], visiting: [] };
  let skaterCount = 0;
  $("table").each((_, table) => {
    const hStr = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get().join(" ");
    if ((hStr.includes("goals") || hStr.includes("g")) && hStr.includes("assists") && (hStr.includes("+/-") || hStr.includes("pim"))) {
      const players = [];
      $(table).find("tbody tr").each((_, row) => {
        const c = $(row).find("td");
        if (c.length < 5) return;
        players.push({
          number: $(c[0]).text().trim(), name: $(c[1]).text().trim(), pos: $(c[2]).text().trim(),
          g: parseInt($(c[3]).text()) || 0, a: parseInt($(c[4]).text()) || 0,
          pts: parseInt($(c[5])?.text()) || 0, plusMinus: parseInt($(c[6])?.text()) || 0,
          pim: parseInt($(c[7])?.text()) || 0, shots: parseInt($(c[8])?.text()) || 0,
        });
      });
      if (players.length) {
        if (skaterCount === 0) skaterStats.visiting = players;
        else skaterStats.home = players;
        skaterCount++;
      }
    }
  });

  const goalieStats = { home: [], visiting: [] };
  let goalieCount = 0;
  $("table").each((_, table) => {
    const hStr = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get().join(" ");
    if (hStr.includes("saves") || hStr.includes("sv") || hStr.includes("gaa")) {
      const goalies = [];
      $(table).find("tbody tr").each((_, row) => {
        const c = $(row).find("td");
        if (c.length < 4) return;
        goalies.push({
          number: $(c[0]).text().trim(), name: $(c[1]).text().trim(),
          minsPlayed: $(c[2]).text().trim(),
          saves: parseInt($(c[3]).text()) || 0, shotsAgainst: parseInt($(c[4])?.text()) || 0,
          ga: parseInt($(c[5])?.text()) || 0, svPct: parseFloat($(c[6])?.text()) || 0,
        });
      });
      if (goalies.length) {
        if (goalieCount === 0) goalieStats.visiting = goalies;
        else goalieStats.home = goalies;
        goalieCount++;
      }
    }
  });

  const penalties = [];
  $("table").each((_, table) => {
    const hStr = $(table).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get().join(" ");
    if (hStr.includes("penalty") || hStr.includes("infraction") || hStr.includes("minutes")) {
      $(table).find("tbody tr").each((_, row) => {
        const c = $(row).find("td");
        if (c.length < 4) return;
        penalties.push({
          period: $(c[0]).text().trim(), time: $(c[1]).text().trim(),
          team: $(c[2]).text().trim(), player: $(c[3]).text().trim(),
          infraction: $(c[4])?.text().trim() || "", minutes: parseInt($(c[5])?.text()) || 0,
        });
      });
    }
  });

  const pageText = $("body").text().toLowerCase();
  const isFinal = pageText.includes("final") || pageText.includes("game over") || !pageText.includes("in progress");

  $("[class*='score'],[class*='final']").each((_, el) => {
    const m = $(el).text().trim().match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) { gameInfo.finalScore.visiting = parseInt(m[1]); gameInfo.finalScore.home = parseInt(m[2]); }
  });

  return { gameInfo, periodScoring, shotsByPeriod, skaterStats, goalieStats, penalties, isFinal, scrapedAt: new Date().toISOString() };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  let changed = 0;

  console.log("Fetching daily report…");
  const reportHtml = await fetchHTML(DAILY_REPORT_URL);

  // Standings (uses same daily report HTML)
  console.log("Parsing standings…");
  const standings = await scrapeStandings(reportHtml);
  if (writeJSON(path.join(DATA_DIR, "standings.json"), { standings, scrapedAt: now })) {
    console.log(`  ✓ standings.json (${standings.length} teams)`);
    changed++;
  } else {
    console.log("  – standings.json unchanged");
  }

  // Leaders + scores
  console.log("Parsing leaders and scores…");
  const { leaders, scores } = await scrapeLeadersAndScores(reportHtml);

  if (writeJSON(path.join(DATA_DIR, "leaders.json"), { leaders, scrapedAt: now })) {
    console.log(`  ✓ leaders.json`);
    changed++;
  } else {
    console.log("  – leaders.json unchanged");
  }

  if (writeJSON(path.join(DATA_DIR, "scores.json"), { scores, scrapedAt: now })) {
    console.log(`  ✓ scores.json (${scores.length} games)`);
    changed++;
  } else {
    console.log("  – scores.json unchanged");
  }

  // Box scores for any recent games that have IDs
  // (scores from daily report don't carry IDs, but we can scan existing boxscores dir
  //  for any games that are not yet final and re-fetch them)
  const existingBoxscores = fs.readdirSync(BOXSCORES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(BOXSCORES_DIR, f), "utf8")); }
      catch (_) { return null; }
    })
    .filter(Boolean);

  const pendingGames = existingBoxscores.filter((b) => !b.isFinal);
  if (pendingGames.length > 0) {
    console.log(`Re-fetching ${pendingGames.length} in-progress box score(s)…`);
    for (const game of pendingGames) {
      const gameId = game.gameInfo?.gameId;
      if (!gameId) continue;
      try {
        const bs = await scrapeBoxscore(gameId);
        if (writeJSON(path.join(BOXSCORES_DIR, `${gameId}.json`), bs)) {
          console.log(`  ✓ boxscores/${gameId}.json`);
          changed++;
        }
      } catch (err) {
        console.warn(`  ✗ boxscores/${gameId}.json: ${err.message}`);
      }
    }
  }

  // Write meta
  writeJSON(path.join(DATA_DIR, "meta.json"), {
    updatedAt: now,
    sources: {
      standings: now,
      leaders:   now,
      scores:    now,
    },
  });

  console.log(`Done. ${changed} file(s) changed.`);
}

main().catch((err) => {
  console.error("Scrape failed:", err.message);
  process.exit(1);
});
