#!/usr/bin/env node
/**
 * Backfill missing playerIds in roster files by scraping echl.com team pages.
 * Only patches players that have null/missing playerId — does not overwrite existing data.
 *
 * Usage: node scripts/backfill-player-ids.js
 */

import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROSTERS_DIR = path.join(__dirname, "..", "client", "public", "data", "rosters");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

const TEAM_SLUGS = {
  74: "adirondack-thunder", 66: "allen-americans", 10: "atlanta-gladiators",
  107: "bloomington-bison", 5: "cincinnati-cyclones", 8: "florida-everblades",
  60: "fort-wayne-komets", 108: "greensboro-gargoyles", 52: "greenville-swamp-rabbits",
  11: "idaho-steelheads", 65: "indy-fuel", 98: "iowa-heartlanders",
  79: "jacksonville-icemen", 53: "kalamazoo-wings", 56: "kansas-city-mavericks",
  101: "maine-mariners", 63: "norfolk-admirals", 13: "orlando-solar-bears",
  85: "rapid-city-rush", 55: "reading-royals", 97: "savannah-ghost-pirates",
  50: "south-carolina-stingrays", 109: "tahoe-knight-monsters", 70: "toledo-walleye",
  103: "trois-rivieres-lions", 72: "tulsa-oilers", 106: "utah-grizzlies",
  61: "wheeling-nailers", 96: "wichita-thunder", 104: "worcester-railers",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parseNameFromLink($, el) {
  const text = $(el).text().replace(/#\d+/, "").replace(/\s{2,}/g, " ").trim();
  const half = Math.ceil(text.length / 2);
  if (text.slice(0, half).trim().toLowerCase() === text.slice(half).trim().toLowerCase()) {
    return text.slice(0, half).trim();
  }
  return text;
}

async function main() {
  let totalPatched = 0;

  for (const [tid, slug] of Object.entries(TEAM_SLUGS)) {
    let roster;
    try { roster = JSON.parse(fs.readFileSync(path.join(ROSTERS_DIR, `${tid}.json`), "utf8")); }
    catch (_) { continue; }

    const needsId = roster.roster.filter((p) => !p.playerId);
    if (!needsId.length) continue;

    try {
      console.log(`  ${slug}: ${needsId.length} missing...`);
      const res = await fetch(`https://echl.com/teams/${slug}`, { headers: HEADERS });
      const html = await res.text();
      const $ = cheerio.load(html);

      // Build name → playerId map from all player links on the page
      const idMap = {};
      $('a[href*="/players/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const parts = href.split("/");
        const pid = parts.length >= 3 ? parts[parts.length - 2] : null;
        if (pid && /^\d+$/.test(pid)) {
          const name = parseNameFromLink($, el);
          if (name) idMap[name.toLowerCase()] = pid;
        }
      });

      let patched = 0;
      for (const p of roster.roster) {
        if (!p.playerId && idMap[p.player.toLowerCase()]) {
          p.playerId = idMap[p.player.toLowerCase()];
          patched++;
        }
      }

      if (patched) {
        fs.writeFileSync(path.join(ROSTERS_DIR, `${tid}.json`), JSON.stringify(roster, null, 2));
        console.log(`    ✓ patched ${patched} playerIds`);
        totalPatched += patched;
      } else {
        console.log(`    – no matches found on page`);
      }
    } catch (e) {
      console.error(`    ✗ ${e.message}`);
    }

    await delay(500);
  }

  console.log(`\nDone. Patched ${totalPatched} total playerIds.`);
}

main();
