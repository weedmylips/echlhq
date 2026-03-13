import { useEffect } from "react";
import { useBoxscore } from "../hooks/useECHL.js";
import "./BoxScoreModal.css";

export default function BoxScoreModal({ gameId, onClose }) {
  const { data, isLoading, error } = useBoxscore(gameId);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Box Score</h2>
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

  return (
    <div className="boxscore">
      {/* Game Header */}
      <div className="bs-header">
        <div className="bs-team">{gameInfo.visitingTeam || "Visiting"}</div>
        <div className="bs-final-score">
          <span>{gameInfo.finalScore?.visiting ?? "—"}</span>
          <span className="bs-dash">–</span>
          <span>{gameInfo.finalScore?.home ?? "—"}</span>
        </div>
        <div className="bs-team">{gameInfo.homeTeam || "Home"}</div>
      </div>
      {gameInfo.date && <p className="bs-meta">{gameInfo.date} · {gameInfo.arena} · Att: {gameInfo.attendance || "—"}</p>}

      {/* Period Scoring */}
      {periodScoring.length > 0 && (
        <section className="bs-section">
          <h3 className="section-title">Scoring Summary</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th><th>Time</th><th>Team</th>
                  <th>Scorer</th><th>Assists</th><th>Type</th>
                </tr>
              </thead>
              <tbody>
                {periodScoring.map((g, i) => (
                  <tr key={i}>
                    <td>{g.period}</td>
                    <td>{g.time}</td>
                    <td>{g.team}</td>
                    <td><strong>{g.scorer}</strong></td>
                    <td>{g.assists}</td>
                    <td><span className="badge">{g.strength}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Shots by Period */}
      {shotsByPeriod.length > 0 && (
        <section className="bs-section">
          <h3 className="section-title">Shots on Goal</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Team</th><th>1st</th><th>2nd</th><th>3rd</th><th>OT</th><th>Total</th></tr>
              </thead>
              <tbody>
                {shotsByPeriod.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.team}</strong></td>
                    <td>{s.p1}</td><td>{s.p2}</td><td>{s.p3}</td><td>{s.ot || "—"}</td>
                    <td><strong>{s.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Skater Stats */}
      {(skaterStats.visiting?.length > 0 || skaterStats.home?.length > 0) && (
        <section className="bs-section">
          <h3 className="section-title">Skater Stats</h3>
          {["visiting", "home"].map((side) =>
            skaterStats[side]?.length > 0 ? (
              <div key={side} className="bs-team-block">
                <h4>{side === "visiting" ? (gameInfo.visitingTeam || "Visiting") : (gameInfo.homeTeam || "Home")}</h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Player</th><th>Pos</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PIM</th><th>SOG</th></tr>
                    </thead>
                    <tbody>
                      {skaterStats[side].map((p, i) => (
                        <tr key={i}>
                          <td>{p.number}</td>
                          <td>{p.name}</td>
                          <td>{p.pos}</td>
                          <td>{p.g}</td><td>{p.a}</td>
                          <td><strong>{p.pts}</strong></td>
                          <td className={p.plusMinus > 0 ? "pos" : p.plusMinus < 0 ? "neg" : ""}>
                            {p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                          </td>
                          <td>{p.pim}</td>
                          <td>{p.shots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          )}
        </section>
      )}

      {/* Goalie Stats */}
      {(goalieStats.visiting?.length > 0 || goalieStats.home?.length > 0) && (
        <section className="bs-section">
          <h3 className="section-title">Goalie Stats</h3>
          {["visiting", "home"].map((side) =>
            goalieStats[side]?.length > 0 ? (
              <div key={side} className="bs-team-block">
                <h4>{side === "visiting" ? (gameInfo.visitingTeam || "Visiting") : (gameInfo.homeTeam || "Home")}</h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Goalie</th><th>Min</th><th>Saves</th><th>SA</th><th>GA</th><th>SV%</th></tr>
                    </thead>
                    <tbody>
                      {goalieStats[side].map((g, i) => (
                        <tr key={i}>
                          <td>{g.number}</td>
                          <td>{g.name}</td>
                          <td>{g.minsPlayed}</td>
                          <td>{g.saves}</td>
                          <td>{g.shotsAgainst}</td>
                          <td>{g.ga}</td>
                          <td>{g.svPct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          )}
        </section>
      )}

      {/* Penalties */}
      {penalties.length > 0 && (
        <section className="bs-section">
          <h3 className="section-title">Penalty Log</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Period</th><th>Time</th><th>Team</th><th>Player</th><th>Infraction</th><th>Min</th></tr>
              </thead>
              <tbody>
                {penalties.map((p, i) => (
                  <tr key={i}>
                    <td>{p.period}</td>
                    <td>{p.time}</td>
                    <td>{p.team}</td>
                    <td>{p.player}</td>
                    <td>{p.infraction}</td>
                    <td>{p.minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {periodScoring.length === 0 && shotsByPeriod.length === 0 && skaterStats.home?.length === 0 && skaterStats.visiting?.length === 0 && (
        <div className="bs-empty">Detailed box score data not yet available for this game.</div>
      )}
    </div>
  );
}
