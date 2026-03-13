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
  const { gameInfo, periodScoring, shotsByPeriod, skaterStats, goalieStats, penalties } = data;
  const hasData = periodScoring.length > 0 || shotsByPeriod.length > 0 ||
    skaterStats.home?.length > 0 || skaterStats.visiting?.length > 0;

  return (
    <div className="boxscore">
      {/* Score Header */}
      <div className="bs-scoreboard">
        <div className="bs-team-side">
          <span className="bs-team-name">{gameInfo.visitingTeam || "Visiting"}</span>
          <span className="bs-team-score">{gameInfo.finalScore?.visiting ?? "—"}</span>
        </div>
        <div className="bs-sep">
          <span className="bs-final-label">{data.isFinal ? "Final" : "In Progress"}</span>
        </div>
        <div className="bs-team-side bs-team-home">
          <span className="bs-team-score">{gameInfo.finalScore?.home ?? "—"}</span>
          <span className="bs-team-name">{gameInfo.homeTeam || "Home"}</span>
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
                  <th>PER</th><th>TIME</th><th>TEAM</th>
                  <th>SCORER</th><th>ASSISTS</th><th>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {periodScoring.map((g, i) => (
                  <tr key={i}>
                    <td>{g.period}</td>
                    <td>{g.time}</td>
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
        </div>
      )}

      {/* Shots by Period */}
      {shotsByPeriod.length > 0 && (
        <div className="bs-section">
          <div className="bs-section-title">Shots on Goal</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>TEAM</th><th>1st</th><th>2nd</th><th>3rd</th><th>OT</th><th>TOT</th></tr>
              </thead>
              <tbody>
                {shotsByPeriod.map((s, i) => (
                  <tr key={i}>
                    <td className="bold">{s.team}</td>
                    <td className="num">{s.p1}</td>
                    <td className="num">{s.p2}</td>
                    <td className="num">{s.p3}</td>
                    <td className="num">{s.ot || "—"}</td>
                    <td className="num bold">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skater Stats */}
      {(skaterStats.visiting?.length > 0 || skaterStats.home?.length > 0) && (
        <div className="bs-section">
          <div className="bs-section-title">Skater Stats</div>
          {["visiting", "home"].map((side) =>
            skaterStats[side]?.length > 0 ? (
              <div key={side} className="bs-team-block">
                <div className="bs-team-label">
                  {side === "visiting" ? (gameInfo.visitingTeam || "Visiting") : (gameInfo.homeTeam || "Home")}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>PLAYER</th><th>POS</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PIM</th><th>SOG</th></tr>
                    </thead>
                    <tbody>
                      {skaterStats[side].map((p, i) => (
                        <tr key={i}>
                          <td>{p.number}</td>
                          <td className="bold">{p.name}</td>
                          <td>{p.pos}</td>
                          <td className="num">{p.g}</td>
                          <td className="num">{p.a}</td>
                          <td className="num bold">{p.pts}</td>
                          <td className={`num ${p.plusMinus > 0 ? "pos" : p.plusMinus < 0 ? "neg" : ""}`}>
                            {p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                          </td>
                          <td className="num">{p.pim}</td>
                          <td className="num">{p.shots}</td>
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
                      {goalieStats[side].map((g, i) => (
                        <tr key={i}>
                          <td>{g.number}</td>
                          <td className="bold">{g.name}</td>
                          <td>{g.minsPlayed}</td>
                          <td className="num">{g.saves}</td>
                          <td className="num">{g.shotsAgainst}</td>
                          <td className="num">{g.ga}</td>
                          <td className="num bold">{g.svPct}</td>
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
                <tr><th>PER</th><th>TIME</th><th>TEAM</th><th>PLAYER</th><th>INFRACTION</th><th>MIN</th></tr>
              </thead>
              <tbody>
                {penalties.map((p, i) => (
                  <tr key={i}>
                    <td>{p.period}</td>
                    <td>{p.time}</td>
                    <td>{p.team}</td>
                    <td className="bold">{p.player}</td>
                    <td>{p.infraction}</td>
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
