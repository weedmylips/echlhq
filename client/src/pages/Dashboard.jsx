import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScores, useStandings, useLeaders } from "../hooks/useECHL.js";
import ScoreCard from "../components/ScoreCard.jsx";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import LeaderList from "../components/LeaderList.jsx";
import "./Dashboard.css";

export default function Dashboard() {
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [standingsSort, setStandingsSort] = useState({ col: "pts", dir: "desc" });
  const navigate = useNavigate();

  const { data: scoresData, isLoading: scoresLoading } = useScores();
  const { data: standingsData, isLoading: standingsLoading } = useStandings();
  const { data: leadersData, isLoading: leadersLoading } = useLeaders();

  const scores = scoresData?.scores || [];
  const standings = standingsData?.standings || [];
  const leaders = leadersData?.leaders || {};

  // Group standings by division
  const byDivision = standings.reduce((acc, team) => {
    const div = team.division || "Other";
    if (!acc[div]) acc[div] = [];
    acc[div].push(team);
    return acc;
  }, {});

  const divisions = ["North", "South", "Central", "Mountain", "Other"].filter(
    (d) => byDivision[d]?.length
  );

  function sortStandings(teams) {
    return [...teams].sort((a, b) => {
      let av = a[standingsSort.col] ?? 0;
      let bv = b[standingsSort.col] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (standingsSort.dir === "asc") return av > bv ? 1 : -1;
      return av < bv ? 1 : -1;
    });
  }

  function handleSortClick(col) {
    setStandingsSort((s) =>
      s.col === col ? { col, dir: s.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }
    );
  }

  function sortIcon(col) {
    if (standingsSort.col !== col) return " ↕";
    return standingsSort.dir === "desc" ? " ↓" : " ↑";
  }

  return (
    <div className="dashboard">
      {/* Scores strip */}
      <section className="scores-strip card">
        <div className="scores-strip-header">
          <h2 className="section-title">Recent Scores</h2>
          {scoresData?.stale && (
            <span className="badge badge-warning">Stale data</span>
          )}
        </div>
        {scoresLoading ? (
          <div className="loading-spinner">Loading scores…</div>
        ) : scores.length === 0 ? (
          <p className="empty-msg">No recent scores available.</p>
        ) : (
          <div className="scores-scroll">
            {scores.map((game, i) => (
              <ScoreCard key={i} game={game} onClick={setSelectedGameId} />
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        {/* Standings */}
        <section className="standings-section card">
          <div className="section-header">
            <h2 className="section-title">Standings</h2>
            <a href="/standings" className="see-all">Full Standings →</a>
          </div>
          {standingsLoading ? (
            <div className="loading-spinner">Loading standings…</div>
          ) : standings.length === 0 ? (
            <p className="empty-msg">No standings available.</p>
          ) : (
            <div className="table-wrap">
              {divisions.map((div) => (
                <div key={div} className="division-block">
                  <div className="division-label">{div} Division</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        {["gp","w","l","otl","sol","pts","gf","ga","diff"].map((col) => (
                          <th key={col} onClick={() => handleSortClick(col)}>
                            {col.toUpperCase()}{sortIcon(col)}
                          </th>
                        ))}
                        <th>Streak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortStandings(byDivision[div]).map((team, i) => (
                        <tr
                          key={team.teamId || i}
                          className="team-row"
                          onClick={() => team.teamId && navigate(`/team/${team.teamId}`)}
                          style={{ cursor: team.teamId ? "pointer" : "default" }}
                        >
                          <td>
                            <div className="team-cell">
                              {team.logoUrl && (
                                <img src={team.logoUrl} alt="" className="team-logo-sm" />
                              )}
                              <span
                                style={{ color: team.primaryColor, fontWeight: 700 }}
                              >
                                {team.teamName}
                              </span>
                            </div>
                          </td>
                          <td>{team.gp}</td>
                          <td>{team.w}</td>
                          <td>{team.l}</td>
                          <td>{team.otl}</td>
                          <td>{team.sol}</td>
                          <td><strong>{team.pts}</strong></td>
                          <td>{team.gf}</td>
                          <td>{team.ga}</td>
                          <td className={team.diff > 0 ? "pos" : team.diff < 0 ? "neg" : ""}>
                            {team.diff > 0 ? `+${team.diff}` : team.diff}
                          </td>
                          <td>{team.streak}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Leaders Sidebar */}
        <aside className="leaders-sidebar">
          <div className="card leaders-card">
            <div className="section-header">
              <h2 className="section-title">League Leaders</h2>
              <a href="/leaders" className="see-all">All Leaders →</a>
            </div>
            {leadersLoading ? (
              <div className="loading-spinner">Loading…</div>
            ) : (
              <>
                <LeaderList title="Goals" data={leaders.goals} limit={5} />
                <LeaderList title="Assists" data={leaders.assists} limit={5} />
                <LeaderList title="Points" data={leaders.points} limit={5} />
                <LeaderList title="GAA" data={leaders.gaa} limit={5} lower />
                <LeaderList title="SV%" data={leaders.svPct} limit={5} />
              </>
            )}
          </div>
        </aside>
      </div>

      {selectedGameId && (
        <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      )}
    </div>
  );
}
