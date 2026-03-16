#!/usr/bin/env node
/**
 * ECHL Transaction Agent — parses the daily ECHL transactions post
 * and updates roster + team-moves JSON files.
 *
 * Runs daily via GitHub Actions (10pm ET / 3am UTC).
 * Usage: node scripts/agent-transactions.js
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "client", "public", "data");
const ROSTERS_DIR = path.join(DATA_DIR, "rosters");
const MOVES_DIR = path.join(DATA_DIR, "team-moves");

fs.mkdirSync(ROSTERS_DIR, { recursive: true });
fs.mkdirSync(MOVES_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: "https://www.echl.com/",
};

// ─── Team name → internal ID mapping ────────────────────────────────────────

const TEAM_NAME_MAP = {
  "adirondack": 74,
  "allen": 66,
  "atlanta": 10,
  "bloomington": 107,
  "cincinnati": 5,
  "florida": 8,
  "fort wayne": 60,
  "greensboro": 108,
  "greenville": 52,
  "idaho": 11,
  "indy": 65,
  "iowa": 98,
  "jacksonville": 79,
  "kalamazoo": 53,
  "kansas city": 56,
  "maine": 101,
  "norfolk": 63,
  "orlando": 13,
  "rapid city": 85,
  "reading": 55,
  "savannah": 97,
  "south carolina": 50,
  "tahoe": 109,
  "toledo": 70,
  "trois-rivi\u00e8res": 103,
  "trois-rivieres": 103,
  "tulsa": 72,
  "utah": 106,
  "wheeling": 61,
  "wichita": 96,
  "worcester": 104,
};

// ─── Month names for URL building ───────────────────────────────────────────

const MONTH_NAMES_SHORT = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
const MONTH_NAMES_LONG = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// ─── Status mapping rules ───────────────────────────────────────────────────

const STATUS_RULES = [
  { pattern: /placed on ir (\d+) day/i,       status: "ir",           getExtra: (m) => ({ irDays: parseInt(m[1]) }) },
  { pattern: /placed on reserve/i,             status: "reserve",      getExtra: () => ({}) },
  { pattern: /activated from ir/i,             status: "active",       getExtra: () => ({ clearIR: true }) },
  { pattern: /activated from reserve/i,        status: "active",       getExtra: () => ({}) },
  { pattern: /recalled to .+ by/i,             status: "recalled_ahl", getExtra: () => ({}) },
  { pattern: /loaned to/i,                     status: "loaned",       getExtra: () => ({}) },
  { pattern: /returned from loan/i,            status: "active",       getExtra: () => ({}) },
  { pattern: /traded to (.+)/i,                status: "traded",       getExtra: (m) => ({ tradedTo: m[1].trim() }) },
  { pattern: /acquired from (.+)/i,            status: "active",       getExtra: (m) => ({ acquiredFrom: m[1].trim() }) },
  { pattern: /signed echl spc/i,               status: "signed",       getExtra: () => ({}) },
  { pattern: /signed amateur tryout/i,         status: "signed",       getExtra: () => ({}) },
  { pattern: /transferred/i,                   status: "active",       getExtra: () => ({}) },
  { pattern: /released/i,                      status: "released",     getExtra: () => ({}) },
  { pattern: /family.*leave|bereavement/i,     status: "leave",        getExtra: () => ({}) },
  { pattern: /recalled by/i,                   status: "recalled_ahl", getExtra: () => ({}) },
];

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

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function lookupTeamId(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim().replace(/:$/, "");
  return TEAM_NAME_MAP[lower] ?? null;
}

function normalizePosition(pos) {
  if (!pos) return "F";
  const p = pos.toUpperCase().trim();
  if (p === "D" || p === "DEF") return "D";
  if (p === "G" || p === "GK") return "G";
  return "F"; // F, FW, etc.
}

function matchStatus(description) {
  for (const rule of STATUS_RULES) {
    const m = description.match(rule.pattern);
    if (m) {
      return { status: rule.status, extra: rule.getExtra(m) };
    }
  }
  return null;
}

// ─── Transaction parsing ────────────────────────────────────────────────────

function parseTransactions(html) {
  const $ = cheerio.load(html);

  // Find article body content
  const article = $("article, .article-body, .news-article, .post-content, [class*='article'], [class*='content']").first();
  const bodyEl = article.length ? article : $("body");

  const bodyHtml = bodyEl.html() || "";

  // Split by team headers (bold team names followed by colon)
  // Format: <strong>TeamName:</strong> or **TeamName:**
  const teamBlocks = [];
  let currentTeam = null;
  let currentLines = [];

  // Get text content line by line, preserving structure
  // We'll work with the raw HTML to find bold team headers
  const lines = bodyHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Check if this line is a team header (ends with colon, was bold in HTML)
    // Team headers are typically just the team name followed by ":"
    const headerMatch = line.match(/^([A-Za-z\s\-\u00e0-\u00ff]+):$/);
    if (headerMatch) {
      const teamId = lookupTeamId(headerMatch[1]);
      if (teamId) {
        if (currentTeam !== null) {
          teamBlocks.push({ teamId: currentTeam, lines: currentLines });
        }
        currentTeam = teamId;
        currentLines = [];
        continue;
      }
    }

    if (currentTeam !== null) {
      currentLines.push(line);
    }
  }
  if (currentTeam !== null) {
    teamBlocks.push({ teamId: currentTeam, lines: currentLines });
  }

  // Parse individual transaction lines within each team block
  const transactions = [];

  for (const block of teamBlocks) {
    for (const line of block.lines) {
      // Format: Add/Delete  Player Name, POS  Transaction description
      const txMatch = line.match(/^(Add|Delete)\s+(.+?),\s*([A-Za-z]+)\s+(.+)$/i);
      if (!txMatch) continue;

      const action = txMatch[1].toLowerCase(); // "add" or "delete"
      const player = txMatch[2].trim();
      const position = normalizePosition(txMatch[3]);
      const description = txMatch[4].trim();
      const statusResult = matchStatus(description);

      if (!statusResult) {
        console.warn(`  ? Unrecognized transaction: "${line}"`);
        continue;
      }

      transactions.push({
        teamId: block.teamId,
        action,
        player,
        position,
        description,
        ...statusResult,
      });
    }
  }

  return transactions;
}

// ─── Apply transactions to roster files ─────────────────────────────────────

function applyTransactions(transactions, today) {
  // Group by teamId
  const byTeam = {};
  for (const tx of transactions) {
    (byTeam[tx.teamId] ||= []).push(tx);
  }

  let changed = 0;

  for (const [teamIdStr, txs] of Object.entries(byTeam)) {
    const teamId = parseInt(teamIdStr);
    const rosterPath = path.join(ROSTERS_DIR, `${teamId}.json`);
    const movesPath = path.join(MOVES_DIR, `${teamId}.json`);

    // Load existing roster
    let rosterData = readJSON(rosterPath);
    if (!rosterData) {
      console.warn(`  ⚠ No roster file for team ${teamId}, creating skeleton`);
      rosterData = { teamId, slug: "", lastSeeded: null, lastTransactionCheck: null, roster: [] };
    }

    // Load existing moves
    let movesData = readJSON(movesPath) || { teamId, moves: [] };

    for (const tx of txs) {
      const { action, player, position, description, status, extra } = tx;

      // Find player in roster (case-insensitive)
      const playerIdx = rosterData.roster.findIndex(
        (p) => p.player.toLowerCase() === player.toLowerCase()
      );

      if (action === "delete") {
        if (status === "traded" || status === "released") {
          // Remove player from roster
          if (playerIdx >= 0) {
            rosterData.roster.splice(playerIdx, 1);
            console.log(`  − ${player} removed from team ${teamId} (${status})`);
          }
        } else if (playerIdx >= 0) {
          // Update status
          applyStatus(rosterData.roster[playerIdx], status, extra, today);
          console.log(`  ↻ ${player} on team ${teamId}: ${status}`);
        }
      } else if (action === "add") {
        if (playerIdx >= 0) {
          // Player already on roster — update status
          applyStatus(rosterData.roster[playerIdx], status, extra, today);
          console.log(`  ↻ ${player} on team ${teamId}: ${status}`);
        } else {
          // Add new player to roster
          const newPlayer = {
            playerId: null,
            player,
            number: null,
            position,
            status: status === "signed" ? "signed" : "active",
            statusNote: null,
            irStartDate: null,
            irDays: null,
            suspensionGamesRemaining: null,
            suspensionGamesOriginal: null,
            acquiredFrom: extra.acquiredFrom || null,
            acquiredDate: extra.acquiredFrom ? today : null,
            stats: { gp: 0, g: 0, a: 0, pts: 0 },
          };
          rosterData.roster.push(newPlayer);
          console.log(`  + ${player} added to team ${teamId} (${status})`);
        }
      }

      // Record move
      movesData.moves.unshift({
        date: today,
        player,
        position,
        type: status,
        summary: description,
      });
    }

    // Keep only last 20 moves
    movesData.moves = movesData.moves.slice(0, 20);

    // Update transaction check timestamp
    rosterData.lastTransactionCheck = today;

    // Write files
    if (writeJSON(rosterPath, rosterData)) changed++;
    writeJSON(movesPath, movesData);
  }

  return changed;
}

function applyStatus(player, status, extra, today) {
  player.status = status;

  if (extra.clearIR) {
    player.irStartDate = null;
    player.irDays = null;
  }

  if (extra.irDays) {
    player.irDays = extra.irDays;
    player.irStartDate = today;
  }

  if (extra.acquiredFrom) {
    player.acquiredFrom = extra.acquiredFrom;
    player.acquiredDate = today;
  }
}

// ─── Auto-expire stale IR entries ────────────────────────────────────────────

function expireStaleIR(today) {
  const files = fs.readdirSync(ROSTERS_DIR).filter((f) => f.endsWith(".json"));
  let expired = 0;
  for (const file of files) {
    const rosterPath = path.join(ROSTERS_DIR, file);
    const data = readJSON(rosterPath);
    if (!data?.roster) continue;
    let changed = false;
    for (const p of data.roster) {
      if (p.status !== "ir" || !p.irStartDate || !p.irDays) continue;
      const expiry = new Date(p.irStartDate);
      expiry.setDate(expiry.getDate() + p.irDays);
      if (today >= expiry.toISOString().slice(0, 10)) {
        p.status = "active";
        p.irStartDate = null;
        p.irDays = null;
        changed = true;
        console.log(`  ⏱ ${p.player} IR expired (team ${data.teamId})`);
      }
    }
    if (changed) {
      data.lastTransactionCheck = today;
      writeJSON(rosterPath, data);
      expired++;
    }
  }
  return expired;
}

// ─── Deduplicate roster entries ──────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["active", "signed"]);

function deduplicateRosters() {
  const files = fs.readdirSync(ROSTERS_DIR).filter((f) => f.endsWith(".json"));
  let deduped = 0;
  for (const file of files) {
    const rosterPath = path.join(ROSTERS_DIR, file);
    const data = readJSON(rosterPath);
    if (!data?.roster) continue;

    const seen = new Map(); // name.lower → best entry
    for (const p of data.roster) {
      const key = p.player.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, p);
      } else {
        const existing = seen.get(key);
        // Prefer non-active status over active; prefer entry with playerId
        const existingIsActive = ACTIVE_STATUSES.has(existing.status);
        const newIsActive = ACTIVE_STATUSES.has(p.status);
        if (existingIsActive && !newIsActive) {
          seen.set(key, p); // new one is more specific
        } else if (!existingIsActive && newIsActive) {
          // keep existing
        } else if (!existing.playerId && p.playerId) {
          seen.set(key, p); // new has more data
        }
      }
    }

    const deduped_roster = Array.from(seen.values());
    if (deduped_roster.length < data.roster.length) {
      const removed = data.roster.length - deduped_roster.length;
      console.log(`  🔧 Team ${data.teamId}: removed ${removed} duplicate(s)`);
      data.roster = deduped_roster;
      writeJSON(rosterPath, data);
      deduped++;
    }
  }
  return deduped;
}

// ─── Fetch a single day's transactions ───────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchUrl(url) {
  const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.text();
}

async function fetchDay(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const monthIdx = d.getMonth();
  const day = d.getDate();
  const dateStr = d.toISOString().slice(0, 10);

  // Try long month name first (recent posts), then short (older posts)
  const variants = [MONTH_NAMES_LONG[monthIdx], MONTH_NAMES_SHORT[monthIdx]];

  for (const monthName of variants) {
    const url = `https://echl.com/news/${year}/${mm}/echl-transactions-${monthName}-${day}`;
    console.log(`\nFetching: ${url}`);
    try {
      const html = await fetchUrl(url);
      const transactions = parseTransactions(html);
      console.log(`  Parsed ${transactions.length} transactions.`);
      return { dateStr, transactions };
    } catch (err) {
      if (err.status === 404) continue; // try next variant
      console.warn(`  ✗ Failed for ${dateStr}: ${err.message}`);
      return { dateStr, transactions: [] };
    }
  }

  console.log(`  No transactions post for ${dateStr}.`);
  return { dateStr, transactions: [] };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Support --days N flag for backfilling (e.g. node agent-transactions.js --days 7)
  const daysArg = process.argv.indexOf("--days");
  const numDays = daysArg >= 0 ? parseInt(process.argv[daysArg + 1]) || 1 : 1;

  const now = new Date();
  let totalChanged = 0;

  // Process days from oldest to newest so status updates apply in order
  for (let i = numDays - 1; i >= 0; i--) {
    const target = new Date(now);
    target.setDate(target.getDate() - i);

    const { dateStr, transactions } = await fetchDay(target);

    if (transactions.length > 0) {
      const changed = applyTransactions(transactions, dateStr);
      totalChanged += changed;
    }

    // Delay between requests when backfilling
    if (i > 0) await delay(1000);
  }

  const dedupCount = deduplicateRosters();
  if (dedupCount) console.log(`\nDeduplicated ${dedupCount} roster file(s).`);

  const expired = expireStaleIR(now.toISOString().slice(0, 10));
  if (expired) console.log(`\nAuto-expired IR for ${expired} roster file(s).`);

  if (totalChanged === 0 && numDays === 1 && expired === 0 && dedupCount === 0) {
    console.log("\nNo transactions found. Exiting cleanly.");
  } else {
    console.log(`\nDone. ${totalChanged} roster files updated across ${numDays} day(s).`);
  }

  // TODO: Future — parse suspension/fine posts at separate URL
  // (echl-announces-fine-suspension / echl-announces-fines-suspensions)
  // using ANTHROPIC_API_KEY from process.env for LLM-based extraction.
}

main().catch((err) => {
  console.error("Transaction agent failed:", err.message);
  process.exit(1);
});
