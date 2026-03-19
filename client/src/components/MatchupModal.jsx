import { useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useStandings, useScores, useLeaders, useUpcoming, useMatchupPlayers } from "../hooks/useECHL.js";
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
  // Eastern (OH/MI/Quebec)
  5: "America/New_York", 53: "America/New_York", 70: "America/New_York",
  103: "America/New_York",
  // Central
  107: "America/Chicago", 60: "America/Chicago", 65: "America/Chicago",
  98: "America/Chicago", 56: "America/Chicago", 72: "America/Chicago",
  96: "America/Chicago", 66: "America/Chicago",
  // Mountain
  85: "America/Denver", 106: "America/Denver", 11: "America/Boise",
  109: "America/Los_Angeles",
};

const TZ_OFFSETS = { EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7 };

// Convert a time string like "7:00 PM EDT" to a given IANA timezone, using
// a reference date string (e.g. "Mar 20, 2026") for correct DST handling.
function convertTime(timeStr, dateStr, targetTz) {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*(\w+)/i);
  if (!m) return null;
  const [, hourStr, minStr, ampm, srcTzAbbr] = m;
  let hour = parseInt(hourStr);
  const min = parseInt(minStr);
  if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  const srcOffset = TZ_OFFSETS[srcTzAbbr.toUpperCase()];
  if (srcOffset === undefined) return null;

  // Use a date near the game for correct DST in the target timezone
  const refDate = dateStr ? new Date(dateStr) : new Date(2026, 2, 15);
  const utcMs = Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), hour - srcOffset, min);
  const d = new Date(utcMs);
  const formatted = d.toLocaleTimeString("en-US", {
    timeZone: targetTz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzAbbr = d.toLocaleTimeString("en-US", {
    timeZone: targetTz,
    timeZoneName: "short",
  }).split(" ").pop();
  return `${formatted} ${tzAbbr}`;
}

// Milestones to check for goals and points
const MILESTONES = [20, 30, 40, 50, 60, 70, 80];

export default function MatchupModal({ visitingTeamId, homeTeamId, date, time, onClose }) {
  const { data: standingsData } = useStandings();
  const { data: scoresData } = useScores();
  const { data: leadersData } = useLeaders();
  const { data: upcomingData } = useUpcoming();
  const { team1, team2, isLoading: playersLoading } = useMatchupPlayers(visitingTeamId, homeTeamId);

  // Show last-5 stats only if this game is the very next scheduled game for both teams
  const isNearGame = useMemo(() => {
    const games = upcomingData?.games || [];
    const nextFor = (teamId) =>
      games.find((g) => g.visitingTeamId === teamId || g.homeTeamId === teamId);
    const nextV = nextFor(visitingTeamId);
    const nextH = nextFor(homeTeamId);
    const isNextV = nextV && nextV.date === date && (nextV.visitingTeamId === visitingTeamId || nextV.homeTeamId === visitingTeamId);
    const isNextH = nextH && nextH.date === date && (nextH.visitingTeamId === homeTeamId || nextH.homeTeamId === homeTeamId);
    return !!(isNextV && isNextH);
  }, [upcomingData, visitingTeamId, homeTeamId, date]);

  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    // Lock body scroll and reset overlay scroll position on mobile
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.scrollTop = 0;
    });
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const standings = standingsData?.standings || [];
  const scores = scoresData?.scores || [];
  const visiting = standings.find((t) => t.teamId === visitingTeamId);
  const home = standings.find((t) => t.teamId === homeTeamId);
  const visitingConfig = TEAMS[visitingTeamId];
  const homeConfig = TEAMS[homeTeamId];

  const totalTeams = standings.filter((t) => t.gp > 0).length;

  // Season stats from leaders.json (used when game is > 3 days away)
  const leaders = leadersData?.leaders || {};
  const visitingAbbr = visitingConfig?.abbr || "";
  const homeAbbr = homeConfig?.abbr || "";

  const seasonPlayers = useMemo(() => {
    if (!leaders.allPoints) return { visiting: [], home: [], milestones: [] };

    function topThree(abbr) {
      const pts = (leaders.allPoints || []).filter((p) => p.team === abbr);
      const goalsMap = {};
      (leaders.allGoals || []).forEach((p) => { if (p.team === abbr) goalsMap[p.name] = p.value; });
      const assistsMap = {};
      (leaders.allAssists || []).forEach((p) => { if (p.team === abbr) assistsMap[p.name] = p.value; });
      return pts.slice(0, 3).map((p) => ({
        name: p.name,
        g: goalsMap[p.name] || 0,
        a: assistsMap[p.name] || 0,
        pts: p.value,
      }));
    }

    function findMilestones(abbr) {
      const chasers = [];
      const ptsList = (leaders.allPoints || []).filter((p) => p.team === abbr).slice(0, 10);
      const goalsList = (leaders.allGoals || []).filter((p) => p.team === abbr).slice(0, 10);

      for (const p of ptsList) {
        for (const m of MILESTONES) {
          const away = m - p.value;
          if (away > 0 && away <= 5) {
            chasers.push({ name: p.name, away, milestone: m, stat: "pts" });
            break;
          }
        }
      }
      for (const p of goalsList) {
        for (const m of MILESTONES) {
          const away = m - p.value;
          if (away > 0 && away <= 5) {
            if (!chasers.find((c) => c.name === p.name && c.stat === "goals"))
              chasers.push({ name: p.name, away, milestone: m, stat: "goals" });
            break;
          }
        }
      }
      return chasers;
    }

    return {
      visiting: topThree(visitingAbbr),
      home: topThree(homeAbbr),
      milestones: [...findMilestones(visitingAbbr).map((m) => ({ ...m, teamAbbr: visitingAbbr })),
                   ...findMilestones(homeAbbr).map((m) => ({ ...m, teamAbbr: homeAbbr }))]
                   .sort((a, b) => b.milestone - a.milestone)
                   .slice(0, 5),
    };
  }, [isNearGame, leaders, visitingAbbr, homeAbbr]);

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
      vVal: visiting.ppPct != null ? `${visiting.ppPct}%` : "—",
      hVal: home.ppPct != null ? `${home.ppPct}%` : "—",
      vRank: leagueRank(visitingTeamId, (t) => t.ppPct || 0),
      hRank: leagueRank(homeTeamId, (t) => t.ppPct || 0),
      vBetter: (visiting.ppPct || 0) > (home.ppPct || 0),
      hBetter: (home.ppPct || 0) > (visiting.ppPct || 0),
    },
    {
      label: "PK%",
      vVal: visiting.pkPct != null ? `${visiting.pkPct}%` : "—",
      hVal: home.pkPct != null ? `${home.pkPct}%` : "—",
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

  // Time display: the time from data is already the home team's local time.
  // If visiting team is in a different timezone, also show their local time.
  const homeTz = TEAM_TIMEZONES[homeTeamId];
  const visitingTz = TEAM_TIMEZONES[visitingTeamId];
  const showVisitingTime = time && visitingTz && homeTz && visitingTz !== homeTz;
  const visitingTime = showVisitingTime ? convertTime(time, date, visitingTz) : null;

  return (
    <div className="modal-overlay matchup-overlay" ref={overlayRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal matchup-modal">
        <Helmet>
          <title>{visitingConfig?.city || "Away"} vs {homeConfig?.city || "Home"} Matchup Preview{date ? ` · ${date}` : ""}</title>
          <meta name="description" content={`${visitingConfig?.name || "Away"} (${visiting?.w ?? 0}-${visiting?.l ?? 0}-${visiting?.otl ?? 0}) vs ${homeConfig?.name || "Home"} (${home?.w ?? 0}-${home?.l ?? 0}-${home?.otl ?? 0}) — H2H record, special teams, players to watch`} />
          <meta property="og:title" content={`${visitingConfig?.city || "Away"} vs ${homeConfig?.city || "Home"} Matchup Preview`} />
          <meta property="og:description" content={`${visitingConfig?.name || "Away"} vs ${homeConfig?.name || "Home"} — H2H record, special teams, players to watch`} />
        </Helmet>
        <div className="modal-header">
          <span className="modal-title">Matchup Preview</span>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body matchup-body">
          {/* Date & Time */}
          {(date || time) && (
            <div className="matchup-datetime">
              {date && <span>{date}</span>}
              {time && <span>{time}</span>}
              {visitingTime && <span className="matchup-alt-time">({visitingTime})</span>}
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

          {/* Players section — next game gets last-5 stats + milestones, later games get season totals */}
          {isNearGame ? (
            <>
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
                          <span className="matchup-player-stats">{p.g}G {p.a}A {p.pts}PTS</span>
                        </div>
                      ))}
                    </div>
                    <div className="matchup-players-col matchup-players-right">
                      {team2.length === 0 && <span className="matchup-muted">No data</span>}
                      {team2.map((p) => (
                        <div key={p.name} className="matchup-player">
                          <span className="matchup-player-name">{p.name}</span>
                          <span className="matchup-player-stats">{p.g}G {p.a}A {p.pts}PTS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {seasonPlayers.milestones.length > 0 && (
                <div className="matchup-section">
                  <div className="matchup-section-title">Milestone Chasers</div>
                  <div className="matchup-milestones">
                    {seasonPlayers.milestones.map((m) => {
                      const current = m.milestone - m.away;
                      const prevMilestone = MILESTONES.slice().reverse().find((v) => v < m.milestone) || 0;
                      const range = m.milestone - prevMilestone;
                      const pct = Math.min(100, Math.round(((current - prevMilestone) / range) * 100));
                      return (
                        <div key={`${m.name}-${m.stat}`} className="matchup-milestone">
                          <div className="matchup-milestone-top">
                            <span className="matchup-milestone-name">{m.name}</span>
                            <span className="matchup-milestone-tag">{m.teamAbbr}</span>
                            <span className="matchup-milestone-away">
                              {m.away} {m.stat === "goals" ? "G" : "PTS"} from {m.milestone}
                            </span>
                          </div>
                          <div className="matchup-milestone-bar-bg">
                            <div className="matchup-milestone-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="matchup-milestone-range">
                            <span>{prevMilestone}</span>
                            <span>{current} / {m.milestone}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="matchup-section">
              <div className="matchup-section-title">Key Players <span className="matchup-subtitle">Season Stats</span></div>
              <div className="matchup-players">
                <div className="matchup-players-col">
                  {seasonPlayers.visiting.length === 0 && <span className="matchup-muted">No data</span>}
                  {seasonPlayers.visiting.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-stats">{p.g}G {p.a}A {p.pts}PTS</span>
                    </div>
                  ))}
                </div>
                <div className="matchup-players-col matchup-players-right">
                  {seasonPlayers.home.length === 0 && <span className="matchup-muted">No data</span>}
                  {seasonPlayers.home.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-stats">{p.g}G {p.a}A {p.pts}PTS</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team Stats Comparison with color bars */}
          {statRows.length > 0 && (
            <div className="matchup-section">
              <div className="matchup-section-title">Team Stats</div>
              <div className="matchup-stats-logos">
                <img src={visitingConfig?.logoUrl} alt={visitingConfig?.city || ""} className="matchup-stats-logo" />
                <span />
                <img src={homeConfig?.logoUrl} alt={homeConfig?.city || ""} className="matchup-stats-logo" />
              </div>
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
