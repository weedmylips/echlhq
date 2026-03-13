import * as cheerio from "cheerio";
import fetch from "node-fetch";
import {
  getCacheEntry,
  setCacheEntry,
  markCacheError,
  CACHE_TTL,
} from "../config/cache.js";

const BOXSCORE_URL =
  "https://lscluster.hockeytech.com/game_reports/official-game-report.php?client_code=echl&game_id=";

function cacheKey(gameId) {
  return `boxscore_${gameId}`;
}

function parseNum(str) {
  const v = parseInt((str || "").trim());
  return isNaN(v) ? 0 : v;
}

function parseFloat2(str) {
  const v = parseFloat((str || "").trim());
  return isNaN(v) ? 0 : v;
}

export async function fetchBoxscore(gameId) {
  const key = cacheKey(gameId);
  const cached = getCacheEntry(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${BOXSCORE_URL}${gameId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        Referer: "https://www.echl.com/",
      },
      timeout: 15000,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // --- Game Info ---
    const gameInfo = {
      gameId,
      homeTeam: "",
      visitingTeam: "",
      date: "",
      arena: "",
      attendance: 0,
      finalScore: { home: 0, visiting: 0 },
    };

    // Many hockeytech reports have team names in a header area
    const headerText = $("title").text() || $("h1").first().text() || "";
    // Try to extract team names from common patterns
    $("[class*='team-name'], [class*='teamName'], .home-team, .away-team").each((i, el) => {
      const name = $(el).text().trim();
      if (i === 0) gameInfo.visitingTeam = name;
      else gameInfo.homeTeam = name;
    });

    // --- Period Scoring ---
    const periodScoring = [];
    $("table").each((_, table) => {
      const headers = $(table)
        .find("th")
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();

      const headerStr = headers.join(" ");

      // Period scoring table
      if (headerStr.includes("period") && headerStr.includes("scorer")) {
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 4) return;
            periodScoring.push({
              period: $(cells[0]).text().trim(),
              time: $(cells[1]).text().trim(),
              team: $(cells[2]).text().trim(),
              scorer: $(cells[3]).text().trim(),
              assists: $(cells[4])?.text().trim() || "",
              strength: $(cells[5])?.text().trim() || "EV",
            });
          });
      }
    });

    // --- Shots by Period ---
    const shotsByPeriod = [];
    $("table").each((_, table) => {
      const headers = $(table)
        .find("th")
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      const headerStr = headers.join(" ");
      if (headerStr.includes("shots") && (headerStr.includes("1st") || headerStr.includes("period"))) {
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 4) return;
            shotsByPeriod.push({
              team: $(cells[0]).text().trim(),
              p1: parseNum($(cells[1]).text()),
              p2: parseNum($(cells[2]).text()),
              p3: parseNum($(cells[3]).text()),
              ot: parseNum($(cells[4])?.text()),
              total: parseNum($(cells[cells.length - 1]).text()),
            });
          });
      }
    });

    // --- Skater Stats ---
    const skaterStats = { home: [], visiting: [] };
    let skaterTableCount = 0;
    $("table").each((_, table) => {
      const headers = $(table)
        .find("th")
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      const headerStr = headers.join(" ");
      if (
        (headerStr.includes("goals") || headerStr.includes("g")) &&
        headerStr.includes("assists") &&
        (headerStr.includes("+/-") || headerStr.includes("pim"))
      ) {
        const players = [];
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 5) return;
            players.push({
              number: $(cells[0]).text().trim(),
              name: $(cells[1]).text().trim(),
              pos: $(cells[2]).text().trim(),
              g: parseNum($(cells[3]).text()),
              a: parseNum($(cells[4]).text()),
              pts: parseNum($(cells[5])?.text()),
              plusMinus: parseNum($(cells[6])?.text()),
              pim: parseNum($(cells[7])?.text()),
              shots: parseNum($(cells[8])?.text()),
            });
          });
        if (players.length > 0) {
          if (skaterTableCount === 0) skaterStats.visiting = players;
          else skaterStats.home = players;
          skaterTableCount++;
        }
      }
    });

    // --- Goalie Stats ---
    const goalieStats = { home: [], visiting: [] };
    let goalieTableCount = 0;
    $("table").each((_, table) => {
      const headers = $(table)
        .find("th")
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      const headerStr = headers.join(" ");
      if (headerStr.includes("saves") || headerStr.includes("sv") || headerStr.includes("gaa")) {
        const goalies = [];
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 4) return;
            goalies.push({
              number: $(cells[0]).text().trim(),
              name: $(cells[1]).text().trim(),
              minsPlayed: $(cells[2]).text().trim(),
              saves: parseNum($(cells[3]).text()),
              shotsAgainst: parseNum($(cells[4])?.text()),
              ga: parseNum($(cells[5])?.text()),
              svPct: parseFloat2($(cells[6])?.text()),
            });
          });
        if (goalies.length > 0) {
          if (goalieTableCount === 0) goalieStats.visiting = goalies;
          else goalieStats.home = goalies;
          goalieTableCount++;
        }
      }
    });

    // --- Penalty Log ---
    const penalties = [];
    $("table").each((_, table) => {
      const headers = $(table)
        .find("th")
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      const headerStr = headers.join(" ");
      if (headerStr.includes("penalty") || headerStr.includes("infraction") || headerStr.includes("minutes")) {
        $(table)
          .find("tbody tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length < 4) return;
            penalties.push({
              period: $(cells[0]).text().trim(),
              time: $(cells[1]).text().trim(),
              team: $(cells[2]).text().trim(),
              player: $(cells[3]).text().trim(),
              infraction: $(cells[4])?.text().trim() || "",
              minutes: parseNum($(cells[5])?.text()),
            });
          });
      }
    });

    // Try to detect game status (final vs in-progress)
    const pageText = $("body").text().toLowerCase();
    const isFinal =
      pageText.includes("final") ||
      pageText.includes("game over") ||
      !pageText.includes("in progress");

    // Parse final score from the summary area
    $("[class*='score'], [class*='final']").each((_, el) => {
      const text = $(el).text().trim();
      const match = text.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (match) {
        gameInfo.finalScore.visiting = parseInt(match[1]);
        gameInfo.finalScore.home = parseInt(match[2]);
      }
    });

    const ttl = isFinal ? CACHE_TTL.BOXSCORE_FINAL : CACHE_TTL.BOXSCORE_RECENT;

    const result = {
      gameInfo,
      periodScoring,
      shotsByPeriod,
      skaterStats,
      goalieStats,
      penalties,
      isFinal,
      scrapedAt: new Date().toISOString(),
      stale: false,
    };

    setCacheEntry(key, result, ttl);
    return result;
  } catch (err) {
    markCacheError(cacheKey(gameId), err.message);
    const stale = getCacheEntry(key);
    if (stale) return { ...stale, stale: true, error: err.message };
    throw err;
  }
}
