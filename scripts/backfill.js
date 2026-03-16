#!/usr/bin/env node
/**
 * One-time backfill script — scrapes game scores for the full 2025-26 ECHL
 * season by probing HockeyTech game report pages and merges them into
 * client/public/data/scores.json.
 *
 * Usage: node scripts/backfill.js
 *
 * The script probes game IDs in a range (START_ID → END_ID) in batches of 5
 * concurrent requests. Each game report page has a title like
 * "Gamesheet: Visiting at Home - Mar 1, 2026" so we can filter by date and
 * extract teams + final score without needing the daily report.
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, "..", "client", "public", "data");
const SCORES_PATH = path.join(DATA_DIR, "scores.json");

const BOXSCORE_BASE =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

// Probe window — covers the full 2025-26 ECHL season (started Oct 17, 2025).
// IDs are global across HockeyTech leagues; Oct 2025 games ≈ ID 20000 range.
const START_ID  = 19000;
const END_ID    = 25500;
const BATCH     = 5;    // concurrent requests per batch
const BATCH_DELAY_MS = 50; // pause between batches

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseGameDate(str) {
  if (!str) return null;
  const m = str.trim().match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const mo = MONTH_NAMES.indexOf(m[1]);
  if (mo < 0) return null;
  return new Date(Date.UTC(parseInt(m[3]), mo, parseInt(m[2])));
}

function nt(s) { return (s || "").replace(/[\u00a0\s]+/g, " ").trim(); }
function directRows($, table) {
  return $(table).children("tbody").children("tr").add($(table).children("tr"));
}

async function fetchGameInfo(gameId) {
  let html;
  try {
    const res = await fetch(`${BOXSCORE_BASE}${gameId}`, { headers: HEADERS, timeout: 15000 });
    if (!res.ok) return null;
    html = await res.text();
  } catch (_) { return null; }

  // Only process actual game reports
  const titleM = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleM || !titleM[1].trim().startsWith("Gamesheet:")) return null;

  // "Gamesheet: Visiting at Home - Mar 13, 2026"
  const tp = titleM[1].trim().match(/^Gamesheet:\s+(.+?)\s+at\s+(.+?)\s+-\s+(.+)$/);
  if (!tp) return null;

  const visitingTeam = tp[1].trim();
  const homeTeam     = tp[2].trim();
  const dateStr      = tp[3].trim();
  const date         = parseGameDate(dateStr);
  if (!date) return null;

  const $ = cheerio.load(html);

  // Extract final score from the tSides SCORING table
  // Row 0 = header, Row 1 = visiting, Row 2 = home
  // Columns: Team | P1 | P2 | P3 | [OT] | [SO] | Total
  let visitingScore = null, homeScore = null, overtime = null;

  $("table.tSides").each((_, table) => {
    const rows = directRows($, table);
    const firstCell = nt(rows.first().find("td").first().text());
    if (!firstCell.toUpperCase().includes("SCORING")) return;

    const headerCells = rows.eq(0).find("td").map((_, td) => nt($(td).text()).toUpperCase()).get();
    const row1 = rows.eq(1).find("td").map((_, td) => nt($(td).text())).get();
    const row2 = rows.eq(2).find("td").map((_, td) => nt($(td).text())).get();

    if (row1.length < 2 || row2.length < 2) return false;

    visitingScore = parseInt(row1[row1.length - 1]) || 0;
    homeScore     = parseInt(row2[row2.length - 1]) || 0;

    // Detect OT/SO from header columns (anything beyond P1 P2 P3 before Total)
    if (headerCells.includes("SO"))  overtime = "SO";
    else if (headerCells.includes("OT")) overtime = "OT";
    // Fallback: if column count implies extra period
    else if (row1.length >= 6) overtime = "OT";

    return false; // stop after first match
  });

  if (visitingScore === null) return null; // couldn't parse score

  const formattedDate = `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;

  return {
    visitingTeam,
    homeTeam,
    visitingScore,
    homeScore,
    overtime,
    score: `${visitingScore}-${homeScore}${overtime ? ` (${overtime})` : ""}`,
    gameId,
    date: formattedDate,
    _date: date, // used for cutoff check, stripped before writing
  };
}

async function main() {
  // Cutoff = ECHL 2025-26 season start (Oct 17, 2025); use Oct 1 as safe buffer
  const cutoff    = new Date("2025-10-01T00:00:00Z");
  const cutoffStr = "Oct 1, 2025";

  console.log(`Backfilling full 2025-26 ECHL season scores (from ${cutoffStr})`);
  console.log(`Probing game IDs ${START_ID}–${END_ID} in batches of ${BATCH}…\n`);

  // Load existing scores to skip already-known game IDs
  let existingScores = [];
  try {
    existingScores = JSON.parse(fs.readFileSync(SCORES_PATH, "utf8")).scores || [];
  } catch (_) {}
  const existingIds = new Set(existingScores.filter(s => s.gameId).map(s => s.gameId));

  const found = [];
  let alreadyHave = 0, beforeCutoff = 0, notFound = 0;

  for (let id = START_ID; id <= END_ID; id += BATCH) {
    const batchIds = Array.from(
      { length: Math.min(BATCH, END_ID - id + 1) },
      (_, i) => id + i
    ).filter(bid => !existingIds.has(bid));

    // Count skipped IDs in this batch
    alreadyHave += Math.min(BATCH, END_ID - id + 1) - batchIds.length;

    if (batchIds.length === 0) continue;

    const results = await Promise.all(batchIds.map(bid => fetchGameInfo(bid)));

    for (let j = 0; j < batchIds.length; j++) {
      const bid  = batchIds[j];
      const info = results[j];

      if (!info) { notFound++; continue; }

      if (info._date < cutoff) {
        beforeCutoff++;
        continue;
      }

      const { _date, ...game } = info;
      found.push(game);
      const otStr = game.overtime ? ` (${game.overtime})` : "";
      console.log(`  ✓ [${bid}] ${game.date}: ${game.visitingTeam} ${game.visitingScore}–${game.homeScore} ${game.homeTeam}${otStr}`);
    }

    // Progress every 100 IDs
    if ((id - START_ID) % 100 === 0) {
      const pct = Math.round((id - START_ID) / (END_ID - START_ID) * 100);
      console.log(`  … ${pct}% (${id}/${END_ID}), ${found.length} games found so far`);
    }

    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Found:        ${found.length} new games`);
  console.log(`Already had:  ${alreadyHave} game IDs`);
  console.log(`Before cutoff: ${beforeCutoff}`);
  console.log(`Not found:    ${notFound}`);

  if (found.length === 0) {
    console.log("\nNothing new to write.");
    return;
  }

  // Sort newest first, merge, deduplicate, cap at 1500 (full season)
  found.sort((a, b) => new Date(b.date) - new Date(a.date));
  const merged = [...found, ...existingScores]
    .filter((s, i, arr) => !s.gameId || arr.findIndex(x => x.gameId === s.gameId) === i)
    .slice(0, 1500);

  fs.writeFileSync(SCORES_PATH, JSON.stringify({ scores: merged, scrapedAt: new Date().toISOString() }, null, 2), "utf8");
  console.log(`\n✓ Wrote ${merged.length} total games to scores.json`);
}

main().catch(err => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
