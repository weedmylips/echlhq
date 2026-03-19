import { useEffect } from "react";
import { useStandings, useScores, useMatchupPlayers } from "../hooks/useECHL.js";
import { TEAMS } from "../config/teamConfig.js";
import "./MatchupModal.css";

// Map team timezone based on arena location
const TEAM_TIMEZONES = {
  // Eastern
  74: "America/New_York", 10: "America/New_York", 8: "America/New_York",
  108: "America/New_York", 52: "America/New_York", 79: "America/New_York",
  101: "America/New_York", 63: "America/New_York", 13: "America/New_York",
  55: "America/New_York", 97: "America/New_York", 50: "America/New_York",
  61: "America/New_York", 104: "America/New_York",
  // Eastern (OH/MI)
  5: "America/New_York", 53: "America/New_York", 70: "America/New_York",
  // Quebec
  103: "America/New_York",
  // Central
  107: "America/Chicago", 60: "America/Chicago", 65: "America/Chicago",
  98: "America/Chicago", 56: "America/Chicago", 72: "America/Chicago",
  96: "America/Chicago", 66: "America/Chicago",
  // Mountain
  85: "America/Denver", 106: "America/Denver", 11: "America/Boise",
  109: "America/Los_Angeles",
};

function formatGameTime(timeStr, homeTeamId) {
  // Parse "7:00 PM EDT" → convert to home team's timezone
  const tz = TEAM_TIMEZONES[homeTeamId];
  if (!tz) return timeStr;

  // Extract hour, minute, ampm from the time string
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*(\w+)/i);
  if (!m) return timeStr;

  const [, hourStr, minStr, ampm, srcTz] = m;
  let hour = parseInt(hourStr);
  const min = parseInt(minStr);
  if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  // Map source timezone abbreviation to offset
  const tzOffsets = { EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7 };
  const srcOffset = tzOffsets[srcTz.toUpperCase()];
  if (srcOffset === undefined) return timeStr;

  // Convert to UTC then to target timezone using Intl
  const utcMs = Date.UTC(2026, 0, 1, hour - srcOffset, min);
  const d = new Date(utcMs);
  const formatted = d.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzAbbr = d.toLocaleTimeString("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).split(" ").pop();

  return `${formatted} ${tzAbbr}`;
}

export default function MatchupModal({ visitingTeamId, homeTeamId, date, time, onClose }) {
  const { data: standingsData } = useStandings();
  const { data: scoresData } = useScores();
  const { team1, team2, isLoading: playersLoading } = useMatchupPlayers(visitingTeamId, homeTeamId);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const standings = standingsData?.standings || [];
  const scores = scoresData?.scores || [];
  const visiting = standings.find((t) => t.teamId === visitingTeamId);
  const home = standings.find((t) => t.teamId === homeTeamId);
  const visitingConfig = TEAMS[visitingTeamId];
  const homeConfig = TEAMS[homeTeamId];

  const totalTeams = standings.filter((t) => t.gp > 0).length;

  // Compute league ranks for stats
  function leagueRank(teamId, getter, ascending = false) {
    const sorted = [...standings]
      .filter((t) => t.gp > 0)
      .sort((a, b) => ascending ? getter(a) - getter(b) : getter(b) - getter(a));
    return sorted.findIndex((t) => t.teamId === teamId) + 1;
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // H2H record
  const visitingCity = visitingConfig?.city?.toLowerCase() || "";
  const homeCity = homeConfig?.city?.toLowerCase() || "";
  const h2hGames = scores.filter((g) =>
    ((g.homeTeam || "").toLowerCase().includes(visitingCity) && (g.visitingTeam || "").toLowerCase().includes(homeCity)) ||
    ((g.homeTeam || "").toLowerCase().includes(homeCity) && (g.visitingTeam || "").toLowerCase().includes(visitingCity))
  );
  let vWins = 0, hWins = 0;
  h2hGames.forEach((g) => {
    const homeIsHome = (g.homeTeam || "").toLowerCase().includes(homeCity);
    const homeScore = homeIsHome ? g.homeScore : g.visitingScore;
    const visitingScore = homeIsHome ? g.visitingScore : g.homeScore;
    if (homeScore > visitingScore) hWins++;
    else vWins++;
  });

  // Build stat rows with comparison info
  const statRows = visiting && home ? [
    {
      label: "PP%",
      vVal: `${visiting.ppPct}%`,
      hVal: `${home.ppPct}%`,
      vRank: leagueRank(visitingTeamId, (t) => t.ppPct || 0),
      hRank: leagueRank(homeTeamId, (t) => t.ppPct || 0),
      vBetter: (visiting.ppPct || 0) > (home.ppPct || 0),
      hBetter: (home.ppPct || 0) > (visiting.ppPct || 0),
    },
    {
      label: "PK%",
      vVal: `${visiting.pkPct}%`,
      hVal: `${home.pkPct}%`,
      vRank: leagueRank(visitingTeamId, (t) => t.pkPct || 0),
      hRank: leagueRank(homeTeamId, (t) => t.pkPct || 0),
      vBetter: (visiting.pkPct || 0) > (home.pkPct || 0),
      hBetter: (home.pkPct || 0) > (visiting.pkPct || 0),
    },
    {
      label: "GF/GP",
      vVal: visiting.gp > 0 ? (visiting.gf / visiting.gp).toFixed(2) : "—",
      hVal: home.gp > 0 ? (home.gf / home.gp).toFixed(2) : "—",
      vRank: leagueRank(visitingTeamId, (t) => t.gp > 0 ? t.gf / t.gp : 0),
      hRank: leagueRank(homeTeamId, (t) => t.gp > 0 ? t.gf / t.gp : 0),
      vBetter: visiting.gp > 0 && home.gp > 0 && (visiting.gf / visiting.gp) > (home.gf / home.gp),
      hBetter: visiting.gp > 0 && home.gp > 0 && (home.gf / home.gp) > (visiting.gf / visiting.gp),
    },
    {
      label: "GA/GP",
      vVal: visiting.gp > 0 ? (visiting.ga / visiting.gp).toFixed(2) : "—",
      hVal: home.gp > 0 ? (home.ga / home.gp).toFixed(2) : "—",
      vRank: leagueRank(visitingTeamId, (t) => t.gp > 0 ? t.ga / t.gp : 0, true),
      hRank: leagueRank(homeTeamId, (t) => t.gp > 0 ? t.ga / t.gp : 0, true),
      // Lower GA/GP is better
      vBetter: visiting.gp > 0 && home.gp > 0 && (visiting.ga / visiting.gp) < (home.ga / home.gp),
      hBetter: visiting.gp > 0 && home.gp > 0 && (home.ga / home.gp) < (visiting.ga / visiting.gp),
    },
  ] : [];

  const localTime = time ? formatGameTime(time, homeTeamId) : null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal matchup-modal">
        <div className="modal-header">
          <span className="modal-title">Matchup Preview</span>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body matchup-body">
          {/* Date & Time */}
          {(date || localTime) && (
            <div className="matchup-datetime">
              {date && <span>{date}</span>}
              {localTime && <span>{localTime}</span>}
            </div>
          )}

          {/* Team Header with Last 10 */}
          <div className="matchup-header">
            <div className="matchup-team-side">
              {visitingConfig && <img src={visitingConfig.logoUrl} alt="" className="matchup-logo" />}
              <span className="matchup-team-name">{visitingConfig?.city || "Away"}</span>
              {visiting && <span className="matchup-record">{visiting.w}-{visiting.l}-{visiting.otl}</span>}
              {visiting && <span className="matchup-last10">L10: {visiting.lastTen}</span>}
            </div>
            <div className="matchup-vs-block">
              <span className="matchup-vs">@</span>
              {h2hGames.length > 0 ? (
                <span className="matchup-h2h-inline">{vWins} - {hWins}</span>
              ) : (
                <span className="matchup-h2h-inline">1st Meeting</span>
              )}
            </div>
            <div className="matchup-team-side matchup-team-right">
              {homeConfig && <img src={homeConfig.logoUrl} alt="" className="matchup-logo" />}
              <span className="matchup-team-name">{homeConfig?.city || "Home"}</span>
              {home && <span className="matchup-record">{home.w}-{home.l}-{home.otl}</span>}
              {home && <span className="matchup-last10">L10: {home.lastTen}</span>}
            </div>
          </div>

          {/* Players to Watch */}
          <div className="matchup-section">
            <div className="matchup-section-title">Players to Watch <span className="matchup-subtitle">Last 5 Games</span></div>
            {playersLoading ? (
              <div className="loading-spinner" style={{ padding: 12 }}>Loading...</div>
            ) : (
              <div className="matchup-players">
                <div className="matchup-players-col">
                  {team1.length === 0 && <span className="matchup-muted">No data</span>}
                  {team1.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-highlight">
                        {p.highlight === "pts" && `${p.pts} pts`}
                        {p.highlight === "g" && `${p.g} goals`}
                        {p.highlight === "a" && `${p.a} assists`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="matchup-players-col matchup-players-right">
                  {team2.length === 0 && <span className="matchup-muted">No data</span>}
                  {team2.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-highlight">
                        {p.highlight === "pts" && `${p.pts} pts`}
                        {p.highlight === "g" && `${p.g} goals`}
                        {p.highlight === "a" && `${p.a} assists`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Team Stats Comparison with color bars */}
          {statRows.length > 0 && (
            <div className="matchup-section">
              <div className="matchup-section-title">Team Stats</div>
              <div className="matchup-stats-table">
                {statRows.map((row) => (
                  <div key={row.label} className="matchup-stat-row">
                    <div className={`matchup-stat-val matchup-stat-left ${row.vBetter ? "stat-better" : row.hBetter ? "stat-worse" : ""}`}>
                      <div className="stat-bar-bg">
                        <div className={`stat-bar ${row.vBetter ? "stat-bar-good" : row.hBetter ? "stat-bar-bad" : "stat-bar-neutral"}`}
                             style={{ width: `${Math.min(100, (1 - (row.vRank - 1) / (totalTeams - 1)) * 100)}%` }} />
                      </div>
                      <span className="matchup-stat-num">{row.vVal}</span>
                      <span className="matchup-stat-rank">{ordinal(row.vRank)}</span>
                    </div>
                    <div className="matchup-stat-label">{row.label}</div>
                    <div className={`matchup-stat-val matchup-stat-right ${row.hBetter ? "stat-better" : row.vBetter ? "stat-worse" : ""}`}>
                      <div className="stat-bar-bg">
                        <div className={`stat-bar ${row.hBetter ? "stat-bar-good" : row.vBetter ? "stat-bar-bad" : "stat-bar-neutral"}`}
                             style={{ width: `${Math.min(100, (1 - (row.hRank - 1) / (totalTeams - 1)) * 100)}%` }} />
                      </div>
                      <span className="matchup-stat-num">{row.hVal}</span>
                      <span className="matchup-stat-rank">{ordinal(row.hRank)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
