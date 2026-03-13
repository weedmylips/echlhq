#!/usr/bin/env node
/**
 * One-time script: downloads all 30 ECHL team logos from leaguestat.com
 * and saves them to client/public/logos/{internalId}.png
 *
 * The leaguestat CDN uses different IDs than our internal team IDs for many
 * teams; the LOGO_MAP below provides the correct source URL ID for each.
 *
 * Usage: node scripts/download-logos.js
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = path.join(__dirname, "..", "client", "public", "logos");

fs.mkdirSync(LOGOS_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/png,image/*,*/*",
  Referer: "https://www.echl.com/",
};

// Map of our internal team ID → leaguestat CDN logo ID
// Verified against https://www.echl.com/teams (img alt attributes)
const LOGO_MAP = {
  74:  74,   // Adirondack Thunder
  66:  66,   // Allen Americans
  10:  10,   // Atlanta Gladiators
  107: 107,  // Bloomington Bison
  5:   5,    // Cincinnati Cyclones
  8:   8,    // Florida Everblades
  60:  60,   // Fort Wayne Komets
  108: 108,  // Greensboro Gargoyles
  52:  52,   // Greenville Swamp Rabbits
  11:  11,   // Idaho Steelheads
  65:  65,   // Indy Fuel
  98:  98,   // Iowa Heartlanders
  79:  79,   // Jacksonville Icemen
  53:  50,   // Kalamazoo Wings        (leaguestat: 50)
  56:  68,   // Kansas City Mavericks  (leaguestat: 68)
  101: 82,   // Maine Mariners         (leaguestat: 82)
  63:  76,   // Norfolk Admirals       (leaguestat: 76)
  13:  61,   // Orlando Solar Bears    (leaguestat: 61)
  85:  70,   // Rapid City Rush        (leaguestat: 70)
  55:  17,   // Reading Royals         (leaguestat: 17)
  97:  102,  // Savannah Ghost Pirates (leaguestat: 102)
  50:  18,   // South Carolina Stingrays (leaguestat: 18)
  109: 106,  // Tahoe Knight Monsters  (leaguestat: 106)
  70:  21,   // Toledo Walleye         (leaguestat: 21)
  103: 99,   // Trois-Rivières Lions   (leaguestat: 99)
  72:  71,   // Tulsa Oilers           (leaguestat: 71)
  106: 23,   // Utah Grizzlies         (leaguestat: 23)
  61:  "25_73", // Wheeling Nailers    (leaguestat: 25_73)
  96:  72,   // Wichita Thunder        (leaguestat: 72)
  104: 77,   // Worcester Railers      (leaguestat: 77)
};

async function downloadLogo(internalId, leaguestatId) {
  const url = `https://assets.leaguestat.com/echl/logos/${leaguestatId}.png`;
  const dest = path.join(LOGOS_DIR, `${internalId}.png`);

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.error(`  FAIL  ${internalId} (ls:${leaguestatId})  HTTP ${res.status}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`  OK    ${internalId} (ls:${leaguestatId})  ${buf.length} bytes`);
    return true;
  } catch (err) {
    console.error(`  ERROR ${internalId} (ls:${leaguestatId})  ${err.message}`);
    return false;
  }
}

console.log(`Downloading ${Object.keys(LOGO_MAP).length} logos to ${LOGOS_DIR}\n`);

let ok = 0, fail = 0;

for (const [internalId, leaguestatId] of Object.entries(LOGO_MAP)) {
  const success = await downloadLogo(internalId, leaguestatId);
  if (success) ok++; else fail++;
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`\nDone: ${ok} succeeded, ${fail} failed.`);
if (fail > 0) process.exit(1);
