import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScores, useStandings, useLeaders } from "../hooks/useECHL.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import "./Dashboard.css";

const DIVISION_ORDER = ["North", "South", "Central", "Mountain"];
const PLAYOFF_SPOTS = 4; // top 4 per division make playoffs

export default function Dashboard() {
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [sortCol, setSortCol] = useState("pts");
  const [sortDir, setSortDir] = useState("desc");

  const navigate = useNavigate();
  const { data: scoresData, isLoading: scoresLoading } = useScores();
  const { data: standingsData, isLoading: standingsLoading } = useStandings();
  const { data: leadersData, isLoading: leadersLoading } = useLeaders();

  const scores = scoresData?.scores || [];
  const standings = standingsData?.standings || [];
  const leaders = leadersData?.leaders || {};

  const byDivision = standings.reduce((acc, t) => {
    const d = t.division || "Other";
    (acc[d] = acc[d] || []).push(t);
    return acc;
  }, {});

  const divisions = DIVISION_ORDER.filter((d) => byDivision[d]?.length);

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function sorted(teams) {
    return [...teams].sort((a, b) => {
      let av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "desc" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  function sortIcon(col) {
    if (sortCol !== col) return null;
    return <span className="sort-icon">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  const COLS = ["gp","w","l","otl","pts","pct","gf","ga","diff","home","away","streak"];

  return (
    <div className="dashboard">
      {/* ── Scores Strip ── */}
      <section className="scores-section">
        <div className="section-label">Yesterday's Scores</div>
        {scoresLoading ? (
          <div className="loading-spinner">Loading…</div>
        ) : scores.length === 0 ? (
          <p className="empty-msg">No recent scores.</p>
        ) : (
          <div className="scores-strip">
            {scores.map((g, i) => (
              <ScoreChip key={i} game={g} onClick={() => g.gameId && setSelectedGameId(g.gameId)} />
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-body">
        {/* ── Standings ── */}
        <section className="standings-section">
          {standingsLoading ? (
            <div className="loading-spinner">Loading standings…</div>
          ) : (
            divisions.map((divName) => {
              const teams = sorted(byDivision[divName] || []);
              return (
                <div key={divName} className="division-card card">
                  <div className="division-card-header">
                    <span className="division-name">{divName} Division</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th className="team-col">Team</th>
                          {COLS.map((c) => (
                            <th key={c} onClick={() => handleSort(c)} className="num-col">
                              {c.toUpperCase()}{sortIcon(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((team, i) => {
                          const isPlayoffCutoff = i === PLAYOFF_SPOTS - 1;
                          return (
                            <tr
                              key={team.teamId || i}
                              className={`team-row${isPlayoffCutoff ? " playoff-cutoff" : ""}`}
                              onClick={() => team.teamId && navigate(`/team/${team.teamId}`)}
                            >
                              <td className="team-name-cell">
                                {team.logoUrl && (
                                  <img src={team.logoUrl} alt="" className="row-logo" />
                                )}
                                <span style={{ color: team.primaryColor || "#fff", fontWeight: 600 }}>
                                  {team.teamName}
                                </span>
                              </td>
                              <td className="num">{team.gp}</td>
                              <td className="num bold">{team.w}</td>
                              <td className="num">{team.l}</td>
                              <td className="num">{team.otl}</td>
                              <td className="num bold">{team.pts}</td>
                              <td className="num">{team.pct}</td>
                              <td className="num">{team.gf}</td>
                              <td className="num">{team.ga}</td>
                              <td className={`num ${team.diff > 0 ? "pos" : team.diff < 0 ? "neg" : ""}`}>
                                {team.diff > 0 ? `+${team.diff}` : team.diff}
                              </td>
                              <td className="num hide-mobile">{team.home}</td>
                              <td className="num hide-mobile">{team.away}</td>
                              <td className="num hide-mobile">{team.streak}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* ── Leaders Sidebar ── */}
        <aside className="leaders-sidebar">
          <div className="card leaders-card">
            <div className="leaders-card-header">
              <span className="section-label" style={{ margin: 0 }}>League Leaders</span>
              <a href="/leaders" className="see-all-link">All →</a>
            </div>

            {leadersLoading ? (
              <div className="loading-spinner" style={{ padding: 24 }}>Loading…</div>
            ) : (
              <>
                <LeaderMini title="Points" players={leaders.points} limit={5} />
                <LeaderMini title="Goals" players={leaders.goals} limit={5} />
                <LeaderMini title="Assists" players={leaders.assists} limit={5} />
                <LeaderMini title="GAA" players={leaders.gaa} limit={5} lower />
                <LeaderMini title="SV%" players={leaders.svPct} limit={5} />
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

function ScoreChip({ game, onClick }) {
  return (
    <button className="score-chip" onClick={onClick} disabled={!game.gameId}>
      <div className="chip-team chip-away">
        <span className="chip-name">{game.visitingTeam}</span>
        <span className="chip-score">{game.visitingScore}</span>
      </div>
      <div className="chip-sep">
        {game.overtime ? <span className="chip-ot">{game.overtime}</span> : <span className="chip-at">@</span>}
      </div>
      <div className="chip-team chip-home">
        <span className="chip-score">{game.homeScore}</span>
        <span className="chip-name">{game.homeTeam}</span>
      </div>
      <div className="chip-status">Final{game.overtime ? ` (${game.overtime})` : ""}</div>
    </button>
  );
}

function LeaderMini({ title, players, limit = 5, lower = false }) {
  if (!players?.length) return null;
  const sorted = lower
    ? [...players].sort((a, b) => a.value - b.value)
    : [...players].sort((a, b) => b.value - a.value);
  const items = sorted.slice(0, limit);

  return (
    <div className="leader-mini">
      <div className="leader-mini-title">{title}</div>
      {items.map((p, i) => (
        <div key={i} className="leader-mini-row">
          <span className="leader-mini-rank">{i + 1}</span>
          <span className="leader-mini-name">{p.name}</span>
          <span className="leader-mini-team">{p.team}</span>
          <span className="leader-mini-val">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
