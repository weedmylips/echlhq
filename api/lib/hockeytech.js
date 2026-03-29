/**
 * Shared HockeyTech API helpers for Vercel serverless functions.
 * Handles fetching, JSONP stripping, team ID mapping, and data transformation.
 */

const BASE = "https://lscluster.hockeytech.com/feed/index.php";
const CLIENT_CODE = "echl";
const SEASON_ID = "73";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "application/json, text/html",
  Referer: "https://www.echl.com/",
};

// ─── API Fetch ───────────────────────────────────────────────────────────────

function apiUrl(feed, view, extra = {}) {
  const key = process.env.HOCKEYTECH_API_KEY;
  if (!key) throw new Error("HOCKEYTECH_API_KEY not set");
  const p = new URLSearchParams({ client_code: CLIENT_CODE, key, lang: "en", feed, view, ...extra });
  return `${BASE}?${p}`;
}

async function apiFetch(feed, view, extra = {}) {
  const u = apiUrl(feed, view, extra);
  const res = await fetch(u, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HockeyTech HTTP ${res.status}`);
  let text = await res.text();
  text = text.trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1);
  return JSON.parse(text);
}

// ─── Team Config ─────────────────────────────────────────────────────────────

const TEAMS = {
  74:  { id: 74,  city: "Adirondack",     abbr: "ADK", division: "North",    conference: "Eastern", primaryColor: "#C8102E", secondaryColor: "#A2AAAD" },
  66:  { id: 66,  city: "Allen",          abbr: "ALN", division: "Mountain", conference: "Western", primaryColor: "#A6192E", secondaryColor: "#0C2340" },
  10:  { id: 10,  city: "Atlanta",        abbr: "ATL", division: "South",    conference: "Eastern", primaryColor: "#FF9E1B", secondaryColor: "#0C2340" },
  107: { id: 107, city: "Bloomington",    abbr: "BLM", division: "Central",  conference: "Western", primaryColor: "#5BC2E7", secondaryColor: "#C8102E" },
  5:   { id: 5,   city: "Cincinnati",     abbr: "CIN", division: "Central",  conference: "Western", primaryColor: "#C8102E", secondaryColor: "#A2AAAD" },
  8:   { id: 8,   city: "Florida",        abbr: "FLA", division: "South",    conference: "Eastern", primaryColor: "#046A38", secondaryColor: "#00205B" },
  60:  { id: 60,  city: "Fort Wayne",     abbr: "FW",  division: "Central",  conference: "Western", primaryColor: "#FA4616", secondaryColor: "#010101" },
  108: { id: 108, city: "Greensboro",     abbr: "GSO", division: "North",    conference: "Eastern", primaryColor: "#512179", secondaryColor: "#A08629" },
  52:  { id: 52,  city: "Greenville",     abbr: "GVL", division: "South",    conference: "Eastern", primaryColor: "#CB6015", secondaryColor: "#041E42" },
  11:  { id: 11,  city: "Idaho",          abbr: "IDH", division: "Mountain", conference: "Western", primaryColor: "#002855", secondaryColor: "#A2AAAD" },
  65:  { id: 65,  city: "Indy",           abbr: "IND", division: "Central",  conference: "Western", primaryColor: "#C8102E", secondaryColor: "#FFB549" },
  98:  { id: 98,  city: "Iowa",           abbr: "IA",  division: "Central",  conference: "Western", primaryColor: "#FFD100", secondaryColor: "#010101" },
  79:  { id: 79,  city: "Jacksonville",   abbr: "JAX", division: "South",    conference: "Eastern", primaryColor: "#0072CE", secondaryColor: "#041E42" },
  53:  { id: 53,  city: "Kalamazoo",      abbr: "KAL", division: "Central",  conference: "Western", primaryColor: "#A6192E", secondaryColor: "#041E42" },
  56:  { id: 56,  city: "Kansas City",    abbr: "KC",  division: "Mountain", conference: "Western", primaryColor: "#FA4616", secondaryColor: "#010101" },
  101: { id: 101, city: "Maine",          abbr: "MNE", division: "North",    conference: "Eastern", primaryColor: "#007A33", secondaryColor: "#003349" },
  63:  { id: 63,  city: "Norfolk",        abbr: "NOR", division: "North",    conference: "Eastern", primaryColor: "#00205B", secondaryColor: "#FFC72C" },
  13:  { id: 13,  city: "Orlando",        abbr: "ORL", division: "South",    conference: "Eastern", primaryColor: "#582C83", secondaryColor: "#FC4C02" },
  85:  { id: 85,  city: "Rapid City",     abbr: "RC",  division: "Mountain", conference: "Western", primaryColor: "#A6192E", secondaryColor: "#B3A369" },
  55:  { id: 55,  city: "Reading",        abbr: "REA", division: "North",    conference: "Eastern", primaryColor: "#582C83", secondaryColor: "#FA4616" },
  97:  { id: 97,  city: "Savannah",       abbr: "SAV", division: "South",    conference: "Eastern", primaryColor: "#44D62C", secondaryColor: "#010101" },
  50:  { id: 50,  city: "South Carolina", abbr: "SC",  division: "South",    conference: "Eastern", primaryColor: "#A6192E", secondaryColor: "#041E42" },
  109: { id: 109, city: "Tahoe",          abbr: "TAH", division: "Mountain", conference: "Western", primaryColor: "#006271", secondaryColor: "#B9975B" },
  70:  { id: 70,  city: "Toledo",         abbr: "TOL", division: "Central",  conference: "Western", primaryColor: "#489FDF", secondaryColor: "#0C2340" },
  103: { id: 103, city: "Trois-Rivières", abbr: "TR",  division: "North",    conference: "Eastern", primaryColor: "#1D4289", secondaryColor: "#C8102E" },
  72:  { id: 72,  city: "Tulsa",          abbr: "TUL", division: "Mountain", conference: "Western", primaryColor: "#0C2340", secondaryColor: "#76232F" },
  106: { id: 106, city: "Utah",           abbr: "UTA", division: "Mountain", conference: "Western", primaryColor: "#004E42", secondaryColor: "#8C6A51" },
  61:  { id: 61,  city: "Wheeling",       abbr: "WHL", division: "North",    conference: "Eastern", primaryColor: "#FFB81C", secondaryColor: "#010101" },
  96:  { id: 96,  city: "Wichita",        abbr: "WIC", division: "Mountain", conference: "Western", primaryColor: "#0057B7", secondaryColor: "#101820" },
  104: { id: 104, city: "Worcester",      abbr: "WOR", division: "North",    conference: "Eastern", primaryColor: "#002855", secondaryColor: "#ADB3B8" },
};

// ─── Team ID Mapping ─────────────────────────────────────────────────────────

const INTERNAL_TO_HT = {
  5:5, 8:8, 10:10, 11:11, 13:61, 50:18, 52:52, 53:50, 55:17, 56:68,
  60:60, 61:25, 63:76, 65:65, 66:66, 70:21, 72:71, 74:74, 79:79, 85:70,
  96:72, 97:102, 98:98, 101:82, 103:99, 104:77, 106:23, 107:107, 108:108, 109:106,
};
const HT_TO_INTERNAL = Object.fromEntries(
  Object.entries(INTERNAL_TO_HT).map(([k, v]) => [String(v), Number(k)])
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function num(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function pctNum(v) { return num(String(v).replace("%", "")); }

/** Filter junk rows from statviewtype: "Totals", "Empty Net", multi-team aggregates */
function isRealPlayer(p) {
  if (!p.player_id) return false;
  if (p.is_total === 1 || p.is_total === "1") return false;
  const name = (p.name || "").trim().toLowerCase();
  if (name === "totals" || name === "empty net") return false;
  return true;
}

function formatDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Extract team rows from statviewfeed/teams sections response */
function extractStandingsTeams(data) {
  const teams = [];
  const container = Array.isArray(data) ? data[0] : data;
  if (!container?.sections) return teams;
  for (const section of container.sections) {
    const divName = section.headers?.team_code?.properties?.label ||
                    section.headers?.name?.properties?.label || "Unknown";
    for (const entry of section.data || []) {
      const row = entry.row || {};
      const htId = entry.prop?.team_code?.teamLink || entry.prop?.name?.teamLink;
      teams.push({ ...row, _division: divName, _htId: htId });
    }
  }
  return teams;
}

/** Set cache headers on response */
function setCache(res, maxAge, swr) {
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${swr || maxAge * 2}`);
}

module.exports = {
  apiFetch,
  TEAMS,
  INTERNAL_TO_HT,
  HT_TO_INTERNAL,
  SEASON_ID,
  MONTHS,
  num,
  pctNum,
  isRealPlayer,
  formatDate,
  extractStandingsTeams,
  setCache,
};
