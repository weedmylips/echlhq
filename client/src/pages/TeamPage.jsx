import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam, useStandings } from "../hooks/useECHL.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import ScoreCard from "../components/ScoreCard.jsx";
import "./TeamPage.css";

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [selectedGameId, setSelectedGameId] = useState(null);

  const { data, isLoading, error } = useTeam(teamId);
  const { data: standingsData } = useStandings();

  if (isLoading) return <div className="loading-spinner">Loading team…</div>;
  if (error) return <div className="error-box">Error: {error.message}</div>;
  if (!data) return null;

  const { team, standing, recentScores } = data;
  const allStandings = standingsData?.standings || [];

  // Rank team in each category vs league
  function rank(key, lower = false) {
    if (!standing || allStandings.length === 0) return null;
    const sorted = [...allStandings].sort((a, b) =>
      lower ? a[key] - b[key] : b[key] - a[key]
    );
    const idx = sorted.findIndex(
      (t) => t.teamId === standing.teamId || t.teamName === standing.teamName
    );
    return idx >= 0 ? idx + 1 : null;
  }

  const leagueAvg = (key) => {
    if (allStandings.length === 0) return null;
    const vals = allStandings.map((t) => t[key] || 0).filter((v) => !isNaN(v));
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  };

  const ptsRank = rank("pts");
  const gfRank = rank("gf");
  const gaRank = rank("ga", true);

  return (
    <div className="team-page">
      {/* Team header */}
      <div
        className="team-header"
        style={{
          background: `linear-gradient(135deg, ${team.primaryColor}22, ${team.secondaryColor}11)`,
          borderColor: team.primaryColor,
        }}
      >
        <div className="team-header-inner">
          {team.logoUrl && (
            <img
              src={team.logoUrl}
              alt={`${team.name} logo`}
              className="team-logo-lg"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
          <div>
            <h1 style={{ color: team.primaryColor }}>{team.name}</h1>
            <p className="team-meta">
              {team.division} Division · {team.conference} Conference
            </p>
          </div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>

      {/* Season record cards */}
      {standing ? (
        <div className="stat-cards">
          <StatCard label="Games Played" value={standing.gp} />
          <StatCard label="Wins" value={standing.w} />
          <StatCard label="Losses" value={standing.l} />
          <StatCard label="OTL" value={standing.otl} />
          <StatCard label="SOL" value={standing.sol} />
          <StatCard
            label="Points"
            value={standing.pts}
            sub={ptsRank ? `#${ptsRank} in league` : null}
          />
          <StatCard
            label="Goals For"
            value={standing.gf}
            sub={gfRank ? `#${gfRank} · Avg: ${leagueAvg("gf")}` : null}
          />
          <StatCard
            label="Goals Against"
            value={standing.ga}
            sub={gaRank ? `#${gaRank} fewest · Avg: ${leagueAvg("ga")}` : null}
          />
          <StatCard
            label="Differential"
            value={standing.diff > 0 ? `+${standing.diff}` : standing.diff}
          />
          <StatCard label="Streak" value={standing.streak || "—"} />
          <StatCard label="Home" value={standing.home || "—"} />
          <StatCard label="Away" value={standing.away || "—"} />
        </div>
      ) : (
        <p className="empty-msg">Season stats not available.</p>
      )}

      {/* Recent games */}
      <section className="team-section card">
        <h2 className="section-title">Recent Games</h2>
        {recentScores?.length > 0 ? (
          <div className="recent-scores">
            {recentScores.map((game, i) => (
              <ScoreCard key={i} game={game} onClick={setSelectedGameId} />
            ))}
          </div>
        ) : (
          <p className="empty-msg">No recent games available.</p>
        )}
      </section>

      {/* League rank comparison */}
      {standing && allStandings.length > 0 && (
        <section className="team-section card">
          <h2 className="section-title">Team vs League Average</h2>
          <div className="rank-table table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Team</th><th>League Avg</th><th>Rank</th></tr>
              </thead>
              <tbody>
                {[
                  { label: "Points", key: "pts", lower: false },
                  { label: "Goals For", key: "gf", lower: false },
                  { label: "Goals Against", key: "ga", lower: true },
                  { label: "Goal Diff", key: "diff", lower: false },
                ].map(({ label, key, lower }) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td><strong>{standing[key]}</strong></td>
                    <td>{leagueAvg(key)}</td>
                    <td>
                      <span
                        className={
                          rank(key, lower) <= 5
                            ? "rank-badge top"
                            : rank(key, lower) > allStandings.length - 5
                            ? "rank-badge bot"
                            : "rank-badge mid"
                        }
                      >
                        #{rank(key, lower)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedGameId && (
        <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      )}
    </div>
  );
}
