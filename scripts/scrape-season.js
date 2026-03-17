#!/usr/bin/env node
/**
 * One-time scrape of ALL games for the 2025-26 ECHL season.
 *
 * Probes HockeyTech game report pages across a wide ID range and keeps every
 * game dated from October 17 2025 (season opener) onward.  Results are merged
 * into client/public/data/scores.json.
 *
 * Usage:  node scripts/scrape-season.js
 *
 * Optional env vars:
 *   START_ID  – first game ID to probe  (default 24000)
 *   END_ID    – last  game ID to probe  (default 25600)
 *   DELAY_MS  – ms between requests     (default 120)
 *   CONCURRENCY – parallel requests     (default 5)
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const SCORES_PATH = path.join(DATA_DIR, "scores.json");

const BOXSCORE_BASE =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

const START_ID    = parseInt(process.env.START_ID) || 24000;
const END_ID      = parseInt(process.env.END_ID)   || 25600;
const DELAY_MS    = parseInt(process.env.DELAY_MS) || 80;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 10;

// Season opener: October 17, 2025
const SEASON_START = new Date(Date.UTC(2025, 9, 17)); // months are 0-indexed

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseGameDate(str) {
  if (!str) return null;
  const m = str.trim().match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const mo = MONTH_NAMES.indexOf(m[1]);
  if (mo < 0) return null;
  return new Date(Date.UTC(parseInt(m[3]), mo, parseInt(m[2])));
}

function nt(s) {
  return (s || "").replace(/[\u00a0\s]+/g, " ").trim();
}

function directRows($, table) {
  return $(table)
    .children("tbody")
    .children("tr")
    .add($(table).children("tr"));
}

// ── Fetch a single game ─────────────────────────────────────────────────────

async function fetchGameInfo(gameId) {
  let html;
  try {
    const res = await fetch(`${BOXSCORE_BASE}${gameId}`, {
      headers: HEADERS,
      timeout: 5000,
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const titleM = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleM || !titleM[1].trim().startsWith("Gamesheet:")) return null;

  // "Gamesheet: Visiting at Home - Mar 13, 2026"
  const tp = titleM[1]
    .trim()
    .match(/^Gamesheet:\s+(.+?)\s+at\s+(.+?)\s+-\s+(.+)$/);
  if (!tp) return null;

  const visitingTeam = tp[1].trim();
  const homeTeam = tp[2].trim();
  const dateStr = tp[3].trim();
  const date = parseGameDate(dateStr);
  if (!date) return null;

  const $ = cheerio.load(html);

  let visitingScore = null,
    homeScore = null,
    overtime = null;

  $("table.tSides").each((_, table) => {
    const rows = directRows($, table);
    const firstCell = nt(rows.first().find("td").first().text());
    if (!firstCell.toUpperCase().includes("SCORING")) return;

    const headerCells = rows
      .eq(0)
      .find("td")
      .map((_, td) => nt($(td).text()).toUpperCase())
      .get();
    const row1 = rows
      .eq(1)
      .find("td")
      .map((_, td) => nt($(td).text()))
      .get();
    const row2 = rows
      .eq(2)
      .find("td")
      .map((_, td) => nt($(td).text()))
      .get();

    if (row1.length < 2 || row2.length < 2) return false;

    visitingScore = parseInt(row1[row1.length - 1]) || 0;
    homeScore = parseInt(row2[row2.length - 1]) || 0;

    if (headerCells.includes("SO")) overtime = "SO";
    else if (headerCells.includes("OT")) overtime = "OT";
    else if (row1.length >= 6) overtime = "OT";

    return false;
  });

  if (visitingScore === null) return null;

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
    _date: date,
  };
}

// ── Batch fetch with concurrency ────────────────────────────────────────────

async function batchFetch(ids, existingIds) {
  const results = [];
  let done = 0;
  const total = ids.length;
  const skipped = { existing: 0, beforeSeason: 0, notFound: 0 };

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (id) => {
      if (existingIds.has(id)) {
        skipped.existing++;
        return null;
      }
      const info = await fetchGameInfo(id);
      return { id, info };
    });

    const settled = await Promise.all(promises);

    for (const result of settled) {
      if (!result) continue;
      const { id, info } = result;

      if (!info) {
        skipped.notFound++;
        continue;
      }

      if (info._date < SEASON_START) {
        skipped.beforeSeason++;
        continue;
      }

      const { _date, ...game } = info;
      results.push(game);
    }

    done += batch.length;
    const pct = ((done / total) * 100).toFixed(1);
    const found = results.length;
    process.stdout.write(
      `\r  Progress: ${done}/${total} IDs checked (${pct}%) — ${found} games found`
    );

    if (i + CONCURRENCY < ids.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(""); // newline after progress
  return { results, skipped };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  ECHL 2025-26 Full Season Scrape                ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Season start:  Oct 17, 2025`);
  console.log(`  ID range:      ${START_ID} → ${END_ID}`);
  console.log(`  Concurrency:   ${CONCURRENCY} parallel requests`);
  console.log(`  Delay:         ${DELAY_MS}ms between batches`);
  console.log();

  // Load existing scores
  let existingScores = [];
  try {
    existingScores =
      JSON.parse(fs.readFileSync(SCORES_PATH, "utf8")).scores || [];
  } catch {
    // no existing file
  }
  const existingIds = new Set(
    existingScores.filter((s) => s.gameId).map((s) => s.gameId)
  );
  console.log(`  Existing scores: ${existingScores.length} (${existingIds.size} with game IDs)`);
  console.log();

  // Build list of IDs to probe
  const ids = [];
  for (let id = START_ID; id <= END_ID; id++) {
    ids.push(id);
  }

  const { results, skipped } = await batchFetch(ids, existingIds);

  console.log();
  console.log("─────────────────────────────────────────");
  console.log(`  New games found:    ${results.length}`);
  console.log(`  Already had:        ${skipped.existing}`);
  console.log(`  Before season:      ${skipped.beforeSeason}`);
  console.log(`  Not found/invalid:  ${skipped.notFound}`);

  if (results.length === 0) {
    console.log("\n  Nothing new to write.");
    return;
  }

  // Sort newest first, merge with existing, deduplicate, keep all
  results.sort((a, b) => new Date(b.date) - new Date(a.date));

  const merged = [...results, ...existingScores].filter(
    (s, i, arr) => !s.gameId || arr.findIndex((x) => x.gameId === s.gameId) === i
  );

  // Also deduplicate games without gameId by date+teams+score
  const seen = new Set();
  const deduped = merged.filter((g) => {
    if (g.gameId) return true;
    const key = `${g.date}|${g.visitingTeam}|${g.homeTeam}|${g.score}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort all by date descending
  deduped.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    SCORES_PATH,
    JSON.stringify(
      { scores: deduped, scrapedAt: new Date().toISOString() },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\n  ✓ Wrote ${deduped.length} total games to scores.json`);

  // Print date range summary
  const dates = deduped.map((g) => new Date(g.date)).sort((a, b) => a - b);
  if (dates.length) {
    const fmt = (d) =>
      `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    console.log(`  Date range: ${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}`);
  }
}

main().catch((err) => {
  console.error("Season scrape failed:", err.message);
  process.exit(1);
});
