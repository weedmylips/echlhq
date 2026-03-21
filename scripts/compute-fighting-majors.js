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

const resetMode = process.argv.includes("--reset");

// Load existing data (unless --reset)
let existing = { processedGames: [], leaders: [] };
if (!resetMode) {
  try { existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")); }
  catch (_) { /* start fresh */ }
}

const processedSet = new Set(existing.processedGames || []);

// Build map from existing leaders
const playerMap = new Map();
for (const p of (existing.leaders || [])) {
  const key = `${p.name}|${p.team}`;
  playerMap.set(key, { ...p, games: p.games || [] });
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
    const key = `${pen.player}|${teamName}`;

    if (!playerMap.has(key)) {
      playerMap.set(key, { name: pen.player, team: teamName, fightingMajors: 0, games: [] });
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
