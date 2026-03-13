import * as cheerio from "cheerio";
import fetch from "node-fetch";
import {
  getCacheEntry,
  setCacheEntry,
  markCacheError,
  CACHE_KEYS,
  CACHE_TTL,
} from "../config/cache.js";
import { findTeamByName, teams as TEAMS } from "../config/teamConfig.js";

const DAILY_REPORT_URL =
  "https://cluster.leaguestat.com/download.php?client_code=echl&file_path=daily-report/daily-report.html";

function num(str) {
  if (!str) return 0;
  const v = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  return isNaN(v) ? 0 : v;
}

// Clean team name: strip rank prefix and clinch markers (x, y, z, M, etc.)
function cleanTeamName(raw) {
  return raw
    .replace(/^\d+\.\s*/, "")              // remove "1. "
    .replace(/^[a-zA-Z\*]\s+/, "")         // remove single-char clinch marker + space
    .trim();
}

export async function fetchStandings() {
  const cached = getCacheEntry(CACHE_KEYS.STANDINGS);
  if (cached) return cached;

  try {
    const res = await fetch(DAILY_REPORT_URL, {
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

    const standings = [];

    // Find "Division Standings" h2
    let divH2 = null;
    $("h2").each((_, el) => {
      if ($(el).text().includes("Division Standings")) divH2 = $(el);
    });

    if (!divH2) throw new Error("Division Standings section not found");

    // Parse the single drtable after "Division Standings"
    const table = divH2.nextAll("table.drtable").first();
    if (!table.length) throw new Error("Standings table not found");

    let currentConference = "";
    let currentDivision = "";

    table.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (!cells.length) return;

      // Conference spanner row
      if ($(cells[0]).hasClass("drtable-spanner") || $(row).hasClass("drtable-spanner")) {
        const raw = $(cells[0]).text().trim();
        // Title-case: "EASTERN" → "Eastern"
        currentConference = raw.charAt(0) + raw.slice(1).toLowerCase();
        return;
      }

      // Division sub-header row
      if ($(cells[0]).hasClass("drtable-fake-th")) {
        const raw = $(cells[0]).text().trim();
        // Title-case: "NORTH" → "North"
        currentDivision = raw.charAt(0) + raw.slice(1).toLowerCase();
        return;
      }

      // Data row: first cell is team name
      if (cells.length < 9) return;
      const rawName = $(cells[0]).text().trim();
      if (!rawName) return;

      const teamName = cleanTeamName(rawName);
      if (!teamName || teamName.length < 2) return;

      const config = findTeamByName(teamName);

      const gp = num($(cells[1]).text());
      const w = num($(cells[3]).text());
      const l = num($(cells[4]).text());
      const otl = num($(cells[5]).text());
      const sol = num($(cells[6]).text());
      const pts = num($(cells[7]).text());
      const pct = num($(cells[8]).text());
      const gf = num($(cells[9]).text());
      const ga = num($(cells[10]).text());
      const home = $(cells[14])?.text().trim() || "";
      const away = $(cells[15])?.text().trim() || "";
      const streak = $(cells[17])?.text().trim() || "";

      standings.push({
        teamId: config?.id || null,
        teamName,
        division: currentDivision || config?.division || null,
        conference: currentConference || config?.conference || null,
        primaryColor: config?.primaryColor || "#555",
        secondaryColor: config?.secondaryColor || "#999",
        logoUrl: config?.logoUrl || null,
        gp,
        w,
        l,
        otl,
        sol,
        pts,
        pct,
        gf,
        ga,
        diff: gf - ga,
        home,
        away,
        streak,
      });
    });

    if (standings.length === 0) {
      throw new Error("No standings data parsed");
    }

    const result = { standings, scrapedAt: new Date().toISOString(), stale: false };
    setCacheEntry(CACHE_KEYS.STANDINGS, result, CACHE_TTL.STANDINGS);
    return result;
  } catch (err) {
    markCacheError(CACHE_KEYS.STANDINGS, err.message);
    const stale = getCacheEntry(CACHE_KEYS.STANDINGS);
    if (stale) return { ...stale, stale: true, error: err.message };
    throw err;
  }
}
