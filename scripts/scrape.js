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
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const BOXSCORES_DIR = path.join(DATA_DIR, "boxscores");
const PLAYERS_DIR = path.join(DATA_DIR, "players");
const ROSTERS_DIR = path.join(DATA_DIR, "rosters");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BOXSCORES_DIR, { recursive: true });
fs.mkdirSync(PLAYERS_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

// Returns a Date object representing "now" adjusted to Eastern Time,
// so date math (yesterday, today) is correct regardless of server timezone.
function nowEastern() {
  const ET_OFFSET_MS = -5 * 60 * 60 * 1000; // EST base (UTC-5)
  const now = new Date();
  // Use Intl to detect whether we're currently in EDT (UTC-4) or EST (UTC-5)
  const etHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(now), 10);
  const utcHour = now.getUTCHours();
  const isDST = ((utcHour - etHour + 24) % 24) === 4;
  return new Date(now.getTime() + (isDST ? -4 : -5) * 60 * 60 * 1000);
}

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
  108: { id: 108, name: "Greensboro Gargoyles",      city: "Greensboro",    abbr: "GSO", division: "North",    conference: "Eastern", primaryColor: "#005EB8", secondaryColor: "#9B2335" },
  52:  { id: 52,  name: "Greenville Swamp Rabbits",  city: "Greenville",    abbr: "GVL", division: "South",    conference: "Eastern", primaryColor: "#00563F", secondaryColor: "#A2AAAD" },
  11:  { id: 11,  name: "Idaho Steelheads",          city: "Idaho",         abbr: "IDH", division: "Mountain", conference: "Western", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  65:  { id: 65,  name: "Indy Fuel",                 city: "Indy",          abbr: "IND", division: "Central",  conference: "Western", primaryColor: "#002868", secondaryColor: "#BF0D3E" },
  98:  { id: 98,  name: "Iowa Heartlanders",         city: "Iowa",          abbr: "IA",  division: "Central",  conference: "Western", primaryColor: "#00843D", secondaryColor: "#FFCD00" },
  79:  { id: 79,  name: "Jacksonville Icemen",       city: "Jacksonville",  abbr: "JAX", division: "South",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#A2AAAD" },
  53:  { id: 53,  name: "Kalamazoo Wings",           city: "Kalamazoo",     abbr: "KAL", division: "Central",  conference: "Western", primaryColor: "#E03A3E", secondaryColor: "#231F20" },
  56:  { id: 56,  name: "Kansas City Mavericks",     city: "Kansas City",   abbr: "KC",  division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#00843D" },
  101: { id: 101, name: "Maine Mariners",            city: "Maine",         abbr: "MNE", division: "North",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#C8102E" },
  63:  { id: 63,  name: "Norfolk Admirals",          city: "Norfolk",       abbr: "NOR", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
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

// Parse a player name cell that may have * (rookie) or x (inactive) prefix markers.
// Names can also be "* x Player" (rookie + inactive).
function parsePlayerName(raw) {
  const s = (raw || "").replace(/[\u00a0\s]+/g, " ").trim();
  const isRookie = s.startsWith("*");
  // Strip * before checking for x
  const afterStar = isRookie ? s.replace(/^\*\s*/, "").trim() : s;
  const isActive = !/^x\s/.test(afterStar);
  const name = afterStar
    .replace(/^x\s*/, "")
    .replace(/\s*\(total\)\s*$/i, "")
    .trim();
  return { name, isRookie, isActive };
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

  // Detect column indices from the header row (th elements)
  const colIdx = {};
  table.find("tr").each((_, tr) => {
    const ths = $(tr).find("th");
    if (!ths.length) return;
    const labels = ths.map((_, th) => $(th).text().trim().toUpperCase()).get();
    if (labels.includes("GP") && labels.includes("PTS")) {
      labels.forEach((label, i) => { colIdx[label] = i; });
      return false; // found header row, stop
    }
  });

  // c(key, fallback) → column index, falls back to known fixed index
  const c = (key, fallback) => (colIdx[key] !== undefined ? colIdx[key] : fallback);

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
    // Column order: GP GR W L OTL SOL PTS PCT GF GA PIM RW ROW HOME ROAD LAST_TEN STREAK S/O
    const gp             = num($(cells[c("GP",         1)]).text());
    const gamesRemaining = num($(cells[c("GR",         2)]).text());
    const w              = num($(cells[c("W",          3)]).text());
    const l              = num($(cells[c("L",          4)]).text());
    const otl            = num($(cells[c("OTL",        5)]).text());
    const sol            = num($(cells[c("SOL",        6)]).text());
    const pts            = num($(cells[c("PTS",        7)]).text());
    const pct            = num($(cells[c("PCT",        8)]).text());
    const gf             = num($(cells[c("GF",         9)]).text());
    const ga             = num($(cells[c("GA",        10)]).text());
    const pim            = num($(cells[c("PIM",       11)]).text()) || 0;
    const regulationWins = num($(cells[c("RW",        12)]).text());
    const rowWins        = num($(cells[c("ROW",       13)]).text());
    const homeRecord     = $(cells[c("HOME",          14)])?.text().trim() || "";
    const roadRecord     = $(cells[c("ROAD",          15)])?.text().trim() || "";
    const lastTen        = $(cells[c("LAST TEN",      16)])?.text().trim()
                        || $(cells[c("L10",           16)])?.text().trim() || "";
    const streak         = $(cells[c("STREAK",        17)])?.text().trim() || "";
    const shootoutRecord = $(cells[c("S/O",           18)])?.text().trim() || "";

    standings.push({
      teamId:        config?.id || null,
      teamName,
      division:      currentDivision   || config?.division   || null,
      conference:    currentConference || config?.conference  || null,
      primaryColor:  config?.primaryColor   || "#555",
      secondaryColor:config?.secondaryColor || "#999",
      logoUrl: config ? `/logos/${config.id}.png` : null,
      gp, w, l, otl, sol, pts, pct, gf, ga,
      diff: gf - ga,
      regulationWins,
      rowWins,
      gamesRemaining,
      homeRecord,
      roadRecord,
      shootoutRecord,
      lastTen,
      streak,
      pim,
    });
  });

  if (standings.length === 0) throw new Error("No standings rows parsed");
  return standings;
}

// ─── Special Teams ────────────────────────────────────────────────────────────

function scrapeSpecialTeams(html) {
  const $ = cheerio.load(html);
  const byTeam = {}; // teamId → { ppPct, ppGoals, ppOpportunities, pkPct, pkGoalsAllowed, timesShorthanded }

  // Build abbr → team config map
  const abbrMap = {};
  Object.values(TEAMS).forEach((t) => { abbrMap[t.abbr.toUpperCase()] = t; });

  // The special teams sections use <span class="subheader"> as section titles inside <td>s.
  // The data table immediately follows the span as a sibling within the same td.
  function parseSTSection(sectionText, handler) {
    let targetSpan = null;
    $("span.subheader").each((_, el) => {
      if ($(el).text().trim().toLowerCase().includes(sectionText.toLowerCase())) {
        targetSpan = $(el);
        return false;
      }
    });
    if (!targetSpan) return;

    const table = targetSpan.nextAll("table").first();
    if (!table.length) return;

    const rows = table.find("tr").toArray();
    if (!rows.length) return;

    // Row 0 is the column header row
    const headers = $(rows[0]).find("th,td").map((_, c) => $(c).text().trim().toUpperCase()).get();
    const ci = (key) => { const i = headers.indexOf(key); return i >= 0 ? i : null; };
    const teamCol = ci("TEAM") ?? 1;

    rows.slice(1).forEach((row) => {
      const cells = $(row).find("td");
      if (!cells.length) return;
      const abbr = $(cells[teamCol]).text().trim().toUpperCase();
      const team = abbrMap[abbr];
      if (!team) return;
      if (!byTeam[team.id]) byTeam[team.id] = {};
      handler(cells, ci, byTeam[team.id]);
    });
  }

  parseSTSection("overall power play record", (cells, ci, entry) => {
    entry.ppGoals         = num($(cells[ci("PPGF") ?? 4]).text());
    entry.ppOpportunities = num($(cells[ci("ADV")  ?? 3]).text());
    entry.ppPct           = num($(cells[ci("PCT")  ?? 5]).text());
  });

  parseSTSection("overall penalty killing record", (cells, ci, entry) => {
    entry.pkGoalsAllowed   = num($(cells[ci("PPGA") ?? 4]).text());
    entry.timesShorthanded = num($(cells[ci("TSH")  ?? 3]).text());
    entry.pkPct            = num($(cells[ci("PCT")  ?? 5]).text());
  });

  return byTeam;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

function scrapeAttendance(html) {
  const $ = cheerio.load(html);
  const attendance = {};

  $("h2,h3").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (!text.includes("attendance")) return;

    const table = $(el).nextAll("table.drtable,table").first();
    if (!table.length) return;

    // Map column headers
    const hdrs = table.find("tr").first().find("th,td")
      .map((_, th) => $(th).text().trim().toUpperCase()).get();

    const teamIdx  = hdrs.findIndex((h) => h === "TEAM" || h === "TEAMS");
    const gamesIdx = hdrs.findIndex((h) => h === "GAMES" || h === "GP" || h === "G");
    const totalIdx = hdrs.findIndex((h) => h.includes("TOTAL") || h === "ATTEND" || h === "ATTENDANCE");
    const avgIdx   = hdrs.findIndex((h) => h.includes("AVG") || h.includes("AVERAGE") || h === "PER GAME");

    table.find("tr").each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td");
      if (cells.length < 2) return;
      const rawName = $(cells[teamIdx >= 0 ? teamIdx : 0]).text().trim();
      const teamName = cleanTeamName(rawName);
      if (!teamName || teamName.length < 2) return;
      const config = findTeamByName(teamName);
      if (!config) return;
      attendance[config.id] = {
        attendanceGames:   num($(cells[gamesIdx >= 0 ? gamesIdx : 1]).text()),
        attendanceTotal:   num($(cells[totalIdx >= 0 ? totalIdx : 2]).text()),
        attendanceAverage: num($(cells[avgIdx   >= 0 ? avgIdx   : 3]).text()),
      };
    });
  });

  return attendance;
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

// Parse a single-stat leader table using fixed column positions (col 1 = name, col 2 = team)
// and finding the stat column by its header label. Safer when the name column header is ambiguous.
function parseLeaderTableByIdx($, table, statColHeader) {
  const headers = $(table).find("tr").first().find("th")
    .map((_, th) => $(th).text().trim().toUpperCase()).get();
  const upperStat = statColHeader.toUpperCase();
  // Prefer stat column at position 3+ (after rank, name, team); fall back to any position
  let statIdx = headers.findIndex((h, i) => i >= 3 && h === upperStat);
  if (statIdx < 0) statIdx = headers.indexOf(upperStat);
  if (statIdx < 0) return [];
  const result = [];
  $(table).find("tr").each((i, row) => {
    if (i === 0) return;
    const cells = $(row).find("td");
    if (cells.length <= statIdx) return;
    const name = cleanName($(cells[1]).text());
    const team = $(cells[2])?.text().trim() || "";
    const rank = num($(cells[0]).text()) || i;
    if (!name || name.toLowerCase().includes("several") || name.toLowerCase().includes("tied")) return;
    result.push({ rank, name, team, value: num($(cells[statIdx]).text()) });
  });
  return result;
}

// Parse a multi-stat leader table. statCols is [{header, key}, ...].
// The first entry's value becomes the `value` field used for sorting/charting.
function parseMultiLeaderTableByIdx($, table, statCols) {
  const headers = $(table).find("tr").first().find("th")
    .map((_, th) => $(th).text().trim().toUpperCase()).get();
  const colIndices = statCols.map(({ header }) => {
    const upper = header.toUpperCase();
    // Prefer position 3+ for primary stat; any position for secondary
    let idx = headers.findIndex((h, i) => i >= 3 && h === upper);
    if (idx < 0) idx = headers.indexOf(upper);
    return idx;
  });
  if (colIndices[0] < 0) return [];
  const result = [];
  $(table).find("tr").each((i, row) => {
    if (i === 0) return;
    const cells = $(row).find("td");
    const name = cleanName($(cells[1]).text());
    const team = $(cells[2])?.text().trim() || "";
    const rank = num($(cells[0]).text()) || i;
    if (!name || name.toLowerCase().includes("several") || name.toLowerCase().includes("tied")) return;
    const entry = { rank, name, team };
    statCols.forEach(({ key }, ci) => {
      const idx = colIndices[ci];
      if (idx >= 0 && idx < cells.length) entry[key] = num($(cells[idx]).text());
    });
    entry.value = colIndices[0] >= 0 ? (entry[statCols[0].key] ?? 0) : 0;
    result.push(entry);
  });
  return result;
}

async function scrapeLeadersAndScores(html, ydateStr) {
  const $ = cheerio.load(html);
  const leaders = {
    goals: [], assists: [], points: [],
    gaa: [], svPct: [], shutouts: [], goalieWins: [],
    gwg: [],
    plusMinus: [], shots: [], shootingPct: [],
    ppg: [], ppp: [], ppa: [],
    shg: [], shp: [], sha: [],
    pim: [], minors: [], majors: [],
    soGoals: [], soPct: [],
    soRecord: [],
    rookiePts: [], rookieG: [], rookieA: [],
    dPts: [], dGoals: [],
  };

  // Overall Leaders section
  $("h2").each((_, h2) => {
    const title = $(h2).text().trim();
    if (title.includes("Overall Leaders")) {
      let el = $(h2).next();
      while (el.length && el.prop("tagName") !== "H2") {
        el.find("table.drtable").each((_, table) => {
          const hdrs = $(table).find("tr").first().find("th")
            .map((_, th) => $(th).text().trim().toUpperCase()).get();
          const has = (h) => hdrs.includes(h);
          const hasAny = (...hs) => hs.some((h) => hdrs.includes(h));

          // ── Points / Goals / Assists (existing logic) ──────────────────
          if (has("POINTS") && has("PTS")) {
            leaders.points = parseLeaderTable($, table, "POINTS", "PTS");
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
          } else if (has("GOALS") && has("G")) {
            leaders.goals = parseLeaderTable($, table, "GOALS", "G");
          } else if (has("ASSISTS") && has("A")) {
            leaders.assists = parseLeaderTable($, table, "ASSISTS", "A");
          }

          // ── New skater categories ──────────────────────────────────────
          if (hasAny("+/-", "PM") && !leaders.plusMinus.length)
            leaders.plusMinus = parseLeaderTableByIdx($, table, has("+/-") ? "+/-" : "PM");

          if (has("PPG") && !leaders.ppg.length)
            leaders.ppg = parseLeaderTableByIdx($, table, "PPG");
          if (has("PPP") && !leaders.ppp.length)
            leaders.ppp = parseLeaderTableByIdx($, table, "PPP");
          if (has("PPA") && !leaders.ppa.length)
            leaders.ppa = parseLeaderTableByIdx($, table, "PPA");

          if (has("SHG") && !leaders.shg.length)
            leaders.shg = parseLeaderTableByIdx($, table, "SHG");
          if (has("SHP") && !leaders.shp.length)
            leaders.shp = parseLeaderTableByIdx($, table, "SHP");
          if (has("SHA") && !leaders.sha.length)
            leaders.sha = parseLeaderTableByIdx($, table, "SHA");

          if (has("PIM") && !leaders.pim.length)
            leaders.pim = parseLeaderTableByIdx($, table, "PIM");
          if (has("MINORS") && !leaders.minors.length)
            leaders.minors = parseLeaderTableByIdx($, table, "MINORS");
          if (has("MAJORS") && !leaders.majors.length)
            leaders.majors = parseLeaderTableByIdx($, table, "MAJORS");

          // Shots on goal — only if no goals column (avoid matching scoring tables)
          if (has("SHOTS") && !has("G") && !has("SOA") && !leaders.shots.length)
            leaders.shots = parseLeaderTableByIdx($, table, "SHOTS");

          // Shooting % — shots + goals + pct
          if (has("SHOTS") && has("G") && !has("PTS") && !leaders.shootingPct.length) {
            const pctH = hdrs.find((h) => h === "PCT" || h === "SH%" || h === "%" || h.includes("SHOOT"));
            if (pctH) {
              leaders.shootingPct = parseMultiLeaderTableByIdx($, table, [
                { header: pctH, key: "pct" },
                { header: "G",     key: "goals" },
                { header: "SHOTS", key: "shots" },
              ]);
            }
          }

          // Shootout goals — SOG but no SOA
          if (has("SOG") && !has("SOA") && !leaders.soGoals.length)
            leaders.soGoals = parseLeaderTableByIdx($, table, "SOG");

          // Shootout % — SOG + SOA
          if (has("SOG") && has("SOA") && !leaders.soPct.length) {
            const pctH = hdrs.find((h) => h === "SO%" || h.includes("SO PCT") || h === "PCT");
            leaders.soPct = parseMultiLeaderTableByIdx($, table, [
              { header: pctH || "PCT", key: "pct" },
              { header: "SOG",         key: "soGoals" },
              { header: "SOA",         key: "soAttempts" },
            ]);
          }
        });
        el = el.next();
      }
    } else if (title.includes("Goaltending Leaders")) {
      // Scan all tables in the goaltending section
      let el = $(h2).next();
      while (el.length && el.prop("tagName") !== "H2") {
        el.find("table.drtable").each((_, table) => {
          const hdrs = $(table).find("tr").first().find("th")
            .map((_, th) => $(th).text().trim().toUpperCase()).get();
          const gaaIdx  = hdrs.indexOf("GAA");
          const svIdx   = hdrs.indexOf("SV%");
          const shutIdx = hdrs.findIndex((h) => h === "SO" || h === "SHO" || h === "SHUTOUTS");
          const sowIdx  = hdrs.indexOf("SOW");

          if (gaaIdx >= 0 || svIdx >= 0 || shutIdx >= 0) {
            // Main goalie stats table
            $(table).find("tr").each((i, row) => {
              if (i === 0) return;
              const cells = $(row).find("td");
              if (cells.length < 3) return;
              const rank = num($(cells[0]).text()) || i;
              const name = cleanName($(cells[1]).text());
              const team = $(cells[2]).text().trim();
              if (!name) return;
              if (gaaIdx  >= 0) leaders.gaa.push({ rank, name, team, value: num($(cells[gaaIdx]).text()) });
              if (svIdx   >= 0) leaders.svPct.push({ rank, name, team, value: num($(cells[svIdx]).text()) });
              if (shutIdx >= 0) leaders.shutouts.push({ rank, name, team, value: num($(cells[shutIdx]).text()) });
            });
          } else if (sowIdx >= 0) {
            // Goalie shootout record table
            const solIdx   = hdrs.indexOf("SOL");
            const sogpIdx  = hdrs.indexOf("SOGP");
            const sogaIdx  = hdrs.indexOf("SOGA");
            const soaIdx   = hdrs.indexOf("SOA");
            const soPctIdx = hdrs.findIndex((h) => h === "SO%" || h.includes("SO PCT"));
            $(table).find("tr").each((i, row) => {
              if (i === 0) return;
              const cells = $(row).find("td");
              if (cells.length < 3) return;
              const rank = num($(cells[0]).text()) || i;
              const name = cleanName($(cells[1]).text());
              const team = $(cells[2]).text().trim();
              if (!name) return;
              const entry = { rank, name, team };
              if (sogpIdx >= 0) entry.sogp = num($(cells[sogpIdx]).text());
              entry.sow = num($(cells[sowIdx]).text());
              if (solIdx  >= 0) entry.sol  = num($(cells[solIdx]).text());
              if (sogaIdx >= 0) entry.soga = num($(cells[sogaIdx]).text());
              if (soaIdx  >= 0) entry.soa  = num($(cells[soaIdx]).text());
              if (soPctIdx >= 0) entry.pct = num($(cells[soPctIdx]).text());
              entry.value = soPctIdx >= 0 ? (entry.pct ?? 0) : entry.sow;
              leaders.soRecord.push(entry);
            });
          }
        });
        el = el.next();
      }
    }
  });

  // Scores: walk table rows looking for date headers and score cells.
  // The daily report groups recent results under date headers like "WED, MARCH 11".
  const scores = [];
  const monthMap = { JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
                     JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11 };
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Determine season years: Oct-Dec = previous year, Jan-Jun = current year
  const eastern = nowEastern();
  const curYear = eastern.getUTCFullYear();
  const curMonth = eastern.getUTCMonth();

  function headerToDateStr(headerText) {
    // e.g. "WED, MARCH 11" → "Mar 11, 2026"
    const m = headerText.match(/([A-Z]+)\s+(\d+)/);
    if (!m) return null;
    const mon = monthMap[m[1]];
    if (mon === undefined) return null;
    const day = parseInt(m[2]);
    // Season spans Oct–Apr: Oct-Dec use prior year if we're now in Jan-Jun
    const year = (mon >= 9 && curMonth <= 5) ? curYear - 1 : curYear;
    return `${monthNames[mon]} ${day}, ${year}`;
  }

  // Find the table that contains date-header rows (e.g. "WED, MARCH 11").
  // The scores table is nested inside a wrapper table, so we must skip wrapper
  // tables and only parse tables whose direct rows include date headers.
  const dateHeaderRe = /^(MON|TUE|WED|THU|FRI|SAT|SUN),\s/;
  $("table").each((_, table) => {
    const rows = $(table).children("tbody").children("tr").add($(table).children("tr"));
    // Pre-check: skip wrapper tables — only parse tables with 3+ direct rows
    // that include date-header rows (the scores table has ~14 rows, wrappers have 1-2).
    if (rows.length < 3) return;
    let hasDateHeaders = false;
    rows.each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length <= 2 && dateHeaderRe.test($(cells[0]).text().trim().toUpperCase())) {
        hasDateHeaders = true;
        return false;
      }
    });
    if (!hasDateHeaders) return; // skip this table, continue to next

    let currentDate = ydateStr; // fallback
    let foundAny = false;
    rows.each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length === 1 || (cells.length === 2 && $(cells[0]).attr("colspan"))) {
        // Potential date header row
        const text = $(cells.length === 1 ? cells[0] : cells[0]).text().trim().toUpperCase();
        const parsed = headerToDateStr(text);
        if (parsed) { currentDate = parsed; return; }
      }
      // Check for score lines in any cell
      cells.each((_, cell) => {
        const cellHtml = $(cell).html() || "";
        if (!cellHtml.includes(" at ")) return;
        const lines = cellHtml.split(/<br\s*\/?>/i);
        lines.forEach((line) => {
          const text = cheerio.load(line).text().trim();
          const sm = text.match(/^(.+?)\s+(\d+)\s+at\s+(.+?)\s+(\d+)(?:\s*\((OT|SO)\))?$/);
          if (sm) {
            foundAny = true;
            scores.push({
              visitingTeam:  sm[1].trim(),
              visitingScore: parseInt(sm[2]),
              homeTeam:      sm[3].trim(),
              homeScore:     parseInt(sm[4]),
              overtime:      sm[5] || null,
              score:         `${sm[2]}-${sm[4]}${sm[5] ? ` (${sm[5]})` : ""}`,
              gameId:        null,
              date:          currentDate,
            });
          }
        });
      });
    });
    if (foundAny) return false; // stop after finding the scores table
  });

  // Deduplicate: if the same game appears twice (once with gameId, once without),
  // keep the entry with the gameId and drop the null-gameId duplicate.
  const seenWithId = new Set(
    scores.filter(g => g.gameId !== null)
          .map(g => `${g.date}|${g.visitingTeam}|${g.homeTeam}|${g.visitingScore}|${g.homeScore}`)
  );
  const deduped = scores.filter(g => {
    if (g.gameId !== null) return true;
    return !seenWithId.has(`${g.date}|${g.visitingTeam}|${g.homeTeam}|${g.visitingScore}|${g.homeScore}`);
  });

  return { leaders, scores: deduped };
}

// ─── Upcoming Games ──────────────────────────────────────────────────────────

function scrapeUpcomingGames(html) {
  const $ = cheerio.load(html);
  const upcoming = [];

  const monthMap = { JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
                     JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11 };
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dayFullNames = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
                         FRI: "Friday", SAT: "Saturday", SUN: "Sunday" };
  const eastern = nowEastern();
  const curYear = eastern.getUTCFullYear();
  const curMonth = eastern.getUTCMonth();

  // "SAT, MARCH 21" → { dayLabel: "Saturday", date: "Mar 21, 2026" }
  function parseDateHeader(text) {
    const m = text.match(/^(MON|TUE|WED|THU|FRI|SAT|SUN),\s+([A-Z]+)\s+(\d+)$/);
    if (!m) return null;
    const dayLabel = dayFullNames[m[1]];
    const mon = monthMap[m[2]];
    if (mon === undefined || !dayLabel) return null;
    const day = parseInt(m[3]);
    const year = (mon >= 9 && curMonth <= 5) ? curYear - 1 : curYear;
    return { dayLabel, date: `${monthNames[mon]} ${day}, ${year}` };
  }

  // "Day's Games" header
  const dayGamesRe = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'s\s+Games$/i;
  // Game line: "Utah at Indy - 7:00 PM EDT"
  const gameLineRe = /^(.+?)\s+at\s+(.+?)\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM)\s*\w+)$/i;
  // Inline day boundary: split text at "MON|TUE|..." boundaries that run together
  const daySplitRe = /(?=(?:MON|TUE|WED|THU|FRI|SAT|SUN),\s+(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d)/;

  // Extract all text fragments from td elements, splitting on <br> and inline day headers
  const allText = [];
  $("td").each((_, el) => {
    const raw = $(el).html() || "";
    raw.split(/<br\s*\/?>/i).forEach((frag) => {
      const text = cheerio.load(frag).text().trim();
      if (!text) return;
      // Further split on inline day-of-week boundaries (e.g., "7:10 PM MDTSAT, MARCH 21")
      const parts = text.split(daySplitRe);
      parts.forEach((p) => { if (p.trim()) allText.push(p.trim()); });
    });
  });

  let currentDay = null;
  let currentDate = null;
  for (const text of allText) {
    // Check for "Day's Games" header
    const dgMatch = text.match(dayGamesRe);
    if (dgMatch) {
      // Use as context hint but wait for the date header for exact date
      continue;
    }
    // Check for "SAT, MARCH 21" date header
    const dateInfo = parseDateHeader(text.toUpperCase());
    if (dateInfo) {
      currentDay = dateInfo.dayLabel;
      currentDate = dateInfo.date;
      continue;
    }
    if (!currentDay || !currentDate) continue;
    if (/no\s+games?\s+scheduled/i.test(text)) continue;

    const gm = text.match(gameLineRe);
    if (gm) {
      const visiting = findTeamByName(gm[1].trim());
      const home = findTeamByName(gm[2].trim());
      if (visiting && home) {
        upcoming.push({
          visitingTeamId: visiting.id,
          visitingTeam: visiting.city,
          homeTeamId: home.id,
          homeTeam: home.city,
          date: currentDate,
          time: gm[3].trim(),
          dayLabel: currentDay,
        });
      }
    }
  }

  // Filter out games with dates in the past (today or later only)
  const todayStr = `${monthNames[eastern.getUTCMonth()]} ${eastern.getUTCDate()}, ${eastern.getUTCFullYear()}`;
  const todayMs = new Date(todayStr).getTime();
  return upcoming.filter((g) => new Date(g.date).getTime() >= todayMs);
}

// ─── Box Score ───────────────────────────────────────────────────────────────

// Normalize text: collapse whitespace + non-breaking spaces.
function nt(s) { return (s || "").replace(/[\u00a0\s]+/g, " ").trim(); }

// Direct child rows of a table (avoids matching rows from nested tables).
function directRows($, table) {
  return $(table).children("tbody").children("tr").add($(table).children("tr"));
}

// Find the first table in selector whose FIRST CELL of first direct row matches keyword.
function findTable($, selector, keyword) {
  let found = null;
  $(selector).each((_, t) => {
    const firstCell = nt(directRows($, t).first().find("td").first().text());
    if (firstCell.toUpperCase().includes(keyword.toUpperCase())) { found = t; return false; }
  });
  return found;
}

// Return all direct-child-row <td> text values for row at index.
function rowCells($, table, rowIndex) {
  return directRows($, table).eq(rowIndex).find("td")
    .map((_, td) => nt($(td).text())).get();
}

async function scrapeBoxscore(gameId) {
  const html = await fetchHTML(`${BOXSCORE_BASE}${gameId}`);
  const $ = cheerio.load(html);

  // ── Teams, score, arena, date ──────────────────────────────────────────────
  // Use the tSides SCORING table: row1 = visiting, row2 = home; last col = total.
  const scoringTable = findTable($, "table.tSides", "SCORING");
  const sRow1 = scoringTable ? rowCells($, scoringTable, 1) : [];
  const sRow2 = scoringTable ? rowCells($, scoringTable, 2) : [];
  const visitingTeam  = sRow1[0] || "";
  const homeTeam      = sRow2[0] || "";
  const visitingScore = parseInt(sRow1[sRow1.length - 1]) || 0;
  const homeScore     = parseInt(sRow2[sRow2.length - 1]) || 0;

  // Arena and date from the outer header table (table[0], row0, second <td>).
  let arena = "", date = "";
  const headerCellHtml = $("table").first().children("tbody").children("tr").first()
    .children("td").eq(1).html() || "";
  const headerLines = headerCellHtml.split(/<br\s*\/?>/i)
    .map((l) => nt(cheerio.load(l).text())).filter(Boolean);
  for (const line of headerLines) {
    if (/^[A-Z][a-z]{2}\s+\d/.test(line)) { date = line; }
    else if (line && !line.match(/^ECHL Game/i) && !line.match(/\d+\s+at\s+/)) { arena = line; }
  }

  // Attendance + isFinal from the timing table (first cell = "Game Start:").
  let attendance = 0;
  let isFinal = false;
  $("table").each((_, t) => {
    const firstCell = nt(directRows($, t).first().find("td").first().text());
    if (firstCell !== "Game Start:") return;
    directRows($, t).each((_, row) => {
      const cells = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (cells[0] === "Attendance:") attendance = parseInt(cells[1]) || 0;
      if (cells[0] === "Game End:")   isFinal = true;
    });
    return false;
  });

  const gameInfo = {
    gameId, visitingTeam, homeTeam, date, arena, attendance,
    finalScore: { visiting: visitingScore, home: homeScore },
  };

  // ── Shots by period ────────────────────────────────────────────────────────
  const shotsTable = findTable($, "table.tSides", "SHOTS");
  const shotsByPeriod = [];
  if (shotsTable) {
    [1, 2].forEach((ri) => {
      const c = rowCells($, shotsTable, ri);
      if (!c[0]) return;
      const hasOt = c.length >= 6;
      shotsByPeriod.push({
        team:  c[0],
        p1:    parseInt(c[1]) || 0,
        p2:    parseInt(c[2]) || 0,
        p3:    parseInt(c[3]) || 0,
        ot:    hasOt ? parseInt(c[4]) || 0 : 0,
        total: parseInt(c[c.length - 1]) || 0,
      });
    });
  }

  // ── Period scoring (individual goals) ─────────────────────────────────────
  const goalsTable = findTable($, "table.tSides", "V-H");
  const periodScoring = [];
  if (goalsTable) {
    directRows($, goalsTable).slice(1).each((_, row) => {
      const c = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (c.length < 6 || !c[2]) return;
      periodScoring.push({
        period:   c[2],
        time:     c[4],
        team:     c[3],
        scorer:   c[5],
        assists:  c[6],
        strength: c[7] || "EV",
      });
    });
  }

  // ── Skater stats ───────────────────────────────────────────────────────────
  const skaterStats = { visiting: [], home: [] };
  let rosterIdx = 0;
  $("table.tSidesC").each((_, t) => {
    const header = nt(directRows($, t).first().find("td").first().text()).toUpperCase();
    if (!header.includes("ROSTER")) return;
    const players = [];
    directRows($, t).slice(2).each((_, row) => {
      const c = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (c.length < 7 || !c[2]) return;
      const g = parseInt(c[3]) || 0;
      const a = parseInt(c[4]) || 0;
      players.push({
        number: c[1], name: c[2], pos: "",
        g, a, pts: g + a,
        plusMinus: parseInt(c[5]) || 0,
        shots:     parseInt(c[6]) || 0,
        pim:       parseInt(c[7]) || 0,
      });
    });
    if (players.length) {
      if (rosterIdx === 0) skaterStats.visiting = players;
      else skaterStats.home = players;
      rosterIdx++;
    }
  });

  // ── Goalie stats ───────────────────────────────────────────────────────────
  const goalieStats = { visiting: [], home: [] };
  let goalieIdx = 0;
  $("table.tSidesC").each((_, t) => {
    const header = nt(directRows($, t).first().find("td").first().text()).toUpperCase();
    if (!header.includes("GOALIES")) return;
    const goalies = [];
    directRows($, t).slice(2).each((_, row) => {
      const c = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (c.length < 5 || !c[1]) return;
      const shotsAgainst = parseInt(c[3]) || 0;
      const saves        = parseInt(c[4]) || 0;
      const ga           = parseInt(c[5]) || 0;
      goalies.push({
        number: c[0], name: c[1].replace(/\s*\([WL]\)\s*$/i, "").trim(),
        minsPlayed: c[2], shotsAgainst, saves, ga,
        svPct: shotsAgainst > 0 ? Math.round((saves / shotsAgainst) * 1000) / 1000 : 0,
      });
    });
    if (goalies.length) {
      if (goalieIdx === 0) goalieStats.visiting = goalies;
      else goalieStats.home = goalies;
      goalieIdx++;
    }
  });

  // ── Three Stars ────────────────────────────────────────────────────────────
  const stars = [];
  $("b").each((_, el) => {
    if (!$(el).text().includes("Three Stars")) return;
    const td = $(el).closest("td");
    const lines = (td.html() || "").split(/<br\s*\/?>/i);
    lines.forEach((line) => {
      const text = nt(cheerio.load(line).text());
      const m = text.match(/^(\d+)\.\s+(\S+)\s+-\s+(.+)$/);
      if (m) stars.push({ star: parseInt(m[1]), team: m[2], name: m[3].trim() });
    });
    return false;
  });

  // Enrich stars with their game stats from skater or goalie tables
  const allSkaters = [...(skaterStats.visiting || []), ...(skaterStats.home || [])];
  const allGoalies = [...(goalieStats.visiting || []), ...(goalieStats.home || [])];
  const enrichedStars = stars.map((s) => {
    const p = allSkaters.find((p) => p.name === s.name);
    if (p) return { ...s, g: p.g, a: p.a, pts: p.pts };
    const g = allGoalies.find((g) => g.name === s.name);
    if (g) return { ...s, isGoalie: true, saves: g.saves, svPct: g.svPct, shotsAgainst: g.shotsAgainst };
    return s;
  });

  // ── Penalties ──────────────────────────────────────────────────────────────
  const penTable = findTable($, "table.tSides", "PENALTIES");
  const penalties = [];
  if (penTable) {
    directRows($, penTable).slice(2).each((_, row) => {
      const c = $(row).find("td").map((_, td) => nt($(td).text())).get();
      if (c.length < 5 || !c[2]) return;
      penalties.push({
        period: c[0], team: c[1], player: c[2],
        minutes: parseFloat(c[3]) || 0, infraction: c[4], time: c[5] || "",
      });
    });
  }

  return { gameInfo, periodScoring, shotsByPeriod, skaterStats, goalieStats, penalties, stars: enrichedStars, isFinal, scrapedAt: new Date().toISOString() };
}

// ─── Resolve Game IDs ─────────────────────────────────────────────────────────
// The daily report HTML has no game IDs; we probe the HockeyTech game report
// pages (which don't require an API key) using a persisted seed ID stored in
// meta.json so each run only scans a small forward window.

const SEED_GAME_ID = 25150; // 2025-26 ECHL season reference (Mar 2026)

async function fetchGameTitle(gameId) {
  try {
    const html = await fetchHTML(`${BOXSCORE_BASE}${gameId}`);
    const m = html.match(/<title>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
  } catch (_) { return null; }
}

function normName(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveGameIds(scores, seedId) {
  if (!scores.length) return { scores, maxId: seedId };

  // Build set of date strings (in title format "Mar 13, 2026") for all unresolved scores
  const scoreDates = new Set(scores.filter(s => !s.gameId).map(s => {
    // Convert "Mar 13, 2026" to padded format used in game titles: "Mar 13, 2026"
    const d = new Date(s.date);
    if (isNaN(d)) return s.date;
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2," ")}, ${d.getFullYear()}`;
  }));

  // Probe a window: seedId-100 to seedId+300
  // HockeyTech assigns game IDs out of order, so we need a wide backward lookback
  const start = Math.max(1, seedId - 100);
  const end   = seedId + 300;
  let maxId = seedId;

  const dateList = [...scoreDates].map(d => d.trim()).join(", ");
  console.log(`  Probing game IDs ${start}–${end} for ${dateList}…`);

  const BATCH = 20;
  const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (id) => ({ id, title: await fetchGameTitle(id) })));
    for (const { id, title } of results) {
      if (!title || !title.startsWith("Gamesheet:")) continue;
      // Check if this game's date matches any of our score dates
      if (![...scoreDates].some(d => title.includes(d.trim()))) continue;

      maxId = Math.max(maxId, id);

      // Parse "Gamesheet: Visiting at Home - Date"
      const m = title.match(/^Gamesheet:\s+(.+?)\s+at\s+(.+?)\s+-\s+(.+)$/);
      if (!m) continue;
      const visiting = normName(m[1]);
      const home     = normName(m[2]);
      const gameDate = m[3].trim();

      // Match to a parsed score by teams + date.
      // Use startsWith in both directions to handle short city names (e.g. "iowa" vs "iowaheartlanders").
      const score = scores.find(
        (s) => s.gameId === null &&
               s.date === gameDate &&
               (visiting.startsWith(normName(s.visitingTeam)) || normName(s.visitingTeam).startsWith(visiting)) &&
               (home.startsWith(normName(s.homeTeam)) || normName(s.homeTeam).startsWith(home))
      );
      if (score) {
        score.gameId = id;
        console.log(`    ✓ ${id} → ${m[1]} at ${m[2]}`);
      }
    }
  }

  return { scores, maxId };
}

// ─── Per-Team Player Stats ────────────────────────────────────────────────────
// Scrapes the "{Team Name} Statistics" sections from the daily report.
// Each section has two tables: skaters (PLAYER header) and goalies (GOALIE header).
// Player names are prefixed with * (rookie) or x (inactive).

function scrapeTeamPlayers(html) {
  const $ = cheerio.load(html);
  const result = {};

  $("h2").each((_, h2) => {
    const title = $(h2).text().trim();
    if (!title.endsWith(" Statistics")) return;

    const teamName = title.replace(/ Statistics$/, "").trim();
    const config = findTeamByName(teamName);
    if (!config) return;

    // Collect all drtable elements until the next h2
    const tables = [];
    let el = $(h2).next();
    while (el.length && el.prop("tagName") !== "H2") {
      if (el.is("table.drtable")) {
        tables.push(el[0]);
      } else {
        el.find("table.drtable").each((_, t) => tables.push(t));
      }
      el = el.next();
    }

    const skaters = [];
    const goalies = [];

    tables.forEach((table) => {
      const headers = $(table).find("tr").first().find("th")
        .map((_, th) => $(th).text().trim().toUpperCase()).get();
      const isGoalie = headers.includes("GOALIE");
      const isSkater = headers.includes("PLAYER");

      if (isSkater) {
        const gpIdx  = headers.indexOf("GP");
        const gIdx   = headers.indexOf("G");
        const aIdx   = headers.indexOf("A");
        const ptsIdx = headers.indexOf("PTS");
        const gwIdx   = headers.indexOf("GW");
        const pmIdx   = headers.findIndex((h) => h === "+/-" || h === "PM");
        const shIdx   = headers.indexOf("SH");
        const shPctIdx = headers.indexOf("SH%");
        const ppIdx   = headers.indexOf("PP");
        const ppaIdx  = headers.indexOf("PPA");
        const shgIdx  = headers.indexOf("SHG");
        const shaIdx  = headers.indexOf("SHA");
        const pimIdx  = headers.indexOf("PIM");
        const sogIdx  = headers.indexOf("SOG");
        const soaIdx  = headers.indexOf("SOA");
        const soPctIdx = headers.indexOf("SO%");
        $(table).find("tr").each((i, row) => {
          if (i === 0) return;
          const cells = $(row).find("td");
          if (cells.length < 7) return;
          // Skip multi-team sub-rows (empty number cell)
          const numRaw = $(cells[0]).text().replace(/[\u00a0\s]+/g, "").trim();
          if (!numRaw) return;
          const { name, isRookie, isActive } = parsePlayerName($(cells[1]).text());
          if (!name) return;
          skaters.push({
            number:   num(numRaw) || null,
            player:   name,
            position: $(cells[2]).text().trim() || "F",
            isRookie,
            isActive,
            gp:  gpIdx  >= 0 ? num($(cells[gpIdx]).text())  : 0,
            g:   gIdx   >= 0 ? num($(cells[gIdx]).text())   : 0,
            a:   aIdx   >= 0 ? num($(cells[aIdx]).text())   : 0,
            pts: ptsIdx >= 0 ? num($(cells[ptsIdx]).text()) : 0,
            ppp:   (ppIdx  >= 0 ? num($(cells[ppIdx]).text())  : 0) + (ppaIdx >= 0 ? num($(cells[ppaIdx]).text()) : 0),
            shp:   (shgIdx >= 0 ? num($(cells[shgIdx]).text()) : 0) + (shaIdx >= 0 ? num($(cells[shaIdx]).text()) : 0),
            gwg:   gwIdx   >= 0 ? num($(cells[gwIdx]).text())   : 0,
            pm:    pmIdx   >= 0 ? num($(cells[pmIdx]).text())   : 0,
            sh:    shIdx   >= 0 ? num($(cells[shIdx]).text())   : 0,
            shPct: shPctIdx >= 0 ? num($(cells[shPctIdx]).text()) : 0,
            pp:    ppIdx   >= 0 ? num($(cells[ppIdx]).text())   : 0,
            ppa:   ppaIdx  >= 0 ? num($(cells[ppaIdx]).text())  : 0,
            shg:   shgIdx  >= 0 ? num($(cells[shgIdx]).text())  : 0,
            sha:   shaIdx  >= 0 ? num($(cells[shaIdx]).text())  : 0,
            pim:   pimIdx  >= 0 ? num($(cells[pimIdx]).text())  : 0,
            sog:   sogIdx  >= 0 ? num($(cells[sogIdx]).text())  : 0,
            soa:   soaIdx  >= 0 ? num($(cells[soaIdx]).text())  : 0,
            soPct: soPctIdx >= 0 ? num($(cells[soPctIdx]).text()) : 0,
          });
        });
      } else if (isGoalie) {
        const goalieIdx = headers.indexOf("GOALIE");
        const gpIdx     = headers.indexOf("GP");
        const wIdx      = headers.indexOf("W");
        const lIdx      = headers.indexOf("L");
        const gaIdx     = headers.indexOf("GA");
        const gaaIdx    = headers.indexOf("GAA");
        const svIdx     = headers.indexOf("SV%");
        const soIdx     = headers.indexOf("SO");
        const sowIdx    = headers.indexOf("SOW");
        const solIdx    = headers.indexOf("SOL");
        const soaIdx    = headers.indexOf("SOA");
        const soPctIdx  = headers.indexOf("SO%");
        const saIdx     = headers.indexOf("SA");
        $(table).find("tr").each((i, row) => {
          if (i === 0) return;
          const cells = $(row).find("td");
          if (cells.length < 3) return;
          // Skip sub-team split rows (empty number cell)
          const numRaw = $(cells[0]).text().replace(/[\u00a0\s]+/g, "").trim();
          if (!numRaw) return;
          const { name, isRookie, isActive } = parsePlayerName($(cells[goalieIdx >= 0 ? goalieIdx : 1]).text());
          if (!name) return;
          goalies.push({
            number:   num(numRaw) || null,
            player:   name,
            position: "G",
            isRookie,
            isActive,
            gp:     gpIdx    >= 0 ? num($(cells[gpIdx]).text())    : 0,
            w:      wIdx     >= 0 ? num($(cells[wIdx]).text())     : 0,
            l:      lIdx     >= 0 ? num($(cells[lIdx]).text())     : 0,
            ga:     gaIdx    >= 0 ? num($(cells[gaIdx]).text())    : 0,
            gaa:    gaaIdx   >= 0 ? num($(cells[gaaIdx]).text())   : 0,
            svPct:  svIdx    >= 0 ? num($(cells[svIdx]).text())    : 0,
            shutouts: soIdx  >= 0 ? num($(cells[soIdx]).text())    : 0,
            sow:    sowIdx   >= 0 ? num($(cells[sowIdx]).text())   : 0,
            sol:    solIdx   >= 0 ? num($(cells[solIdx]).text())   : 0,
            soa:    soaIdx   >= 0 ? num($(cells[soaIdx]).text())   : 0,
            soSvPct: soPctIdx >= 0 ? num($(cells[soPctIdx]).text()) : 0,
            sa:     saIdx    >= 0 ? num($(cells[saIdx]).text())    : 0,
          });
        });
      }
    });

    result[config.id] = { teamId: config.id, skaters, goalies };
  });

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  let changed = 0;

  // Load persisted meta for lastGameId seed
  const metaPath = path.join(DATA_DIR, "meta.json");
  let lastGameId = SEED_GAME_ID;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.lastGameId) lastGameId = meta.lastGameId;
  } catch (_) {}

  console.log("Fetching daily report…");
  const reportHtml = await fetchHTML(DAILY_REPORT_URL);

  // Standings (uses same daily report HTML)
  console.log("Parsing standings…");
  const standings = await scrapeStandings(reportHtml);

  // Merge attendance data into standings
  const attendance = scrapeAttendance(reportHtml);
  standings.forEach((team) => {
    const att = team.teamId ? attendance[team.teamId] : null;
    if (att) {
      team.attendanceGames   = att.attendanceGames;
      team.attendanceTotal   = att.attendanceTotal;
      team.attendanceAverage = att.attendanceAverage;
    }
  });

  // Merge special teams data into standings
  const specialTeams = scrapeSpecialTeams(reportHtml);
  standings.forEach((team) => {
    const st = team.teamId ? specialTeams[team.teamId] : null;
    if (st) {
      team.ppPct            = st.ppPct            ?? null;
      team.ppGoals          = st.ppGoals          ?? null;
      team.ppOpportunities  = st.ppOpportunities  ?? null;
      team.pkPct            = st.pkPct            ?? null;
      team.pkGoalsAllowed   = st.pkGoalsAllowed   ?? null;
      team.timesShorthanded = st.timesShorthanded ?? null;
    }
  });

  if (writeJSON(path.join(DATA_DIR, "standings.json"), { standings, scrapedAt: now })) {
    console.log(`  ✓ standings.json (${standings.length} teams)`);
    changed++;
  } else {
    console.log("  – standings.json unchanged");
  }

  // Per-team player stats (rookie/active flags from daily report)
  console.log("Parsing team player stats…");
  const teamPlayers = scrapeTeamPlayers(reportHtml);
  let playerFilesChanged = 0;
  for (const [teamId, data] of Object.entries(teamPlayers)) {
    if (writeJSON(path.join(PLAYERS_DIR, `${teamId}.json`), { ...data, scrapedAt: now })) {
      playerFilesChanged++;
      changed++;
    }
  }
  console.log(`  ${playerFilesChanged > 0 ? "✓" : "–"} players/ (${Object.keys(teamPlayers).length} teams, ${playerFilesChanged} changed)`);

  // Yesterday's date string for labelling scores (Eastern Time)
  const yd = new Date(nowEastern().getTime() - 86400000);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const ydateStr = `${monthNames[yd.getUTCMonth()]} ${yd.getUTCDate()}, ${yd.getUTCFullYear()}`;

  // Leaders + scores
  console.log("Parsing leaders and scores…");
  const { leaders, scores } = await scrapeLeadersAndScores(reportHtml, ydateStr);

  // Augment leaders with computed stats derived from per-team player data.
  // Cross-reference roster files to exclude recalled_ahl players; loaned players stay in.
  const recalledNames = new Set();
  try {
    for (const f of fs.readdirSync(ROSTERS_DIR)) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(ROSTERS_DIR, f), "utf8"));
        for (const p of (r.roster || [])) {
          if (p.status === "recalled_ahl") recalledNames.add(p.player.toLowerCase());
        }
      } catch {}
    }
  } catch {}

  // Build team abbr lookup
  const teamAbbrMap = {};
  Object.values(TEAMS).forEach((t) => { teamAbbrMap[t.id] = t.abbr; });

  // Flat skater list with team abbr attached
  // Deduplicate traded players: keep only the active entry (current team).
  // If a player has no active entry, keep the one with the most GP.
  const allSkatersRaw = Object.entries(teamPlayers).flatMap(([teamId, t]) => {
    const abbr = teamAbbrMap[parseInt(teamId)] || "";
    return (t.skaters || [])
      .filter((p) => (p.gp ?? 0) > 0)
      .map((p) => ({ ...p, team: abbr }));
  });
  const skatersByName = new Map();
  for (const p of allSkatersRaw) {
    const key = p.player.toLowerCase();
    const existing = skatersByName.get(key);
    if (!existing) { skatersByName.set(key, p); continue; }
    // Prefer active entry; tie-break by most GP
    if (p.isActive !== false && existing.isActive === false) skatersByName.set(key, p);
    else if (p.isActive === existing.isActive && (p.gp ?? 0) > (existing.gp ?? 0)) skatersByName.set(key, p);
  }
  const allSkaters = [...skatersByName.values()];

  // Flat goalie list with team abbr — minimum 10 GP to qualify
  // Same deduplication for traded goalies.
  const allGoaliesRaw = Object.entries(teamPlayers).flatMap(([teamId, t]) => {
    const abbr = teamAbbrMap[parseInt(teamId)] || "";
    return (t.goalies || [])
      .filter((p) => (p.gp ?? 0) >= 10)
      .map((p) => ({ ...p, team: abbr }));
  });
  const goaliesByName = new Map();
  for (const p of allGoaliesRaw) {
    const key = p.player.toLowerCase();
    const existing = goaliesByName.get(key);
    if (!existing) { goaliesByName.set(key, p); continue; }
    if (p.isActive !== false && existing.isActive === false) goaliesByName.set(key, p);
    else if (p.isActive === existing.isActive && (p.gp ?? 0) > (existing.gp ?? 0)) goaliesByName.set(key, p);
  }
  const allGoalies = [...goaliesByName.values()];

  const rankByDesc = (arr, key) => {
    const sorted = [...arr].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
    let rank = 1;
    return sorted.map((p, i) => {
      if (i > 0 && (p[key] ?? 0) !== (sorted[i - 1][key] ?? 0)) rank = i + 1;
      return { rank, name: p.player, team: p.team ?? "", value: p[key] ?? 0, isRookie: p.isRookie ?? false, position: p.position ?? "", ...(p.isActive === false ? { isActive: false } : {}) };
    });
  };

  const rankByAsc = (arr, key) => {
    const sorted = [...arr].sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0));
    let rank = 1;
    return sorted.map((p, i) => {
      if (i > 0 && (p[key] ?? 0) !== (sorted[i - 1][key] ?? 0)) rank = i + 1;
      return { rank, name: p.player, team: p.team ?? "", value: p[key] ?? 0, isRookie: p.isRookie ?? false, position: p.position ?? "", ...(p.isActive === false ? { isActive: false } : {}) };
    });
  };

  // Full league scoring ranks (used as fallback when scraped lists are sparse)
  const computedPoints  = rankByDesc(allSkaters, "pts");
  const computedGoals   = rankByDesc(allSkaters, "g");
  const computedAssists = rankByDesc(allSkaters, "a");

  leaders.allPoints  = computedPoints;
  leaders.allGoals   = computedGoals;
  leaders.allAssists = computedAssists;

  // Always use computed data for goals/assists (scraped lists are often sparse)
  leaders.points  = computedPoints;
  leaders.goals   = computedGoals;
  leaders.assists = computedAssists;

  // Compute all goalie leaders from player data
  leaders.gaa       = rankByAsc(allGoalies, "gaa");
  leaders.svPct     = rankByDesc(allGoalies, "svPct");
  leaders.shutouts  = rankByDesc(allGoalies.filter((p) => (p.shutouts ?? 0) > 0), "shutouts");
  leaders.goalieWins = rankByDesc(allGoalies, "w");
  leaders.soRecord  = rankByDesc(allGoalies.filter((p) => (p.soa ?? 0) >= 3), "soSvPct");
  leaders.gwg        = rankByDesc(allSkaters.filter((p) => (p.gwg ?? 0) > 0), "gwg");
  leaders.plusMinus    = rankByDesc(allSkaters, "pm");
  leaders.shots        = rankByDesc(allSkaters.filter((p) => (p.sh ?? 0) > 0), "sh");
  leaders.shootingPct  = rankByDesc(allSkaters.filter((p) => (p.sh ?? 0) >= 50), "shPct");
  leaders.ppg          = rankByDesc(allSkaters.filter((p) => (p.pp ?? 0) > 0), "pp");
  leaders.ppp          = rankByDesc(allSkaters.filter((p) => ((p.pp ?? 0) + (p.ppa ?? 0)) > 0), "ppp");
  leaders.ppa          = rankByDesc(allSkaters.filter((p) => (p.ppa ?? 0) > 0), "ppa");
  leaders.shg          = rankByDesc(allSkaters.filter((p) => (p.shg ?? 0) > 0), "shg");
  leaders.shp          = rankByDesc(allSkaters.filter((p) => ((p.shg ?? 0) + (p.sha ?? 0)) > 0), "shp");
  leaders.sha          = rankByDesc(allSkaters.filter((p) => (p.sha ?? 0) > 0), "sha");
  leaders.pim          = rankByDesc(allSkaters.filter((p) => (p.pim ?? 0) > 0), "pim");
  leaders.soGoals      = rankByDesc(allSkaters.filter((p) => (p.sog ?? 0) > 0), "sog");
  leaders.soPct        = rankByDesc(allSkaters.filter((p) => (p.soa ?? 0) >= 3), "soPct");
  leaders.rookiePts  = rankByDesc(allSkaters.filter((p) => p.isRookie), "pts");
  leaders.rookieG    = rankByDesc(allSkaters.filter((p) => p.isRookie), "g");
  leaders.rookieA    = rankByDesc(allSkaters.filter((p) => p.isRookie), "a");
  leaders.dPts       = rankByDesc(allSkaters.filter((p) => p.position === "D"), "pts");
  leaders.dGoals     = rankByDesc(allSkaters.filter((p) => p.position === "D"), "g");

  // Build lookup maps from player name for enriching and filtering scraped leader entries.
  // For traded players, prefer the active entry so inactive old-team entries don't override.
  const playerMeta = new Map();
  for (const [, t] of Object.entries(teamPlayers)) {
    for (const p of (t.skaters || [])) {
      const existing = playerMeta.get(p.player);
      if (!existing || (p.isActive !== false && !existing.isActive)) {
        playerMeta.set(p.player, { isRookie: p.isRookie ?? false, position: p.position ?? "F", isActive: p.isActive !== false });
      }
    }
    for (const p of (t.goalies || [])) {
      const existing = playerMeta.get(p.player);
      if (!existing || (p.isActive !== false && !existing.isActive)) {
        playerMeta.set(p.player, { isRookie: p.isRookie ?? false, position: "G", isActive: p.isActive !== false });
      }
    }
  }
  // Compute minors/majors from persistent penalty-stats.json (accumulated across scraper runs)
  let penStats;
  try { penStats = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "penalty-stats.json"), "utf8")); }
  catch (_) { penStats = { players: {} }; }

  // Build abbreviated-name → full-name lookup (boxscore penalties use "T. Inamoto", player data uses "Takumi Inamoto")
  const abbrToFull = new Map();
  for (const [name] of playerMeta) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      const abbr = parts[0][0] + ". " + parts.slice(1).join(" ");
      if (abbrToFull.has(abbr)) abbrToFull.set(abbr, null); // ambiguous
      else abbrToFull.set(abbr, name);
    }
  }

  // Aggregate penalty stats per player across all teams (trades mid-season)
  // and find their current team from playerMeta/allSkaters
  const playerAbbrToCurrentTeam = new Map();
  for (const s of allSkaters) {
    const parts = s.player.split(" ");
    if (parts.length >= 2) {
      const abbr = parts[0][0] + ". " + parts.slice(1).join(" ");
      playerAbbrToCurrentTeam.set(abbr, s.team); // last active team wins
    }
  }

  const penaltyLeaders = (statKey) => {
    // Sum stats across all teams for same abbreviated name
    const playerTotals = {};
    for (const [key, stats] of Object.entries(penStats.players)) {
      const [abbrName] = key.split("|");
      if (abbrName.startsWith("Served by ")) continue; // skip "Served by" entries
      if ((stats[statKey] ?? 0) === 0) continue;
      if (!playerTotals[abbrName]) playerTotals[abbrName] = 0;
      playerTotals[abbrName] += stats[statKey];
    }
    const entries = Object.entries(playerTotals)
      .map(([abbrName, value]) => {
        const fullName = abbrToFull.get(abbrName) || abbrName;
        const team = playerAbbrToCurrentTeam.get(abbrName) || "";
        const meta = playerMeta.get(fullName);
        return { name: fullName, team, value, isRookie: meta?.isRookie ?? false, position: meta?.position ?? "", ...(meta?.isActive === false ? { isActive: false } : {}) };
      })
      .filter((e) => e.team) // must have a current team (still active in league)
      .sort((a, b) => b.value - a.value);
    let rank = 1;
    return entries.map((e, i) => {
      if (i > 0 && e.value !== entries[i - 1].value) rank = i + 1;
      return { rank, ...e };
    });
  };

  leaders.minors = penaltyLeaders("minors");
  leaders.majors = penaltyLeaders("majors");

  for (const key of Object.keys(leaders)) {
    leaders[key] = leaders[key]
      .map((entry) => {
        if (entry.isRookie !== undefined) return entry; // already enriched (computed entries)
        const meta = playerMeta.get(entry.name);
        return meta ? { ...entry, isRookie: meta.isRookie, position: meta.position, ...(meta.isActive === false ? { isActive: false } : {}) } : { ...entry, isRookie: false, position: "" };
      });
  }

  if (writeJSON(path.join(DATA_DIR, "leaders.json"), { leaders, scrapedAt: now })) {
    console.log(`  ✓ leaders.json`);
    changed++;
  } else {
    console.log("  – leaders.json unchanged");
  }

  // Upcoming games
  console.log("Parsing upcoming games…");
  const upcomingGames = scrapeUpcomingGames(reportHtml);
  if (writeJSON(path.join(DATA_DIR, "upcoming.json"), { games: upcomingGames, scrapedAt: now })) {
    console.log(`  ✓ upcoming.json (${upcomingGames.length} games)`);
    changed++;
  } else {
    console.log("  – upcoming.json unchanged");
  }

  // Resolve game IDs by probing HockeyTech game report pages
  console.log("Resolving game IDs…");
  const { scores: resolvedScores, maxId } = await resolveGameIds(scores, lastGameId);
  const newLastGameId = Math.max(lastGameId, maxId);

  // Merge new scores into rolling history (keep last 150 so every team has ~5 games)
  const scoresPath = path.join(DATA_DIR, "scores.json");
  let existingScores = [];
  try { existingScores = JSON.parse(fs.readFileSync(scoresPath, "utf8")).scores || []; } catch (_) {}

  // Remove existing entries whose date falls within the new scrape's date range
  // but were not produced by this scrape (stale entries from prior bad scrapes)
  const newDates = new Set(resolvedScores.map(s => s.date));
  // Also remove entries with malformed team names (from prior parser bug)
  const dayPrefixRe = /^(MON|TUE|WED|THU|FRI|SAT|SUN),?\s/i;
  const dayAnywhereRe = /(MON|TUE|WED|THU|FRI|SAT|SUN),?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d/i;
  // Build a set of matchup keys for all entries that have a gameId (across all dates)
  // so we can drop orphaned no-gameId duplicates from prior bad scrapes
  const allWithIdKeys = new Set(
    existingScores.filter(s => s.gameId)
      .map(s => `${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`)
  );
  const cleanedExisting = existingScores.filter(s => {
    // Drop entries with corrupted team names (day-of-week text in team name)
    if (dayPrefixRe.test(s.visitingTeam) || dayPrefixRe.test(s.homeTeam)) return false;
    if (dayAnywhereRe.test(s.visitingTeam) || dayAnywhereRe.test(s.homeTeam)) return false;
    // Drop no-gameId entries that are duplicates of resolved entries (likely from a prior bad scrape)
    if (!s.gameId) {
      const key = `${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`;
      if (allWithIdKeys.has(key)) return false;
    }
    // Keep entries outside the new scrape's date range
    if (!newDates.has(s.date)) return true;
    // Within the range: keep only if it has a gameId (already resolved)
    return !!s.gameId;
  });

  const existingIds = new Set(cleanedExisting.filter(s => s.gameId).map(s => s.gameId));
  // Also drop null-gameId entries from new scrape that match any resolved entry by
  // teams+score (without date), since date can be off by a day due to timezone drift
  const allResolvedKeys = new Set(
    [...cleanedExisting, ...resolvedScores].filter(s => s.gameId)
      .map(s => `${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`)
  );
  const newScores = resolvedScores.filter(s => {
    if (s.gameId) return !existingIds.has(s.gameId);
    const key = `${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`;
    return !allResolvedKeys.has(key);
  });
  const raw = [...newScores, ...cleanedExisting].sort((a, b) => new Date(b.date) - new Date(a.date));
  // Deduplicate by gameId first (same gameId appearing with different dates)
  const seenGameIds = new Set();
  const dedupedByGameId = raw.filter(s => {
    if (!s.gameId) return true;
    if (seenGameIds.has(s.gameId)) return false;
    seenGameIds.add(s.gameId);
    return true;
  });
  // Deduplicate: prefer entry with gameId over null-gameId for same game
  // Use teams+score key (without date) to catch date-drift duplicates
  const resolvedMatchKeys = new Set(
    dedupedByGameId.filter(s => s.gameId)
      .map(s => `${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`)
  );
  const mergedScores = dedupedByGameId
    .filter(s => s.gameId || !resolvedMatchKeys.has(`${s.visitingTeam}|${s.homeTeam}|${s.visitingScore}|${s.homeScore}|${s.overtime || ""}`))
    .slice(0, 1500);

  if (writeJSON(scoresPath, { scores: mergedScores, scrapedAt: now })) {
    const withId = mergedScores.filter((s) => s.gameId).length;
    console.log(`  ✓ scores.json (${mergedScores.length} games, ${withId} with box score IDs)`);
    changed++;
  } else {
    console.log("  – scores.json unchanged");
  }

  // Fetch box scores for yesterday's matched games + re-fetch any in-progress ones
  const existingBoxscores = fs.readdirSync(BOXSCORES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(BOXSCORES_DIR, f), "utf8")); }
      catch (_) { return null; }
    })
    .filter(Boolean);

  // Games that need a fresh fetch: new matches + previously in-progress
  const existingBoxscoreIds = new Set(existingBoxscores.map((b) => b.gameInfo?.gameId));
  const pendingGames = existingBoxscores.filter((b) => !b.isFinal);
  const newGames = resolvedScores.filter((s) => s.gameId && !existingBoxscoreIds.has(s.gameId));

  if (newGames.length > 0 || pendingGames.length > 0) {
    console.log(`Fetching ${newGames.length} new + ${pendingGames.length} in-progress box score(s)…`);
    const toFetch = [
      ...newGames.map((s) => s.gameId),
      ...pendingGames.map((b) => b.gameInfo?.gameId).filter(Boolean),
    ];
    for (const gameId of [...new Set(toFetch)]) {
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

  // Build top-games.json and sellouts.json from all boxscores (before pruning)
  const allCurrentBoxscores = fs.readdirSync(BOXSCORES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(BOXSCORES_DIR, f), "utf8")); }
      catch (_) { return null; }
    })
    .filter(Boolean);
  // Build persistent game-attendance.json (merge new games into existing)
  const gameAttPath = path.join(DATA_DIR, "game-attendance.json");
  let gameAttData;
  try { gameAttData = JSON.parse(fs.readFileSync(gameAttPath, "utf8")); }
  catch (_) { gameAttData = { games: [] }; }
  const existingGameIds = new Set(gameAttData.games.map((g) => g.gameId));
  const newGamesAtt = allCurrentBoxscores
    .filter((b) => b.gameInfo?.attendance > 0 && b.gameInfo?.gameId && !existingGameIds.has(b.gameInfo.gameId))
    .map((b) => {
      const homeConfig = findTeamByName(b.gameInfo.homeTeam);
      return {
        gameId: b.gameInfo.gameId,
        homeTeam: b.gameInfo.homeTeam,
        homeTeamId: homeConfig?.id || null,
        visitingTeam: b.gameInfo.visitingTeam,
        date: b.gameInfo.date,
        arena: b.gameInfo.arena,
        attendance: b.gameInfo.attendance,
        score: `${b.gameInfo.finalScore?.visiting ?? "?"}-${b.gameInfo.finalScore?.home ?? "?"}`,
      };
    });
  gameAttData.games = [...gameAttData.games, ...newGamesAtt]
    .sort((a, b) => b.attendance - a.attendance);
  gameAttData.scrapedAt = now;
  if (writeJSON(gameAttPath, gameAttData)) {
    console.log(`  ✓ game-attendance.json (${gameAttData.games.length} games, ${newGamesAtt.length} new)`);
    changed++;
  }

  // Build persistent penalty-stats.json (merge new boxscore penalties into existing)
  const penaltyStatsPath = path.join(DATA_DIR, "penalty-stats.json");
  let penaltyStats;
  try { penaltyStats = JSON.parse(fs.readFileSync(penaltyStatsPath, "utf8")); }
  catch (_) { penaltyStats = { processedGames: [], players: {} }; }
  const processedGameSet = new Set(penaltyStats.processedGames || []);
  const cityAbbrMap = {};
  Object.values(TEAMS).forEach((t) => { cityAbbrMap[t.city.toLowerCase()] = t.abbr; });
  let newPenaltyGames = 0;
  for (const bs of allCurrentBoxscores) {
    const gid = bs.gameInfo?.gameId;
    if (!gid || !bs.isFinal || !bs.penalties || processedGameSet.has(gid)) continue;
    processedGameSet.add(gid);
    newPenaltyGames++;
    const teamMap = {
      V: cityAbbrMap[(bs.gameInfo.visitingTeam || "").toLowerCase()] || "",
      H: cityAbbrMap[(bs.gameInfo.homeTeam || "").toLowerCase()] || "",
    };
    for (const pen of bs.penalties) {
      const name = cleanName(pen.player || "");
      const abbr = teamMap[pen.team] || "";
      if (!name || !abbr) continue;
      // Skip bench minors and "served by" penalties — not individual penalties
      const inf = (pen.infraction || "").toLowerCase();
      if (inf.includes("bench")) continue;
      if (name.toLowerCase().startsWith("served by")) continue;
      const key = `${name}|${abbr}`;
      if (!penaltyStats.players[key]) penaltyStats.players[key] = { minors: 0, majors: 0 };
      if (pen.minutes === 2) penaltyStats.players[key].minors += 1;
      if (pen.minutes === 4) penaltyStats.players[key].minors += 2; // double minor
      if (pen.minutes === 5) penaltyStats.players[key].majors += 1;
    }
  }
  penaltyStats.processedGames = [...processedGameSet];
  penaltyStats.scrapedAt = now;
  if (writeJSON(penaltyStatsPath, penaltyStats)) {
    console.log(`  ✓ penalty-stats.json (${Object.keys(penaltyStats.players).length} players, ${newPenaltyGames} new games)`);
    changed++;
  }

  // Build persistent fighting-majors.json (merge new boxscore fights into existing)
  const fightingMajorsPath = path.join(DATA_DIR, "fighting-majors.json");
  let fightingMajorsData;
  try { fightingMajorsData = JSON.parse(fs.readFileSync(fightingMajorsPath, "utf8")); }
  catch (_) { fightingMajorsData = { processedGames: [], leaders: [] }; }
  const fmProcessedSet = new Set(fightingMajorsData.processedGames || []);
  // Build a map from existing leaders for fast lookup
  const fmPlayerMap = new Map();
  for (const p of (fightingMajorsData.leaders || [])) {
    const key = `${p.name}|${p.team}`;
    fmPlayerMap.set(key, { ...p, games: p.games || [] });
  }
  let newFmGames = 0;
  for (const bs of allCurrentBoxscores) {
    const gid = bs.gameInfo?.gameId;
    if (!gid || !bs.isFinal || !bs.penalties || fmProcessedSet.has(gid)) continue;
    fmProcessedSet.add(gid);
    newFmGames++;
    for (const pen of bs.penalties) {
      if (!pen.infraction || !pen.infraction.toLowerCase().includes("fight")) continue;
      const teamName = pen.team === "V" ? bs.gameInfo.visitingTeam : bs.gameInfo.homeTeam;
      const key = `${pen.player}|${teamName}`;
      if (!fmPlayerMap.has(key)) {
        fmPlayerMap.set(key, { name: pen.player, team: teamName, fightingMajors: 0, games: [] });
      }
      const entry = fmPlayerMap.get(key);
      entry.fightingMajors++;
      if (!entry.games.includes(gid)) {
        entry.games.push(gid);
      }
    }
  }
  const fmResults = Array.from(fmPlayerMap.values())
    .sort((a, b) => b.fightingMajors - a.fightingMajors || a.name.localeCompare(b.name));
  const fmOutput = {
    generatedAt: now,
    processedGames: [...fmProcessedSet],
    leaders: fmResults,
  };
  if (writeJSON(fightingMajorsPath, fmOutput)) {
    console.log(`  ✓ fighting-majors.json (${fmResults.length} players, ${newFmGames} new games)`);
    changed++;
  }

  // Write meta (persist lastGameId for next run's seed)
  writeJSON(metaPath, {
    updatedAt:   now,
    lastGameId:  newLastGameId,
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
