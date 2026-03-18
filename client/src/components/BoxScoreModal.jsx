import { useEffect } from "react";
import { useBoxscore } from "../hooks/useECHL.js";
import "./BoxScoreModal.css";

export default function BoxScoreModal({ gameId, onClose }) {
  const { data, isLoading, error } = useBoxscore(gameId);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Box Score</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {isLoading && <div className="loading-spinner">Loading box score…</div>}
          {error && <div className="error-box">Failed to load box score: {error.message}</div>}
          {data && <BoxScoreContent data={data} />}
        </div>
      </div>
    </div>
  );
}

function BoxScoreContent({ data }) {
  const { gameInfo, periodScoring, shotsByPeriod, skaterStats, goalieStats, penalties, stars = [] } = data;
  const hasData = periodScoring.length > 0 || shotsByPeriod.length > 0 ||
    skaterStats.home?.length > 0 || skaterStats.visiting?.length > 0;

  return (
    <div className="boxscore">
      {/* Score Header */}
      <div className="bs-scoreboard">
        <div className="bs-team-side">
          <span className="bs-team-name">{gameInfo.visitingTeam || "Visiting"}</span>
          <span className="bs-team-score">{gameInfo.finalScore?.visiting ?? "—"}</span>
          {shotsByPeriod.find(s => s.team === gameInfo.visitingTeam)?.total != null && (
            <span className="bs-shots">{shotsByPeriod.find(s => s.team === gameInfo.visitingTeam).total} SOG</span>
          )}
        </div>
        <div className="bs-sep">
          <span className="bs-final-label">{data.isFinal ? "Final" : "In Progress"}</span>
        </div>
        <div className="bs-team-side bs-team-home">
          <span className="bs-team-score">{gameInfo.finalScore?.home ?? "—"}</span>
          <span className="bs-team-name">{gameInfo.homeTeam || "Home"}</span>
          {shotsByPeriod.find(s => s.team === gameInfo.homeTeam)?.total != null && (
            <span className="bs-shots">{shotsByPeriod.find(s => s.team === gameInfo.homeTeam).total} SOG</span>
          )}
        </div>
      </div>
      {gameInfo.date && (
        <p className="bs-meta">{gameInfo.date}{gameInfo.arena ? ` · ${gameInfo.arena}` : ""}{gameInfo.attendance ? ` · Att: ${gameInfo.attendance}` : ""}</p>
      )}

      {!hasData && (
        <div className="bs-empty">Detailed stats not yet available for this game.</div>
      )}

      {/* Period Scoring */}
      {periodScoring.length > 0 && (
        <div className="bs-section">
          <div className="bs-section-title">Scoring Summary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PER</th><th>TEAM</th>
                  <th>SCORER</th><th>ASSISTS</th><th>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {periodScoring.map((g, i) => (
                  <tr key={i}>
                    <td>{g.period}</td>
                    <td>{g.team}</td>
                    <td className="bold">{g.scorer}</td>
                    <td>{g.assists}</td>
                    <td>
                      <span className={`strength-badge strength-${(g.strength || "EV").replace(/[^A-Z]/g, "")}`}>
                        {g.strength || "EV"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bs-legend">
            <span><span className="strength-badge strength-EV">EV</span> Even Strength</span>
            <span><span className="strength-badge strength-PP">PP</span> Power Play</span>
            <span><span className="strength-badge strength-SH">SH</span> Short-Handed</span>
            <span><span className="strength-badge strength-EN">EN</span> Empty Net</span>
            <span><span className="strength-badge strength-PS">PS</span> Penalty Shot</span>
          </div>
        </div>
      )}

      {/* Three Stars */}
      {stars.length > 0 && (
        <div className="bs-section">
          <div className="bs-section-title">Three Stars</div>
          <div className="bs-stars">
            {(() => {
              const allGoalies = [...(goalieStats?.visiting || []), ...(goalieStats?.home || [])];
              const goalieMap = Object.fromEntries(allGoalies.filter(g => g.number).map(g => [g.name, g]));
              return stars.map((s) => {
                const gl = goalieMap[s.name];
                return (
                  <div key={s.star} className="bs-star">
                    <span className="bs-star-num">{s.star === 1 ? "★" : s.star === 2 ? "★★" : "★★★"}</span>
                    <span className="bs-star-name">{s.name}</span>
                    <span className="bs-star-team">{s.team}</span>
                    {gl ? (
                      <span className="bs-star-stats">{gl.saves} SV · {gl.svPct.toFixed(3).replace(/^0/, "")}</span>
                    ) : s.pts != null ? (
                      <span className="bs-star-stats">{s.g}G {s.a}A</span>
                    ) : null}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Goalie Stats */}
      {(goalieStats.visiting?.length > 0 || goalieStats.home?.length > 0) && (
        <div className="bs-section">
          <div className="bs-section-title">Goalie Stats</div>
          {["visiting", "home"].map((side) =>
            goalieStats[side]?.length > 0 ? (
              <div key={side} className="bs-team-block">
                <div className="bs-team-label">
                  {side === "visiting" ? (gameInfo.visitingTeam || "Visiting") : (gameInfo.homeTeam || "Home")}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>GOALIE</th><th>MIN</th><th>SV</th><th>SA</th><th>GA</th><th>SV%</th></tr>
                    </thead>
                    <tbody>
                      {goalieStats[side].filter(g => g.name !== "Totals:").map((g, i) => (
                        <tr key={i}>
                          <td>{g.number}</td>
                          <td className="bold">{g.name}</td>
                          <td>{g.minsPlayed}</td>
                          <td className="num">{g.saves}</td>
                          <td className="num">{g.shotsAgainst}</td>
                          <td className="num">{g.ga}</td>
                          <td className="num bold">{typeof g.svPct === "number" ? g.svPct.toFixed(3).replace(/^0/, "") : g.svPct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Penalties */}
      {penalties.length > 0 && (
        <div className="bs-section">
          <div className="bs-section-title">Penalty Log</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>PER</th><th>TEAM</th><th>PLAYER</th><th>INFRACTION</th><th>MIN</th></tr>
              </thead>
              <tbody>
                {penalties.map((p, i) => (
                  <tr key={i}>
                    <td>{p.period}</td>
                    <td>{p.team}</td>
                    <td className="bold">{p.player}</td>
                    <td>{p.infraction.replace(/\s*\([^)]*\)\s*$/, "")}</td>
                    <td className="num">{p.minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
