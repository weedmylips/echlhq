import { useEffect } from "react";
import { usePlayer } from "../hooks/useECHL.js";
import { TEAMS } from "../config/teamConfig.js";
import "./PlayerModal.css";

export default function PlayerModal({ playerId, playerName, onClose }) {
  const { data, isLoading, error } = usePlayer(playerId);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const bio = data?.bio;
  const photoUrl = bio?.photoUrl || `https://assets.leaguestat.com/echl/120x160/${playerId}.jpg`;

  const formatAge = (birthdate) => {
    if (!birthdate) return null;
    const bd = new Date(birthdate + "T12:00:00");
    if (isNaN(bd)) return null;
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    return age;
  };

  const formatBirthdate = (birthdate) => {
    if (!birthdate) return null;
    const d = new Date(birthdate + "T12:00:00");
    if (isNaN(d)) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal player-modal">
        <div className="modal-header">
          <span className="modal-title">{playerName || "Player Profile"}</span>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          {isLoading && <div className="loading-spinner">Loading player data...</div>}
          {error && <div className="error-box">Failed to load player data.</div>}
          {data && (
            <div className="player-content">
              {/* Bio header */}
              <div className="player-bio">
                <div className="player-photo-wrap">
                  <img
                    src={photoUrl}
                    alt={bio?.firstName ? `${bio.firstName} ${bio.lastName}` : playerName}
                    className="player-photo"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                </div>
                <div className="player-bio-info">
                  <div className="player-bio-name">
                    {bio?.number && <span className="player-bio-number">#{bio.number}</span>}
                    {bio ? `${bio.firstName} ${bio.lastName}` : playerName}
                  </div>
                  <div className="player-bio-details">
                    {bio?.position && <span className="player-bio-tag">{bio.position}</span>}
                    {bio?.shoots && <span className="player-bio-tag">{data.isGoalie ? "Catches" : "Shoots"} {bio.shoots}</span>}
                    {bio?.height && <span className="player-bio-tag">{bio.height}</span>}
                    {bio?.weight && <span className="player-bio-tag">{bio.weight} lbs</span>}
                  </div>
                  <div className="player-bio-details">
                    {bio?.birthdate && (
                      <span className="player-bio-detail">
                        {formatBirthdate(bio.birthdate)} (Age {formatAge(bio.birthdate)})
                      </span>
                    )}
                    {bio?.birthplace && <span className="player-bio-detail">{bio.birthplace}</span>}
                  </div>
                  {bio?.teamName && (
                    <div className="player-bio-team">{bio.teamName}</div>
                  )}
                </div>
              </div>

              {/* Regular season stats */}
              {data.regular?.length > 0 && (
                <div className="player-stats-section">
                  <div className="player-stats-header">Regular Season</div>
                  {data.isGoalie ? (
                    <GoalieStatsTable seasons={data.regular} total={data.regularTotal} />
                  ) : (
                    <SkaterStatsTable seasons={data.regular} total={data.regularTotal} />
                  )}
                </div>
              )}

              {/* Playoff stats */}
              {data.playoff?.length > 0 && (
                <div className="player-stats-section">
                  <div className="player-stats-header">Playoffs</div>
                  {data.isGoalie ? (
                    <GoalieStatsTable seasons={data.playoff} total={data.playoffTotal} />
                  ) : (
                    <SkaterStatsTable seasons={data.playoff} total={data.playoffTotal} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkaterStatsTable({ seasons, total }) {
  return (
    <div className="table-wrap">
      <table className="player-stats-table">
        <thead>
          <tr>
            <th>Season</th>
            <th>Team</th>
            <th className="num-col">GP</th>
            <th className="num-col">G</th>
            <th className="num-col">A</th>
            <th className="num-col">PTS</th>
            <th className="num-col">+/-</th>
            <th className="num-col">PIM</th>
            <th className="num-col">PPG</th>
            <th className="num-col">SHG</th>
            <th className="num-col">GWG</th>
            <th className="num-col">S</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s, i) => (
            <tr key={i}>
              <td className="season-name">{s.seasonName.replace(" Regular Season", "")}</td>
              <td className="team-name">{s.teamName}</td>
              <td className="num">{s.gp}</td>
              <td className="num">{s.g}</td>
              <td className="num">{s.a}</td>
              <td className="num bold">{s.pts}</td>
              <td className={`num ${s.pm > 0 ? "pos" : s.pm < 0 ? "neg" : ""}`}>{s.pm > 0 ? `+${s.pm}` : s.pm}</td>
              <td className="num">{s.pim}</td>
              <td className="num">{s.ppg}</td>
              <td className="num">{s.shg}</td>
              <td className="num">{s.gwg}</td>
              <td className="num">{s.shots}</td>
            </tr>
          ))}
          {total && (
            <tr className="total-row">
              <td className="season-name">Totals</td>
              <td></td>
              <td className="num">{total.gp}</td>
              <td className="num">{total.g}</td>
              <td className="num">{total.a}</td>
              <td className="num bold">{total.pts}</td>
              <td className={`num ${total.pm > 0 ? "pos" : total.pm < 0 ? "neg" : ""}`}>{total.pm > 0 ? `+${total.pm}` : total.pm}</td>
              <td className="num">{total.pim}</td>
              <td className="num">{total.ppg}</td>
              <td className="num">{total.shg}</td>
              <td className="num">{total.gwg}</td>
              <td className="num">{total.shots}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GoalieStatsTable({ seasons, total }) {
  return (
    <div className="table-wrap">
      <table className="player-stats-table">
        <thead>
          <tr>
            <th>Season</th>
            <th>Team</th>
            <th className="num-col">GP</th>
            <th className="num-col">W</th>
            <th className="num-col">L</th>
            <th className="num-col">OTL</th>
            <th className="num-col">GAA</th>
            <th className="num-col">SV%</th>
            <th className="num-col">SO</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s, i) => (
            <tr key={i}>
              <td className="season-name">{s.seasonName.replace(" Regular Season", "")}</td>
              <td className="team-name">{s.teamName}</td>
              <td className="num">{s.gp}</td>
              <td className="num">{s.w}</td>
              <td className="num">{s.l}</td>
              <td className="num">{s.otl}</td>
              <td className="num">{s.gaa?.toFixed(2) ?? "—"}</td>
              <td className="num">{s.svPct ? s.svPct.toFixed(3).replace(/^0/, "") : "—"}</td>
              <td className="num">{s.so}</td>
            </tr>
          ))}
          {total && (
            <tr className="total-row">
              <td className="season-name">Totals</td>
              <td></td>
              <td className="num">{total.gp}</td>
              <td className="num">{total.w}</td>
              <td className="num">{total.l}</td>
              <td className="num">{total.otl}</td>
              <td className="num">{total.gaa?.toFixed(2) ?? "—"}</td>
              <td className="num">{total.svPct ? total.svPct.toFixed(3).replace(/^0/, "") : "—"}</td>
              <td className="num">{total.so}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
