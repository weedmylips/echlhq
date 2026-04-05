#!/usr/bin/env node
/**
 * Compute fighting majors per player from boxscore JSON files.
 * Uses persistent merge — only processes games not already tracked,
 * so previously counted fights survive boxscore pruning.
 *
 * Writes client/public/data/fighting-majors.json
 *
 * Usage: node scripts/compute-fighting-majors.js [--reset]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const BOXSCORES_DIR = path.join(DATA_DIR, "boxscores");
const OUT_PATH = path.join(DATA_DIR, "fighting-majors.json");

const ROSTERS_DIR = path.join(DATA_DIR, "rosters");

const resetMode = process.argv.includes("--reset");

// Build abbreviated name → full name lookup from roster files
// Key: "V. Hadfield|Reading" → { fullName: "Vince Hadfield", playerId: "12345" }
const abbrToFull = new Map();
const TEAM_CONFIG = {
  74:"Adirondack",10:"Atlanta",66:"Allen",107:"Bloomington",5:"Cincinnati",
  8:"Florida",60:"Fort Wayne",108:"Greensboro",52:"Greenville",11:"Idaho",
  65:"Indy",98:"Iowa",79:"Jacksonville",53:"Kalamazoo",56:"Kansas City",
  101:"Maine",63:"Norfolk",13:"Orlando",85:"Rapid City",55:"Reading",
  97:"Savannah",50:"South Carolina",109:"Tahoe",70:"Toledo",103:"Trois-Rivières",
  72:"Tulsa",106:"Utah",61:"Wheeling",96:"Wichita",104:"Worcester",
};
for (const [tid, city] of Object.entries(TEAM_CONFIG)) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(ROSTERS_DIR, `${tid}.json`), "utf8"));
    for (const p of (r.roster || [])) {
      if (!p.player) continue;
      const parts = p.player.split(" ");
      if (parts.length >= 2) {
        const abbr = parts[0][0] + ". " + parts.slice(1).join(" ");
        const key = `${abbr}|${city}`;
        if (abbrToFull.has(key)) abbrToFull.set(key, null); // ambiguous
        else abbrToFull.set(key, { fullName: p.player, playerId: p.playerId ? String(p.playerId) : null });
      }
    }
  } catch (_) {}
}

// Load existing data (unless --reset)
let existing = { processedGames: [], leaders: [] };
if (!resetMode) {
  try { existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")); }
  catch (_) { /* start fresh */ }
}

const processedSet = new Set(existing.processedGames || []);

// Build map from existing leaders, resolving abbreviated names
const playerMap = new Map();
for (const p of (existing.leaders || [])) {
  const resolved = abbrToFull.get(`${p.name}|${p.team}`);
  const fullName = resolved?.fullName || p.name;
  const playerId = resolved?.playerId || p.playerId || null;
  const key = `${fullName}|${p.team}`;
  const entry = { ...p, name: fullName, games: p.games || [], ...(playerId ? { playerId } : {}) };
  // Merge if already exists (abbreviated + full name collision)
  if (playerMap.has(key)) {
    const existing = playerMap.get(key);
    const allGames = [...new Set([...existing.games, ...entry.games])];
    existing.games = allGames;
    existing.fightingMajors = allGames.length;
  } else {
    playerMap.set(key, entry);
  }
}

// Process boxscores not yet tracked
const files = fs.readdirSync(BOXSCORES_DIR).filter((f) => f.endsWith(".json"));
let newGames = 0;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(BOXSCORES_DIR, file), "utf8"));
  const { gameInfo, penalties } = data;
  if (!penalties || !gameInfo) continue;

  const gid = gameInfo.gameId;
  if (processedSet.has(gid)) continue;
  processedSet.add(gid);
  newGames++;

  for (const pen of penalties) {
    if (!pen.infraction || !pen.infraction.toLowerCase().includes("fight")) continue;

    const teamName = pen.team === "V" ? gameInfo.visitingTeam : gameInfo.homeTeam;
    const resolved = abbrToFull.get(`${pen.player}|${teamName}`);
    const fullName = resolved?.fullName || pen.player;
    const playerId = resolved?.playerId || null;
    const key = `${fullName}|${teamName}`;

    if (!playerMap.has(key)) {
      playerMap.set(key, { name: fullName, team: teamName, fightingMajors: 0, games: [], ...(playerId ? { playerId } : {}) });
    }
    const entry = playerMap.get(key);
    entry.fightingMajors++;
    if (!entry.games.includes(gid)) {
      entry.games.push(gid);
    }
  }
}

const results = Array.from(playerMap.values())
  .sort((a, b) => b.fightingMajors - a.fightingMajors || a.name.localeCompare(b.name));

const output = {
  generatedAt: new Date().toISOString(),
  processedGames: [...processedSet],
  leaders: results,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");

console.log(`Wrote ${results.length} players to fighting-majors.json (${newGames} new games processed)`);
console.log(`Top 10:`);
results.slice(0, 10).forEach((p, i) =>
  console.log(`  ${i + 1}. ${p.name} (${p.team}) — ${p.fightingMajors} FM`)
);
