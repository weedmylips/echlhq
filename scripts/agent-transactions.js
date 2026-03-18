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
  { pattern: /placed on reserve/i,             status: "reserve",      getExtra: () => ({ clearIR: true }) },
  { pattern: /activated from ir/i,             status: "active",       getExtra: () => ({ clearIR: true }) },
  { pattern: /activated from reserve/i,        status: "active",       getExtra: () => ({}) },
  { pattern: /recalled to .+ by/i,             status: "recalled_ahl", getExtra: () => ({}) },
  { pattern: /loaned to/i,                     status: "loaned",       getExtra: () => ({}) },
  { pattern: /returned from loan/i,            status: "active",       getExtra: () => ({}) },
  { pattern: /assigned from .+ by/i,          status: "active",       getExtra: () => ({}) },
  { pattern: /assigned by/i,                  status: "active",       getExtra: () => ({}) },
  { pattern: /traded to (.+)/i,                status: "traded",       getExtra: (m) => ({ tradedTo: m[1].trim() }) },
  { pattern: /acquired from (.+)/i,            status: "active",       getExtra: (m) => ({ acquiredFrom: m[1].trim() }) },
  { pattern: /signed echl spc/i,               status: "signed",       getExtra: () => ({}) },
  { pattern: /signed amateur tryout/i,         status: "signed",       getExtra: () => ({}) },
  { pattern: /transferred to ir (\d+) day/i,   status: "ir",           getExtra: (m) => ({ irDays: parseInt(m[1]) }) },
  { pattern: /transferred to ir/i,             status: "ir",           getExtra: () => ({}) },
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
            suspensionGpAtStart: null,
            acquiredFrom: extra.acquiredFrom || null,
            acquiredDate: extra.acquiredFrom ? today : null,
            stats: { gp: 0, g: 0, a: 0, pts: 0 },
          };
          rosterData.roster.push(newPlayer);
          console.log(`  + ${player} added to team ${teamId} (${status})`);
        }
      }

      // Record move (skip if already recorded for same date/player/type/summary)
      const alreadyRecorded = movesData.moves.some(
        (m) =>
          m.date === today &&
          m.player.toLowerCase() === player.toLowerCase() &&
          m.type === status &&
          m.summary === description
      );
      if (!alreadyRecorded) {
        movesData.moves.unshift({
          date: today,
          player,
          position,
          type: status,
          summary: description,
        });
      }
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

// ─── Auto-expire stale suspension entries ────────────────────────────────────

function expireStaleSuspensions(today) {
  const standingsData = readJSON(path.join(DATA_DIR, "standings.json"));
  const gpByTeamId = {};
  for (const t of (standingsData?.standings ?? [])) gpByTeamId[t.teamId] = t.gp;

  const files = fs.readdirSync(ROSTERS_DIR).filter((f) => f.endsWith(".json"));
  let expired = 0;
  for (const file of files) {
    const rosterPath = path.join(ROSTERS_DIR, file);
    const data = readJSON(rosterPath);
    if (!data?.roster) continue;
    let changed = false;
    const currentGP = gpByTeamId[data.teamId] ?? null;
    for (const p of data.roster) {
      if (p.status !== "suspended" || !p.suspensionGamesOriginal || currentGP === null) continue;
      const gpAtStart = p.suspensionGpAtStart ?? currentGP;
      const gamesElapsed = currentGP - gpAtStart;
      p.suspensionGamesRemaining = Math.max(0, p.suspensionGamesOriginal - gamesElapsed);
      if (p.suspensionGamesRemaining === 0) {
        p.status = "active";
        p.suspensionGamesRemaining = null;
        p.suspensionGamesOriginal = null;
        p.suspensionGpAtStart = null;
        changed = true;
        console.log(`  ⏱ ${p.player} suspension expired (team ${data.teamId})`);
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

// ─── Scrape suspension announcements ─────────────────────────────────────────

const WORD_TO_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const SEASON_START = "2025-10-15";

async function scrapeSuspensions(today) {
  const statePath = path.join(DATA_DIR, "suspension-state.json");
  const state = readJSON(statePath) ?? { processed: [] };
  const processed = new Set(state.processed);

  const standingsData = readJSON(path.join(DATA_DIR, "standings.json"));
  const standingsByTeamId = {};
  for (const t of (standingsData?.standings ?? [])) standingsByTeamId[t.teamId] = t;

  const todayDate = new Date(today);
  const daysIntoSeason = (todayDate - new Date(SEASON_START)) / 86400000;

  // Determine months to scan: current month + any month not yet in processed set
  // For simplicity, scan both current month and the previous month if we're early in the month
  const months = [];
  const d = new Date(today);
  months.push({ year: d.getFullYear(), mm: String(d.getMonth() + 1).padStart(2, "0") });
  // Also include previous month on first run (covers March backfill)
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  months.push({ year: prev.getFullYear(), mm: String(prev.getMonth() + 1).padStart(2, "0") });

  const slugVariants = ["echl-announces-fine-suspension", "echl-announces-fines-suspensions"];
  let found = 0;

  for (const { year, mm } of months) {
    for (const slug of slugVariants) {
      let consecutive404s = 0;
      for (let n = 1; n <= 25; n++) {
        const url = `https://echl.com/news/${year}/${mm}/${slug}${n}`;
        if (processed.has(url)) { consecutive404s = 0; continue; }

        let html;
        try {
          const res = await fetch(url, { headers: HEADERS, timeout: 20000 });
          if (!res.ok) {
            consecutive404s++;
            if (consecutive404s >= 2) break;
            continue;
          }
          consecutive404s = 0;
          html = await res.text();
        } catch (_) {
          consecutive404s++;
          if (consecutive404s >= 2) break;
          continue;
        }

        processed.add(url);

        // Parse HTML into lines (same technique as parseTransactions)
        const $ = cheerio.load(html);
        const bodyEl = $('[itemprop="articleBody"]');
        const bodyHtml = bodyEl.html() || "";
        const lines = bodyHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Extract article date: look for "DayName, Month Nth" or "(Month Day)" in text
        const fullText = lines.join(" ");
        // Fall back to first day of the URL's month so old posts aren't treated as fresh
        const articleDate = extractArticleDate(fullText, year, today) ?? `${year}-${mm}-01`;

        const suspensions = parseSuspensionLines(lines);
        console.log(`  📋 ${url} — ${suspensions.length} suspension(s) found (article date: ${articleDate})`);

        for (const { teamName, playerName, games } of suspensions) {
          const teamId = lookupTeamId(teamName);
          if (!teamId) {
            console.warn(`  ? Unknown team: "${teamName}"`);
            continue;
          }

          const standing = standingsByTeamId[teamId];
          if (!standing) {
            console.warn(`  ? No standings for team ${teamId}`);
            continue;
          }

          // Estimate games elapsed since article date using team's games-per-day rate
          const daysSince = Math.max(0, (todayDate - new Date(articleDate)) / 86400000);
          const gamesPerDay = daysIntoSeason > 0 ? standing.gp / daysIntoSeason : 0;
          const estimatedElapsed = Math.floor(daysSince * gamesPerDay);

          if (estimatedElapsed >= games) {
            console.log(`  ✓ ${playerName} (team ${teamId}): ${games}-game suspension already served, skipping`);
            continue;
          }

          const remaining = games - estimatedElapsed;
          const gpAtStart = Math.max(0, standing.gp - estimatedElapsed);

          // Update roster
          const rosterPath = path.join(ROSTERS_DIR, `${teamId}.json`);
          const rosterData = readJSON(rosterPath);
          if (!rosterData?.roster) continue;

          const playerIdx = rosterData.roster.findIndex(
            (p) => p.player.toLowerCase() === playerName.toLowerCase()
          );
          if (playerIdx < 0) {
            console.warn(`  ? ${playerName} not found on roster for team ${teamId}`);
            continue;
          }

          const p = rosterData.roster[playerIdx];
          p.status = "suspended";
          p.suspensionGamesRemaining = remaining;
          p.suspensionGamesOriginal = games;
          p.suspensionGpAtStart = gpAtStart;
          rosterData.lastTransactionCheck = today;
          writeJSON(rosterPath, rosterData);

          // Update moves
          const movesPath = path.join(MOVES_DIR, `${teamId}.json`);
          const movesData = readJSON(movesPath) || { teamId, moves: [] };
          // Only add if not already recorded
          const alreadyRecorded = movesData.moves.some(
            (m) => m.type === "suspended" && m.player.toLowerCase() === playerName.toLowerCase()
          );
          if (!alreadyRecorded) {
            movesData.moves.unshift({
              date: articleDate,
              player: playerName,
              position: p.position,
              type: "suspended",
              summary: `Suspended ${games} Game${games !== 1 ? "s" : ""}`,
            });
            movesData.moves = movesData.moves.slice(0, 20);
            writeJSON(movesPath, movesData);
          }

          console.log(`  🚫 ${playerName} (team ${teamId}): suspended ${games}g, ${remaining} remaining`);
          found++;
        }

        await delay(500);
      }
    }
  }

  state.processed = [...processed];
  writeJSON(statePath, state);
  return found;
}

// Extract article date from full text using known day names + month from URL
const MONTH_NAMES_MAP = {
  january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03",
  april: "04", apr: "04", may: "05", june: "06", jun: "06",
  july: "07", jul: "07", august: "08", aug: "08", september: "09", sep: "09", sept: "09",
  october: "10", oct: "10", november: "11", nov: "11", december: "12", dec: "12",
};
function extractArticleDate(text, year, todayStr) {
  // Try "tonight/today (Month.? Day)" e.g. "tonight (Feb. 21)" or "today (March 15)"
  const m2 = text.match(/(?:tonight|today)[^(]*\(([A-Z][a-z]+\.?)\s+(\d+)\)/);
  if (m2) {
    const mon = MONTH_NAMES_MAP[m2[1].replace(".", "").toLowerCase()];
    if (mon) return `${year}-${mon}-${String(m2[2]).padStart(2, "0")}`;
  }
  // Try "DayName, Month.? Nth" e.g. "Saturday, March 14th" or "Saturday, Feb. 21"
  const m1 = text.match(/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+([A-Z][a-z]+\.?)\s+(\d+)/);
  if (m1) {
    const mon = MONTH_NAMES_MAP[m1[2].replace(".", "").toLowerCase()];
    if (mon) return `${year}-${mon}-${String(m1[3]).padStart(2, "0")}`;
  }
  // Try "on DayName announced" e.g. "on Monday announced" — compute most recent past occurrence
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const m3 = text.match(/\bon\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  if (m3 && todayStr) {
    const targetDay = DAY_NAMES.findIndex(d => d.toLowerCase() === m3[1].toLowerCase());
    const ref = new Date(todayStr + "T12:00:00Z"); // noon UTC avoids DST/timezone date shifts
    const diff = (ref.getUTCDay() - targetDay + 7) % 7;
    const ms = ref.getTime() - diff * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

// Strip zero-width and invisible Unicode chars that ECHL's CMS sometimes inserts
function cleanLine(s) {
  return s
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "") // strip zero-width chars
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")       // normalize smart single quotes → '
    .trim();
}

function parseSuspensionLines(lines) {
  // Process line-by-line (lines already split on <br>/<p> boundaries by caller).
  // Structure per suspension:
  //   "TeamName's LastName fined, suspended"         ← header, no game count → skip
  //   "TeamName's Full Name has been suspended for N games and fined..."  ← body
  // Multi-player lines: "TeamA's Player and TeamB's Player have both been suspended for N games"
  const results = [];
  let currentTeam = null;

  // Allow mixed-case mid-name (McNelly, O'Brien) by including A-Z in the tail char class
  const possessiveRe = /([A-Z][a-z\u00e0-\u00ff]+(?: [A-Z][a-z\u00e0-\u00ff]+)*)'s\s+([A-Z][a-zA-Z\u00e0-\u00ff]+(?: [A-Z][a-zA-Z\u00e0-\u00ff'-]+)*)/g;
  const gamesRe = /suspended\s+(?:for\s+)?(\w+)\s+game/i;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);

    // Find all possessives in this line, filtering to known team names only
    const possessives = [...line.matchAll(possessiveRe)]
      .filter((m) => lookupTeamId(m[1]) !== null);
    if (possessives.length > 0) currentTeam = possessives[0][1]; // track first team

    const gamesMatch = line.match(gamesRe);
    if (!gamesMatch) continue;

    const gamesRaw = gamesMatch[1].toLowerCase();
    const games = WORD_TO_NUM[gamesRaw] ?? (parseInt(gamesRaw) || null);
    if (!games) continue;

    // Emit one entry per possessive found on this line (handles multi-player lines)
    if (possessives.length > 0) {
      for (const poss of possessives) {
        results.push({ teamName: poss[1], playerName: poss[2], games });
      }
      currentTeam = null;
    } else if (currentTeam) {
      // Fallback: no possessive on this line, use carry-over team + "X has been" pattern
      const hasBeenMatch = line.match(/([A-Z][a-z\u00e0-\u00ff]+(?: [A-Z][a-z\u00e0-\u00ff'-]+)+)\s+has been/);
      const playerName = hasBeenMatch?.[1] ?? null;
      if (playerName) {
        results.push({ teamName: currentTeam, playerName, games });
        currentTeam = null;
      }
    }
  }

  return results;
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

  // GitHub Actions runner is UTC. At 1am UTC = 8pm ET (previous calendar day in UTC terms).
  // Use Eastern Time date so we fetch the correct day's transactions.
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
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

  const today = now.toISOString().slice(0, 10);

  const suspFound = await scrapeSuspensions(today);
  if (suspFound) console.log(`\nFound ${suspFound} active suspension(s).`);

  const suspExpired = expireStaleSuspensions(today);
  if (suspExpired) console.log(`\nAuto-expired suspensions for ${suspExpired} roster file(s).`);

  const expired = expireStaleIR(today);
  if (expired) console.log(`\nAuto-expired IR for ${expired} roster file(s).`);

  if (totalChanged === 0 && numDays === 1 && expired === 0 && dedupCount === 0 && suspFound === 0) {
    console.log("\nNo transactions found. Exiting cleanly.");
  } else {
    console.log(`\nDone. ${totalChanged} roster files updated across ${numDays} day(s).`);
  }
}

main().catch((err) => {
  console.error("Transaction agent failed:", err.message);
  process.exit(1);
});
