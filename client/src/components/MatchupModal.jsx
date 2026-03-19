import { useEffect } from "react";
import { useStandings, useScores, useMatchupPlayers } from "../hooks/useECHL.js";
import { TEAMS } from "../config/teamConfig.js";
import "./MatchupModal.css";

export default function MatchupModal({ visitingTeamId, homeTeamId, onClose }) {
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

  const statRows = visiting && home ? [
    {
      label: "PP%",
      vVal: `${visiting.ppPct}%`,
      hVal: `${home.ppPct}%`,
      vRank: leagueRank(visitingTeamId, (t) => t.ppPct || 0),
      hRank: leagueRank(homeTeamId, (t) => t.ppPct || 0),
    },
    {
      label: "PK%",
      vVal: `${visiting.pkPct}%`,
      hVal: `${home.pkPct}%`,
      vRank: leagueRank(visitingTeamId, (t) => t.pkPct || 0),
      hRank: leagueRank(homeTeamId, (t) => t.pkPct || 0),
    },
    {
      label: "GF/GP",
      vVal: visiting.gp > 0 ? (visiting.gf / visiting.gp).toFixed(2) : "—",
      hVal: home.gp > 0 ? (home.gf / home.gp).toFixed(2) : "—",
      vRank: leagueRank(visitingTeamId, (t) => t.gp > 0 ? t.gf / t.gp : 0),
      hRank: leagueRank(homeTeamId, (t) => t.gp > 0 ? t.gf / t.gp : 0),
    },
    {
      label: "GA/GP",
      vVal: visiting.gp > 0 ? (visiting.ga / visiting.gp).toFixed(2) : "—",
      hVal: home.gp > 0 ? (home.ga / home.gp).toFixed(2) : "—",
      vRank: leagueRank(visitingTeamId, (t) => t.gp > 0 ? t.ga / t.gp : 0, true),
      hRank: leagueRank(homeTeamId, (t) => t.gp > 0 ? t.ga / t.gp : 0, true),
    },
  ] : [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal matchup-modal">
        <div className="modal-header">
          <span className="modal-title">Matchup Preview</span>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body matchup-body">
          {/* Team Header */}
          <div className="matchup-header">
            <div className="matchup-team-side">
              {visitingConfig && <img src={visitingConfig.logoUrl} alt="" className="matchup-logo" />}
              <span className="matchup-team-name">{visitingConfig?.city || "Away"}</span>
              {visiting && <span className="matchup-record">{visiting.w}-{visiting.l}-{visiting.otl}</span>}
            </div>
            <span className="matchup-vs">@</span>
            <div className="matchup-team-side matchup-team-right">
              {homeConfig && <img src={homeConfig.logoUrl} alt="" className="matchup-logo" />}
              <span className="matchup-team-name">{homeConfig?.city || "Home"}</span>
              {home && <span className="matchup-record">{home.w}-{home.l}-{home.otl}</span>}
            </div>
          </div>

          {/* Players to Watch */}
          <div className="matchup-section">
            <div className="matchup-section-title">Players to Watch <span className="matchup-subtitle">Last 5 Games</span></div>
            {playersLoading ? (
              <div className="loading-spinner" style={{ padding: 12 }}>Loading players...</div>
            ) : (
              <div className="matchup-players">
                <div className="matchup-players-col">
                  {team1.length === 0 && <span className="matchup-muted">No data</span>}
                  {team1.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-stats">
                        {p.g}G {p.a}A {p.pts}PTS
                      </span>
                    </div>
                  ))}
                </div>
                <div className="matchup-players-col matchup-players-right">
                  {team2.length === 0 && <span className="matchup-muted">No data</span>}
                  {team2.map((p) => (
                    <div key={p.name} className="matchup-player">
                      <span className="matchup-player-name">{p.name}</span>
                      <span className="matchup-player-stats">
                        {p.g}G {p.a}A {p.pts}PTS
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Team Stats Comparison */}
          {statRows.length > 0 && (
            <div className="matchup-section">
              <div className="matchup-section-title">Team Stats</div>
              <div className="matchup-stats-table">
                {statRows.map((row) => (
                  <div key={row.label} className="matchup-stat-row">
                    <div className="matchup-stat-val matchup-stat-left">
                      <span className="matchup-stat-num">{row.vVal}</span>
                      <span className="matchup-stat-rank">{ordinal(row.vRank)}</span>
                    </div>
                    <div className="matchup-stat-label">{row.label}</div>
                    <div className="matchup-stat-val matchup-stat-right">
                      <span className="matchup-stat-num">{row.hVal}</span>
                      <span className="matchup-stat-rank">{ordinal(row.hRank)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last 10 & H2H */}
          <div className="matchup-records">
            {visiting && home && (
              <div className="matchup-section matchup-record-section">
                <div className="matchup-section-title">Last 10</div>
                <div className="matchup-last10">
                  <div className="matchup-last10-side">
                    <span className="matchup-last10-label">{visitingConfig?.city}</span>
                    <span className="matchup-last10-val">{visiting.lastTen}</span>
                  </div>
                  <div className="matchup-last10-side matchup-last10-right">
                    <span className="matchup-last10-label">{homeConfig?.city}</span>
                    <span className="matchup-last10-val">{home.lastTen}</span>
                  </div>
                </div>
              </div>
            )}
            {h2hGames.length > 0 && (
              <div className="matchup-section matchup-record-section">
                <div className="matchup-section-title">Season Series</div>
                <div className="matchup-h2h">
                  <span className="matchup-h2h-team">{visitingConfig?.city} {vWins}</span>
                  <span className="matchup-h2h-sep">-</span>
                  <span className="matchup-h2h-team">{hWins} {homeConfig?.city}</span>
                </div>
              </div>
            )}
            {h2hGames.length === 0 && (
              <div className="matchup-section matchup-record-section">
                <div className="matchup-section-title">Season Series</div>
                <div className="matchup-muted" style={{ textAlign: "center", padding: 8 }}>First meeting</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
