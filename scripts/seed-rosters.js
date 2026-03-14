#!/usr/bin/env node
/**
 * One-time roster seeder — scrapes echl.com/teams/{slug} for all 30 teams
 * and writes initial roster JSON files.
 *
 * Usage: node scripts/seed-rosters.js
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const ROSTERS_DIR = path.join(DATA_DIR, "rosters");

fs.mkdirSync(ROSTERS_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

// ─── Team slug mapping (internal ID → echl.com slug) ─────────────────────────

const TEAM_SLUGS = {
  74:  "adirondack-thunder",
  66:  "allen-americans",
  10:  "atlanta-gladiators",
  107: "bloomington-bison",
  5:   "cincinnati-cyclones",
  8:   "florida-everblades",
  60:  "fort-wayne-komets",
  108: "greensboro-gargoyles",
  52:  "greenville-swamp-rabbits",
  11:  "idaho-steelheads",
  65:  "indy-fuel",
  98:  "iowa-heartlanders",
  79:  "jacksonville-icemen",
  53:  "kalamazoo-wings",
  56:  "kansas-city-mavericks",
  101: "maine-mariners",
  63:  "norfolk-admirals",
  13:  "orlando-solar-bears",
  85:  "rapid-city-rush",
  55:  "reading-royals",
  97:  "savannah-ghost-pirates",
  50:  "south-carolina-stingrays",
  109: "tahoe-knight-monsters",
  70:  "toledo-walleye",
  103: "trois-rivieres-lions",
  72:  "tulsa-oilers",
  106: "utah-grizzlies",
  61:  "wheeling-nailers",
  96:  "wichita-thunder",
  104: "worcester-railers",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function writeJSON(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  try {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing === json) return false;
  } catch (_) {}
  fs.writeFileSync(filePath, json, "utf8");
  return true;
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function num(str) {
  const v = parseFloat(String(str || "").replace(/[^0-9.\-]/g, ""));
  return isNaN(v) ? 0 : v;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Parse a player name cell that contains duplicated text + jersey number.
 * e.g. "Brannon McManus  Brannon McManus #39"
 * Returns { player, number, playerId }
 */
function parsePlayerCell($, cell) {
  const link = $(cell).find("a");
  let playerId = null;
  if (link.length) {
    const href = link.attr("href") || "";
    const parts = href.split("/");
    // href like /players/9607/brannon-mcmanus
    playerId = parts.length >= 3 ? parts[parts.length - 2] : null;
  }

  const rawText = $(cell).text().trim();

  // Extract jersey number from #XX
  const numMatch = rawText.match(/#(\d+)/);
  const number = numMatch ? parseInt(numMatch[1]) : null;

  // Clean the name: remove #XX, then handle duplicated name
  let name = rawText.replace(/#\d+/, "").trim();
  // If name is duplicated (e.g. "Brannon McManus  Brannon McManus"), take first half
  const half = Math.ceil(name.length / 2);
  const firstHalf = name.slice(0, half).trim();
  const secondHalf = name.slice(half).trim();
  if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
    name = firstHalf;
  } else {
    // Try splitting on double+ space
    const spParts = name.split(/\s{2,}/);
    if (spParts.length >= 2 && spParts[0].trim().toLowerCase() === spParts[1].trim().toLowerCase()) {
      name = spParts[0].trim();
    }
  }
  // Final cleanup
  name = name.replace(/\s+/g, " ").trim();

  return { player: name, number, playerId };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(TEAM_SLUGS);
  let changed = 0;

  console.log(`Seeding rosters for ${entries.length} teams...\n`);

  for (const [teamIdStr, slug] of entries) {
    const teamId = parseInt(teamIdStr);
    const url = `https://echl.com/teams/${slug}`;

    try {
      console.log(`  Fetching ${slug}...`);
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);

      const roster = [];
      let currentPosition = "F"; // default

      // Look for position group headings and their associated tables
      // The page typically has headings like "Forwards", "Defensemen", "Goalies"
      // followed by roster tables
      $("h2, h3, h4, .roster-heading, [class*='heading']").each((_, heading) => {
        const text = $(heading).text().trim().toLowerCase();
        if (text.includes("forward")) currentPosition = "F";
        else if (text.includes("defense")) currentPosition = "D";
        else if (text.includes("goalie") || text.includes("goaltender") || text.includes("goalkeeper")) currentPosition = "G";
      });

      // Reset and parse all tables, detecting position from preceding headings
      currentPosition = "F";

      // Walk through all elements in order to track headings and tables
      const body = $("body");
      const allElements = body.find("h2, h3, h4, table, .roster-heading, [class*='heading']");

      allElements.each((_, el) => {
        const tag = $(el).prop("tagName")?.toLowerCase();
        const text = $(el).text().trim().toLowerCase();

        // Check if this is a heading that indicates position group
        if (tag === "h2" || tag === "h3" || tag === "h4" || $(el).is("[class*='heading']") || $(el).is(".roster-heading")) {
          if (text.includes("forward")) currentPosition = "F";
          else if (text.includes("defense")) currentPosition = "D";
          else if (text.includes("goalie") || text.includes("goaltender") || text.includes("goalkeeper")) currentPosition = "G";
          return;
        }

        // Parse table rows
        if (tag === "table") {
          const rows = $(el).find("tr");
          if (rows.length < 2) return;

          // Detect columns from header row
          const hdrs = [];
          $(rows[0]).find("th, td").each((_, th) => {
            hdrs.push($(th).text().trim().toLowerCase());
          });

          // Find column indices
          const nameIdx = hdrs.findIndex((h) => h.includes("name") || h.includes("player"));
          const gpIdx = hdrs.findIndex((h) => h === "gp" || h === "g.p." || h.includes("games"));
          const gIdx = hdrs.findIndex((h) => h === "g" || h === "goals");
          const aIdx = hdrs.findIndex((h) => h === "a" || h === "assists");
          const ptsIdx = hdrs.findIndex((h) => h === "pts" || h === "points");

          // Parse data rows (skip header)
          rows.each((i, row) => {
            if (i === 0) return;
            const cells = $(row).find("td");
            if (cells.length < 2) return;

            // Name is typically in the first or second cell (or at nameIdx)
            const nameCell = nameIdx >= 0 ? cells[nameIdx] : cells[0];
            const { player, number, playerId } = parsePlayerCell($, nameCell);

            if (!player) return;

            roster.push({
              playerId,
              player,
              number,
              position: currentPosition,
              status: "active",
              statusNote: null,
              irStartDate: null,
              irDays: null,
              suspensionGamesRemaining: null,
              suspensionGamesOriginal: null,
              acquiredFrom: null,
              acquiredDate: null,
              stats: {
                gp: gpIdx >= 0 && cells[gpIdx] ? num($(cells[gpIdx]).text()) : 0,
                g:  gIdx >= 0  && cells[gIdx]  ? num($(cells[gIdx]).text()) : 0,
                a:  aIdx >= 0  && cells[aIdx]  ? num($(cells[aIdx]).text()) : 0,
                pts: ptsIdx >= 0 && cells[ptsIdx] ? num($(cells[ptsIdx]).text()) : 0,
              },
            });
          });
        }
      });

      const rosterData = {
        teamId,
        slug,
        lastSeeded: today,
        lastTransactionCheck: null,
        roster,
      };

      const filePath = path.join(ROSTERS_DIR, `${teamId}.json`);
      if (writeJSON(filePath, rosterData)) {
        console.log(`  ✓ ${teamId}.json — ${roster.length} players`);
        changed++;
      } else {
        console.log(`  – ${teamId}.json unchanged`);
      }
    } catch (err) {
      console.warn(`  ✗ ${slug} (${teamId}): ${err.message}`);
    }

    // 1 second delay between requests
    await delay(1000);
  }

  console.log(`\nDone. ${changed} roster files written/updated.`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
