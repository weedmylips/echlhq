import * as cheerio from "cheerio";
import fetch from "node-fetch";
import {
  getCacheEntry,
  setCacheEntry,
  markCacheError,
  CACHE_KEYS,
  CACHE_TTL,
} from "../config/cache.js";

const DAILY_REPORT_URL =
  "https://cluster.leaguestat.com/download.php?client_code=echl&file_path=daily-report/daily-report.html";

function parseNum(str) {
  if (!str) return 0;
  const v = parseFloat(str.trim().replace(/[^0-9.\-]/g, ""));
  return isNaN(v) ? 0 : v;
}

// Strip clinch/status markers (* x y z) and extra whitespace from player names
function cleanName(raw) {
  return raw
    .trim()
    .replace(/^[\*xyz]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse a drtable that has columns: #, NAME, TEAM, ..., STAT
// Detect the stat column by the header label
function parseLeaderTable($, table, nameColHeader, statColHeader) {
  const headers = [];
  $(table)
    .find("tr")
    .first()
    .find("th")
    .each((_, th) => headers.push($(th).text().trim().toUpperCase()));

  const nameIdx = headers.findIndex((h) => h === nameColHeader.toUpperCase());
  const teamIdx = headers.findIndex((h) => h === "TEAM");
  const statIdx = headers.findIndex((h) => h === statColHeader.toUpperCase());

  if (nameIdx < 0 || statIdx < 0) return [];

  const leaders = [];
  $(table)
    .find("tr")
    .each((i, row) => {
      if (i === 0) return; // skip header
      const cells = $(row).find("td");
      if (cells.length <= statIdx) return;
      const name = cleanName($(cells[nameIdx]).text());
      const team = teamIdx >= 0 ? $(cells[teamIdx]).text().trim() : "";
      const value = parseNum($(cells[statIdx]).text());
      const rank = parseNum($(cells[0]).text()) || i;
      // Skip rows with no real name (e.g. "several tied" notes)
      if (name && !name.toLowerCase().includes("several") && !name.toLowerCase().includes("tied")) {
        leaders.push({ rank, name, team, value });
      }
    });
  return leaders;
}

// Parse scores from "Yesterday's Results" / "Thursday's Results" style cells
function parseScores($) {
  const scores = [];
  // The report has a table with "Results" header and score text in .smallertext cells
  // Pattern: "Toledo 5 at Savannah 3" or "Wichita 3 at Rapid City 4 (OT)"
  $("td.smallertext, td[class*='smallertext']").each((_, el) => {
    const prevText = $(el).prev("td").text() || $(el).closest("tr").prev().find("td").first().text();
    const thisText = $(el).html() || "";
    // Only parse the "Results" cell (first smallertext in its row)
    const lines = thisText.split(/<br\s*\/?>/i);
    lines.forEach((line) => {
      const text = cheerio.load(line).text().trim();
      if (!text) return;
      // Match: "Team1 score1 at Team2 score2 [optional OT/SO]"
      const m = text.match(/^(.+?)\s+(\d+)\s+at\s+(.+?)\s+(\d+)(?:\s*\((OT|SO)\))?/);
      if (m) {
        scores.push({
          visitingTeam: m[1].trim(),
          visitingScore: parseInt(m[2]),
          homeTeam: m[3].trim(),
          homeScore: parseInt(m[4]),
          overtime: m[5] || null,
          score: `${m[2]}-${m[4]}${m[5] ? ` (${m[5]})` : ""}`,
          gameId: null, // daily report doesn't embed game IDs directly
          date: "Yesterday",
        });
      }
    });
    // Only parse the first smallertext td (results), not upcoming games
    return false; // Stop after first match
  });

  // Re-scan more carefully: find the first smallertext that has score patterns
  if (scores.length === 0) {
    $("td").each((_, el) => {
      const cls = $(el).attr("class") || $(el).attr("nowrap") || "";
      const html = $(el).html() || "";
      if (!html.includes(" at ")) return;
      const lines = html.split(/<br\s*\/?>/i);
      let found = false;
      lines.forEach((line) => {
        const text = cheerio.load(line).text().trim();
        const m = text.match(/^(.+?)\s+(\d+)\s+at\s+(.+?)\s+(\d+)(?:\s*\((OT|SO)\))?/);
        if (m) {
          found = true;
          scores.push({
            visitingTeam: m[1].trim(),
            visitingScore: parseInt(m[2]),
            homeTeam: m[3].trim(),
            homeScore: parseInt(m[4]),
            overtime: m[5] || null,
            score: `${m[2]}-${m[4]}${m[5] ? ` (${m[5]})` : ""}`,
            gameId: null,
            date: "Yesterday",
          });
        }
      });
      if (found) return false; // stop at first results cell
    });
  }
  return scores;
}

export async function fetchDailyReport() {
  const cached = getCacheEntry(CACHE_KEYS.DAILY_REPORT);
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

    // ---- Parse Leaders ----
    const leaders = { goals: [], assists: [], points: [], gaa: [], svPct: [] };

    // "Overall Leaders" section: each drtable has a header row with category name
    let inOverall = false;
    let inGoaltending = false;

    $("h2").each((_, h2) => {
      const title = $(h2).text().trim();
      if (title.includes("Overall Leaders")) {
        inOverall = true;
        inGoaltending = false;
        // Parse all drtable siblings until next h2
        let el = $(h2).next();
        while (el.length && el.prop("tagName") !== "H2") {
          el.find("table.drtable").each((_, table) => {
            const headers = $(table)
              .find("tr")
              .first()
              .find("th")
              .map((_, th) => $(th).text().trim().toUpperCase())
              .get();

            if (headers.includes("POINTS") && headers.includes("PTS")) {
              leaders.points = parseLeaderTable($, table, "POINTS", "PTS");
            } else if (headers.includes("GOALS") && headers.includes("G")) {
              leaders.goals = parseLeaderTable($, table, "GOALS", "G");
            } else if (headers.includes("ASSISTS") && headers.includes("A")) {
              leaders.assists = parseLeaderTable($, table, "ASSISTS", "A");
            }
          });
          el = el.next();
        }
      } else if (title.includes("Goaltending Leaders")) {
        inGoaltending = true;
        inOverall = false;
        let el = $(h2).next();
        while (el.length && el.prop("tagName") !== "H2") {
          el.find("table.drtable, table").each((_, table) => {
            const headers = $(table)
              .find("tr")
              .first()
              .find("th")
              .map((_, th) => $(th).text().trim().toUpperCase())
              .get();

            if (headers.includes("GAA")) {
              leaders.gaa = parseLeaderTable($, table, "\u00a0", "GAA");
              // Goalie name col might be blank header
              if (leaders.gaa.length === 0) {
                // Fallback: 2nd col is name
                const gaaLeaders = [];
                $(table).find("tr").each((i, row) => {
                  if (i === 0) return;
                  const cells = $(row).find("td");
                  if (cells.length < 3) return;
                  const rank = parseNum($(cells[0]).text()) || i;
                  const name = cleanName($(cells[1]).text());
                  const team = $(cells[2]).text().trim();
                  const gaaIdx = headers.indexOf("GAA");
                  const svIdx = headers.indexOf("SV%");
                  const gaa = gaaIdx >= 0 ? parseNum($(cells[gaaIdx]).text()) : 0;
                  const sv = svIdx >= 0 ? parseNum($(cells[svIdx]).text()) : 0;
                  if (name) {
                    gaaLeaders.push({ rank, name, team, value: gaa });
                    if (sv > 0 && leaders.svPct.length < 10) {
                      leaders.svPct.push({ rank, name, team, value: sv });
                    }
                  }
                });
                leaders.gaa = gaaLeaders;
              } else if (headers.includes("SV%")) {
                // Extract SV% from same table
                const svIdx = headers.indexOf("SV%");
                $(table).find("tr").each((i, row) => {
                  if (i === 0) return;
                  const cells = $(row).find("td");
                  if (cells.length <= svIdx) return;
                  const rank = parseNum($(cells[0]).text()) || i;
                  const name = $(cells[1]).text().trim();
                  const team = $(cells[2]).text().trim();
                  const sv = parseNum($(cells[svIdx]).text());
                  if (name && sv > 0) leaders.svPct.push({ rank, name, team, value: sv });
                });
              }
            }
          });
          el = el.next();
        }
      }
    });

    // If goals/assists not found separately, derive from points table
    if (leaders.goals.length === 0 && leaders.points.length > 0) {
      // Points table has G column
      // Re-parse the points table for goals
      let el2 = null;
      $("h2").each((_, h2) => {
        if ($(h2).text().includes("Overall Leaders")) el2 = $(h2);
      });
      if (el2) {
        let el = el2.next();
        while (el.length && el.prop("tagName") !== "H2") {
          el.find("table.drtable").each((_, table) => {
            const headers = $(table).find("tr").first().find("th")
              .map((_, th) => $(th).text().trim().toUpperCase()).get();
            if (headers.includes("PTS") && headers.includes("G") && headers.includes("A")) {
              const gIdx = headers.indexOf("G");
              const aIdx = headers.indexOf("A");
              const items = [];
              const aItems = [];
              $(table).find("tr").each((i, row) => {
                if (i === 0) return;
                const cells = $(row).find("td");
                if (cells.length <= Math.max(gIdx, aIdx)) return;
                const rank = i;
                const name = cleanName($(cells[1]).text());
                const team = $(cells[2]).text().trim();
                const g = parseNum($(cells[gIdx]).text());
                const a = parseNum($(cells[aIdx]).text());
                if (name) {
                  items.push({ rank, name, team, value: g });
                  aItems.push({ rank, name, team, value: a });
                }
              });
              if (leaders.goals.length === 0)
                leaders.goals = items.sort((a, b) => b.value - a.value);
              if (leaders.assists.length === 0)
                leaders.assists = aItems.sort((a, b) => b.value - a.value);
            }
          });
          el = el.next();
        }
      }
    }

    // Goaltending: parse the single drtable after "Goaltending Leaders" h2
    if (leaders.gaa.length === 0) {
      $("h2").each((_, h2) => {
        if (!$(h2).text().includes("Goaltending Leaders")) return;
        const tbl = $(h2).nextAll("table.drtable").first();
        if (!tbl.length) return;
        const headers = tbl.find("tr").first().find("th")
          .map((_, th) => $(th).text().trim().toUpperCase()).get();
        const gaaIdx = headers.indexOf("GAA");
        const svIdx = headers.indexOf("SV%");
        tbl.find("tr").each((i, row) => {
          if (i === 0) return;
          const cells = $(row).find("td");
          if (cells.length < 3) return;
          const rank = parseNum($(cells[0]).text()) || i;
          const name = cleanName($(cells[1]).text());
          const team = $(cells[2]).text().trim();
          if (!name) return;
          if (gaaIdx >= 0) leaders.gaa.push({ rank, name, team, value: parseNum($(cells[gaaIdx]).text()) });
          if (svIdx >= 0) leaders.svPct.push({ rank, name, team, value: parseNum($(cells[svIdx]).text()) });
        });
      });
    }

    // ---- Parse Scores ----
    const scores = parseScores($);

    // ---- Parse Attendance ----
    const attendance = [];
    $("h2").each((_, h2) => {
      if (!$(h2).text().includes("Attendance Report")) return;
      $(h2).nextAll("table.drtable").first().find("tr").each((i, row) => {
        if (i === 0) return;
        const cells = $(row).find("td");
        if (cells.length >= 2) {
          attendance.push({
            team: $(cells[0]).text().trim(),
            yesterday: $(cells[1]).text().trim(),
          });
        }
      });
    });

    const result = {
      leaders,
      scores,
      attendance,
      scrapedAt: new Date().toISOString(),
      stale: false,
    };

    setCacheEntry(CACHE_KEYS.DAILY_REPORT, result, CACHE_TTL.DAILY_REPORT);
    return result;
  } catch (err) {
    markCacheError(CACHE_KEYS.DAILY_REPORT, err.message);
    const stale = getCacheEntry(CACHE_KEYS.DAILY_REPORT);
    if (stale) return { ...stale, stale: true, error: err.message };
    throw err;
  }
}

export async function fetchLeaders() {
  const report = await fetchDailyReport();
  return { leaders: report.leaders, scrapedAt: report.scrapedAt, stale: report.stale, error: report.error };
}

export async function fetchScores() {
  const report = await fetchDailyReport();
  return { scores: report.scores, scrapedAt: report.scrapedAt, stale: report.stale, error: report.error };
}
