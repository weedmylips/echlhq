#!/usr/bin/env node
/**
 * Compute fighting majors per player from all boxscore JSON files.
 * Writes client/public/data/fighting-majors.json
 *
 * Usage: node scripts/compute-fighting-majors.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const BOXSCORES_DIR = path.join(DATA_DIR, "boxscores");

const files = fs.readdirSync(BOXSCORES_DIR).filter((f) => f.endsWith(".json"));

// Map: "Name|Team" -> { name, team, fightingMajors, games: [gameId, ...] }
const playerMap = new Map();

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(BOXSCORES_DIR, file), "utf8"));
  const { gameInfo, penalties } = data;
  if (!penalties || !gameInfo) continue;

  for (const pen of penalties) {
    if (!pen.infraction || !pen.infraction.toLowerCase().includes("fight")) continue;

    const teamName = pen.team === "V" ? gameInfo.visitingTeam : gameInfo.homeTeam;
    const key = `${pen.player}|${teamName}`;

    if (!playerMap.has(key)) {
      playerMap.set(key, { name: pen.player, team: teamName, fightingMajors: 0, games: [] });
    }
    const entry = playerMap.get(key);
    entry.fightingMajors++;
    if (!entry.games.includes(gameInfo.gameId)) {
      entry.games.push(gameInfo.gameId);
    }
  }
}

const results = Array.from(playerMap.values())
  .sort((a, b) => b.fightingMajors - a.fightingMajors || a.name.localeCompare(b.name));

const output = {
  generatedAt: new Date().toISOString(),
  leaders: results,
};

const outPath = path.join(DATA_DIR, "fighting-majors.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log(`Wrote ${results.length} players to fighting-majors.json`);
console.log(`Top 10:`);
results.slice(0, 10).forEach((p, i) =>
  console.log(`  ${i + 1}. ${p.name} (${p.team}) — ${p.fightingMajors} FM`)
);
