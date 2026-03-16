#!/usr/bin/env node
/**
 * Backfill missing box score JSON files.
 * Reads scores.json, finds game IDs without a boxscores/{id}.json, and fetches them.
 *
 * Usage: node scripts/backfill-boxscores.js [--delay 600]
 *   --delay  ms between requests (default 600)
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const BOXSCORES_DIR = path.join(DATA_DIR, "boxscores");

const BOXSCORE_BASE =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

const delayArg = process.argv.indexOf("--delay");
const DELAY_MS = delayArg >= 0 ? parseInt(process.argv[delayArg + 1]) || 600 : 600;

// ─── Helpers (copied from scrape.js) ─────────────────────────────────────────

function nt(s) { return (s || "").replace(/[\u00a0\s]+/g, " ").trim(); }

function directRows($, table) {
  return $(table).children("tbody").children("tr").add($(table).children("tr"));
}

function findTable($, selector, keyword) {
  let found = null;
  $(selector).each((_, t) => {
    const firstCell = nt(directRows($, t).first().find("td").first().text());
    if (firstCell.toUpperCase().includes(keyword.toUpperCase())) { found = t; return false; }
  });
  return found;
}

function rowCells($, table, rowIndex) {
  return directRows($, table).eq(rowIndex).find("td")
    .map((_, td) => nt($(td).text())).get();
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function writeJSON(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  try {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing === json) return false;
  } catch (_) {}
  fs.writeFileSync(filePath, json, "utf8");
  return true;
}

async function scrapeBoxscore(gameId) {
  const html = await fetchHTML(`${BOXSCORE_BASE}${gameId}`);
  const $ = cheerio.load(html);

  const scoringTable = findTable($, "table.tSides", "SCORING");
  const sRow1 = scoringTable ? rowCells($, scoringTable, 1) : [];
  const sRow2 = scoringTable ? rowCells($, scoringTable, 2) : [];
  const visitingTeam  = sRow1[0] || "";
  const homeTeam      = sRow2[0] || "";
  const visitingScore = parseInt(sRow1[sRow1.length - 1]) || 0;
  const homeScore     = parseInt(sRow2[sRow2.length - 1]) || 0;

  let arena = "", date = "";
  const headerCellHtml = $("table").first().children("tbody").children("tr").first()
    .children("td").eq(1).html() || "";
  const headerLines = headerCellHtml.split(/<br\s*\/?>/i)
    .map((l) => nt(cheerio.load(l).text())).filter(Boolean);
  for (const line of headerLines) {
    if (/^[A-Z][a-z]{2}\s+\d/.test(line)) { date = line; }
    else if (line && !line.match(/^ECHL Game/i) && !line.match(/\d+\s+at\s+/)) { arena = line; }
  }

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

  const allSkaters = [...(skaterStats.visiting || []), ...(skaterStats.home || [])];
  const enrichedStars = stars.map((s) => {
    const p = allSkaters.find((p) => p.name === s.name);
    return p ? { ...s, g: p.g, a: p.a, pts: p.pts } : s;
  });

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

// ─── Main ─────────────────────────────────────────────────────────────────────

const scoresData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "scores.json"), "utf8"));
const allIds = (scoresData.scores || [])
  .filter((g) => g.gameId)
  .map((g) => g.gameId)
  .sort((a, b) => a - b);

const existing = new Set(
  fs.readdirSync(BOXSCORES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseInt(f))
);

const missing = allIds.filter((id) => !existing.has(id));

if (missing.length === 0) {
  console.log("All box scores are already present.");
  process.exit(0);
}

console.log(`Fetching ${missing.length} missing box scores (${DELAY_MS}ms delay)…`);

let ok = 0, fail = 0;
const errors = [];

for (let i = 0; i < missing.length; i++) {
  const gameId = missing[i];
  const pct = (((i + 1) / missing.length) * 100).toFixed(1);
  process.stdout.write(`  [${i + 1}/${missing.length}] (${pct}%) game ${gameId} … `);
  try {
    const bs = await scrapeBoxscore(gameId);
    writeJSON(path.join(BOXSCORES_DIR, `${gameId}.json`), bs);
    console.log("✓");
    ok++;
  } catch (err) {
    console.log(`✗ ${err.message}`);
    errors.push({ gameId, error: err.message });
    fail++;
  }
  if (i < missing.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nDone. ${ok} written, ${fail} failed.`);
if (errors.length) {
  console.log("Failed IDs:");
  errors.forEach(({ gameId, error }) => console.log(`  ${gameId}: ${error}`));
}
