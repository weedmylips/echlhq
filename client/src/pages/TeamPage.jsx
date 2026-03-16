import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { useTeam, useStandings, useRoster, useTeamMoves, useTeamStats, useTeamPlayers, useLeaders } from "../hooks/useECHL.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import "./TeamPage.css";

const MOVE_ICONS = {
  ir: "\u{1F3E5}", reserve: "\u{1F4CB}", active: "\u2705", recalled_ahl: "\u2B06\uFE0F",
  loaned: "\u{1F504}", traded: "\u{1F4B1}", signed: "\u270D\uFE0F", suspended: "\u{1F6AB}",
  released: "\u{1F6AB}", leave: "\u{1F3E0}",
};

const POS_ORDER = { F: 0, D: 1, G: 2 };
function sortByPosition(a, b) {
  return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
}
const PLAYOFF_SPOTS = 4;

function getResult(game, teamCity) {
  const city = teamCity.toLowerCase();
  const home  = game.homeTeam?.toLowerCase() || "";
  const visit = game.visitingTeam?.toLowerCase() || "";
  const isHome  = home.includes(city);
  const isVisit = visit.includes(city);
  if (!isHome && !isVisit) return null;
  const myScore  = isHome ? game.homeScore  : game.visitingScore;
  const oppScore = isHome ? game.visitingScore : game.homeScore;
  if (myScore > oppScore) return game.overtime ? "OT-W" : "W";
  if (myScore < oppScore) return game.overtime ? "OT-L" : "L";
  return null;
}

function ResultBadge({ result }) {
  if (!result) return null;
  if (result === "W")    return <span className="badge-w">W</span>;
  if (result === "L")    return <span className="badge-l">L</span>;
  if (result === "OT-W") return <span className="badge-otw">OTW</span>;
  if (result === "OT-L") return <span className="badge-otl">OTL</span>;
  return null;
}

function ordinal(n) {
  if (!n) return "—";
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGameId, setSelectedGameId] = useState(null);

  const { data, isLoading, error } = useTeam(teamId);
  const { data: standingsData } = useStandings();
  const { data: rosterData } = useRoster(teamId);
  const { data: playersData } = useTeamPlayers(teamId);
  const { data: movesData } = useTeamMoves(teamId);
  const { data: teamStats } = useTeamStats(teamId);
  const { data: leadersData } = useLeaders();

  if (isLoading) return <div className="loading-spinner">Loading team…</div>;
  if (error) return <div className="error-box">Error loading team: {error.message}</div>;
  if (!data) return null;

  const { team, standing, recentScores } = data;
  const allStandings = standingsData?.standings || [];

  const divisionTeams = allStandings
    .filter((t) => t.division === (standing?.division || team.division))
    .sort((a, b) => b.pts - a.pts);

  function divRank(key, lower = false) {
    if (!standing || !divisionTeams.length) return null;
    const s = [...divisionTeams].sort((a, b) => lower ? a[key] - b[key] : b[key] - a[key]);
    const i = s.findIndex((t) => t.teamId === standing.teamId);
    return i >= 0 ? i + 1 : null;
  }

  function leagueRank(key, lower = false) {
    if (!standing || !allStandings.length) return null;
    const s = [...allStandings].sort((a, b) => lower ? a[key] - b[key] : b[key] - a[key]);
    const i = s.findIndex((t) => t.teamId === standing.teamId);
    return i >= 0 ? i + 1 : null;
  }

  function divisionSuffix(rank) {
    if (!rank) return "";
    const sfx = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
    const divName = standing?.division || team.division || "Div";
    return `${rank}${sfx} in ${divName}`;
  }

  function homeRoadRank(type) {
    if (!standing || !allStandings.length) return { league: null, div: null };
    const getWins = (t) => {
      const rec = type === "home" ? t.homeRecord : t.roadRecord;
      if (!rec) return -1;
      const w = parseInt(rec.split("-")[0]);
      return isNaN(w) ? -1 : w;
    };
    const lr = [...allStandings].sort((a, b) => getWins(b) - getWins(a)).findIndex(t => t.teamId === standing.teamId) + 1;
    const dr = [...divisionTeams].sort((a, b) => getWins(b) - getWins(a)).findIndex(t => t.teamId === standing.teamId) + 1;
    return { league: lr || null, div: dr || null };
  }

  const gfPerGame = standing?.gp ? (standing.gf / standing.gp).toFixed(2) : "—";
  const gaPerGame = standing?.gp ? (standing.ga / standing.gp).toFixed(2) : "—";

  // Key Stats helpers
  const soWL = standing?.shootoutRecord
    ? standing.shootoutRecord.split("-").slice(0, 2).join("-") : "—";
  const pctDisplay = standing?.pct != null
    ? `${(standing.pct * 100).toFixed(1)}%` : "—";

  return (
    <div className="team-page">
      {/* ── Header ── */}
      <div
        className="team-header"
        style={{
          "--team-primary": team.primaryColor || "#333",
          "--team-secondary": team.secondaryColor || "#555",
          borderColor: team.primaryColor || "#333",
        }}
      >
        <div
          className="team-header-accent"
          style={{ background: `linear-gradient(135deg, ${team.primaryColor}55 0%, transparent 60%)` }}
        />
        <div className="team-header-content">
          <div className="team-header-left">
            {team.logoUrl && (
              <img
                src={team.logoUrl}
                alt={team.name}
                className="team-header-logo"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <div className="team-header-info">
              <h1 className="team-header-name">{team.name}</h1>
              <div className="team-header-meta">
                <span
                  className="division-badge"
                  style={{ borderColor: team.primaryColor, color: "var(--text)" }}
                >
                  {team.division || "—"}
                </span>
                {standing && (
                  <span className="record-text">
                    {standing.w}–{standing.l}–{standing.otl} · {standing.pts} PTS
                  </span>
                )}
                {standing?.streak && <StreakBadge streak={standing.streak} />}
              </div>
              {standing && (
                <div className="header-standings-row">
                  {teamStats?.rank && (
                    <span className="header-standing-item">
                      {ordinal(teamStats.rank)} in {standing.division}
                    </span>
                  )}
                  {leagueRank("pts") && (
                    <span className="header-standing-item">
                      {ordinal(leagueRank("pts"))} in League
                    </span>
                  )}
                  {standing.gamesRemaining != null && (
                    <span className="header-standing-item">
                      {standing.gamesRemaining} Games Left
                    </span>
                  )}
                </div>
              )}
              {(standing?.lastTen || recentScores?.length > 0) && (
                <div className="header-last10">
                  <span className="header-last10-label">L10</span>
                  <Last10Strip lastTen={standing.lastTen} recentScores={recentScores} city={team.city} compact />
                </div>
              )}
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="team-tabs">
        {["overview", "roster"].map((tab) => (
          <button
            key={tab}
            className={`team-tab${activeTab === tab ? " active" : ""}`}
            style={activeTab === tab ? { borderBottomColor: team.primaryColor } : {}}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="overview-layout">
          {/* ── Left/main column ── */}
          <div className="overview-main">

            {/* Recent Games */}
            <div className="card section-card">
              <div className="card-header">
                <span className="section-label" style={{ margin: 0 }}>Recent Games</span>
              </div>
              {recentScores?.length > 0 ? (
                <div className="recent-games-list">
                  {recentScores.map((game, i) => {
                    const result  = getResult(game, team.city);
                    const isHome  = (game.homeTeam || "").toLowerCase().includes(team.city.toLowerCase());
                    const opp     = isHome ? game.visitingTeam : game.homeTeam;
                    const myScore = isHome ? game.homeScore : game.visitingScore;
                    const oppScore = isHome ? game.visitingScore : game.homeScore;
                    return (
                      <div
                        key={i}
                        className="recent-game-row"
                        onClick={() => game.gameId && setSelectedGameId(game.gameId)}
                        style={{ cursor: game.gameId ? "pointer" : "default" }}
                      >
                        <ResultBadge result={result} />
                        <span className="rg-loc">{isHome ? "vs" : "@"}</span>
                        <span className="rg-opp">{opp}</span>
                        <span className="rg-score">
                          {myScore !== undefined ? `${myScore}–${oppScore}` : "—"}
                          {game.overtime ? ` (${game.overtime})` : ""}
                        </span>
                        <span className="rg-date">{game.date || "—"}</span>
                        {game.gameId && <span className="rg-link">Box Score →</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-msg" style={{ padding: "16px" }}>No recent games available.</p>
              )}
            </div>

            {/* Recent Moves — sits next to Recent Games */}
            {movesData?.moves?.length > 0 && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Recent Moves</span>
                </div>
                <div className="recent-moves-list">
                  {movesData.moves.slice(0, 10).map((move, i) => (
                    <div key={i} className="move-row">
                      <span className="move-icon">{MOVE_ICONS[move.type] || "\u2139\uFE0F"}</span>
                      <span className="move-player">{move.player}</span>
                      <span className="move-summary">{move.summary}</span>
                      <span className="move-date">{move.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row: Team Stats (large) | Playoff Picture + Home/Road stacked (small) */}
            {standing && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Team Stats</span>
                </div>
                <div className="stats-grid">
                  <StatBlock label="GF / Game" value={gfPerGame} rank={divisionSuffix(divRank("gf"))} />
                  <StatBlock label="GA / Game" value={gaPerGame} rank={divisionSuffix(divRank("ga", true))} />
                  <StatBlock
                    label="Goal Diff"
                    value={standing.diff > 0 ? `+${standing.diff}` : standing.diff}
                    valueColor={standing.diff > 0 ? "#4ade80" : standing.diff < 0 ? "#f87171" : undefined}
                    rank={leagueRank("diff") ? `${ordinal(leagueRank("diff"))} in League` : undefined}
                  />
                </div>
                <div className="season-record-strip">
                  {[
                    { label: "GP",  value: standing.gp },
                    { label: "W",   value: standing.w },
                    { label: "L",   value: standing.l },
                    { label: "OTL", value: standing.otl },
                    { label: "SOL", value: standing.sol },
                    { label: "PTS", value: standing.pts },
                  ].map(({ label, value }) => (
                    <div key={label} className="record-item">
                      <div className="record-value">{value}</div>
                      <div className="record-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Home Ice Advantage */}
            {teamStats && standing && (
              <HomeIceCard
                ts={teamStats}
                team={team}
                standing={standing}
                homeRank={homeRoadRank("home")}
                roadRank={homeRoadRank("road")}
              />
            )}

            {/* Stacked: Defensive Efficiency + PIM + Special Teams */}
            <div className="stacked-cards">
              {teamStats && standing && (
                <DefensiveEfficiencyCard ts={teamStats} team={team} standing={standing} />
              )}
              {teamStats && standing && <PimCard ts={teamStats} team={team} standing={standing} />}
              {teamStats && standing && teamStats.hasST && (
                <SpecialTeamsCard ts={teamStats} standing={standing} />
              )}
            </div>

            {/* Division Head-to-Head — full width */}
            {teamStats && (
              <DivisionH2HCard ts={teamStats} team={team} allStandings={allStandings} navigate={navigate} />
            )}

          </div>

          {/* ── Right sidebar — DO NOT MODIFY ── */}
          <div className="overview-sidebar">
            {/* Team Leaders card */}
            {rosterData?.roster && (() => {
              const skaters = rosterData.roster.filter(
                (p) => (p.status === "active" || p.status === "signed") && p.position !== "G" && (p.stats?.gp ?? 0) > 0
              );
              const goalies = rosterData.roster.filter(
                (p) => p.position === "G" && (p.stats?.gp ?? 0) > 0
              );
              const top = (arr, key, n = 15) =>
                [...arr].sort((a, b) => (b.stats?.[key] ?? 0) - (a.stats?.[key] ?? 0)).slice(0, n);

              // Look up league rank for a skater in a stat category
              const normalize = (n) => (n || "").replace(/^x\s+/i, "").replace(/^\*\s*/i, "").trim().toLowerCase();
              const leagueRankFor = (name, cat) => {
                const arr = cat === "PTS" ? leadersData?.leaders?.points
                          : cat === "G"   ? leadersData?.leaders?.goals
                          :                 leadersData?.leaders?.assists;
                if (!arr) return null;
                const entry = arr.find((e) => normalize(e.name) === normalize(name));
                return (entry && entry.rank <= 30) ? entry.rank : null;
              };
              const leagueRankForGoalie = (name) => {
                const arr = leadersData?.leaders?.svPct;
                if (!arr) return null;
                const entry = arr.find((e) => normalize(e.name) === normalize(name));
                return entry ? entry.rank : null;
              };

              // Look up goalie's GAA / SV% from playersData
              const goalieStats = (name) => {
                const g = playersData?.goalies?.find(
                  (g) => normalize(g.player) === normalize(name)
                );
                return g || null;
              };

              const cats = [
                { title: "PTS", players: top(skaters, "pts") },
                { title: "G",   players: top(skaters, "g") },
                { title: "A",   players: top(skaters, "a") },
              ].filter((c) => c.players.length > 0);

              const topGoalies = [...goalies].sort((a, b) => (b.stats?.gp ?? 0) - (a.stats?.gp ?? 0));

              if (!cats.length && !topGoalies.length) return null;
              return (
                <div className="card section-card">
                  <div className="card-header">
                    <span className="section-label" style={{ margin: 0 }}>Team Leaders</span>
                    <a href={`/team/${teamId}?tab=roster`} className="see-all-link" onClick={(e) => { e.preventDefault(); setActiveTab("roster"); }}>Roster →</a>
                  </div>
                  {cats.map(({ title, players }) => (
                    <div key={title} className="mini-leader-block">
                      <div className="mini-leader-cat">{title}</div>
                      {players.map((p, i) => {
                        const rank = leagueRankFor(p.player, title);
                        const val  = title === "PTS" ? p.stats?.pts
                                   : title === "G"   ? p.stats?.g
                                   :                   p.stats?.a;
                        return (
                          <div key={i} className="mini-leader-row">
                            <span className="mini-leader-rank">{i + 1}</span>
                            <span className="mini-leader-name-group">
                              <span className="mini-leader-name">{p.player}</span>
                              {rank && <span className="league-rank-pill">#{rank}</span>}
                            </span>
                            <span className="mini-leader-team">{p.position}</span>
                            <span className="mini-leader-val">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {topGoalies.length > 0 && (
                    <div className="mini-leader-block">
                      <div className="mini-leader-cat">Goalies</div>
                      {topGoalies.map((p, i) => {
                        const gs = goalieStats(p.player);
                        const gRank = leagueRankForGoalie(p.player);
                        return (
                          <div key={i} className="mini-leader-row">
                            <span className="mini-leader-rank">{i + 1}</span>
                            <span className="mini-leader-name-group">
                              <span className="mini-leader-name">{p.player}</span>
                              {gRank && <span className="league-rank-pill">#{gRank}</span>}
                            </span>
                            <span className="mini-leader-team">G</span>
                            {gs ? (
                              <>
                                <span className="mini-leader-val">{gs.gaa.toFixed(2)}</span>
                                <span className="mini-goalie-sv">{(gs.svPct * 100).toFixed(1)}%</span>
                              </>
                            ) : (
                              <span className="mini-leader-val">{p.stats?.gp}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Attendance Card */}
            {standing?.attendanceAverage > 0 && (
              <AttendanceCard standing={standing} allStandings={allStandings} />
            )}

            {/* Division Standings mini-table */}
            {divisionTeams.length > 0 && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>
                    {standing?.division || team.division} Division
                  </span>
                </div>
                <table className="mini-standings-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisionTeams.map((t, i) => (
                      <tr
                        key={t.teamId || i}
                        className={`${t.teamId === standing?.teamId ? "current-team-row" : ""}${i === PLAYOFF_SPOTS - 1 ? " playoff-cutoff" : ""}`}
                        onClick={() => t.teamId && navigate(`/team/${t.teamId}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div className="mini-team-cell">
                            {t.logoUrl && <img src={t.logoUrl} alt="" className="mini-logo" />}
                            <span
                              className="mini-team-name"
                              >{t.teamName}</span>
                          </div>
                        </td>
                        <td className="num">{t.w}</td>
                        <td className="num">{t.l}</td>
                        <td className="num bold">{t.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Roster Tab ── */}
      {activeTab === "roster" && (
        <RosterTab playersData={playersData} rosterData={rosterData} />
      )}

      {selectedGameId && (
        <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      )}
    </div>
  );
}

// ─── Playoff Picture Card ──────────────────────────────────────────────────────
function PlayoffPictureCard({ ts, team, standing }) {
  if (!standing) return null;
  const { playoffStatus, rank, ptsBack1st, ptsBack4th } = ts;

  const statusClass =
    playoffStatus === "CLINCHED"            ? "badge-clinched" :
    playoffStatus === "IN PLAYOFF POSITION" ? "badge-position" :
    playoffStatus === "ON THE BUBBLE"       ? "badge-bubble" :
    playoffStatus === "ELIMINATED"          ? "badge-eliminated" : "badge-chasing";

  return (
    <div className="card section-card playoff-widget">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Playoff Picture</span>
        <span className={`playoff-status-badge ${statusClass}`}>{playoffStatus}</span>
      </div>
      <div className="playoff-simple-body">
        <div className="playoff-rank-display">
          <div className="playoff-rank-num">
            {ordinal(rank)}
          </div>
          <div className="playoff-rank-label">in {standing.division} Division</div>
        </div>
        <div className="playoff-pts-back-row">
          {ptsBack1st === 0 ? (
            <div className="playoff-stat-item">
              <div className="playoff-stat-val" style={{ color: "var(--green)" }}>—</div>
              <div className="playoff-stat-lbl">Back of 1st</div>
            </div>
          ) : (
            <div className="playoff-stat-item">
              <div className="playoff-stat-val neg">{ptsBack1st}</div>
              <div className="playoff-stat-lbl">Back of 1st</div>
            </div>
          )}
          {rank > 4 && (
            <div className="playoff-stat-item">
              <div className="playoff-stat-val neg">{ptsBack4th}</div>
              <div className="playoff-stat-lbl">Back of 4th</div>
            </div>
          )}
          <div className="playoff-stat-item">
            <div className="playoff-stat-val">{standing.pts}</div>
            <div className="playoff-stat-lbl">Points</div>
          </div>
          <div className="playoff-stat-item">
            <div className="playoff-stat-val">{standing.gamesRemaining ?? "—"}</div>
            <div className="playoff-stat-lbl">Games Left</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clinching Card ────────────────────────────────────────────────────────────
function ClinchingCard({ ts }) {
  if (!ts.clinchedText) return null;
  const isGood = ts.isClinched || ts.playoffStatus === "IN PLAYOFF POSITION";
  const isBad  = ts.isEliminated;
  return (
    <div className={`card section-card clinching-card ${isBad ? "clinching-bad" : isGood ? "clinching-good" : "clinching-neutral"}`}>
      <span className="clinching-icon">
        {ts.isClinched ? "🏒" : ts.isEliminated ? "❌" : "📊"}
      </span>
      <span className="clinching-text">{ts.clinchedText}</span>
    </div>
  );
}

// ─── PCT Trend Sparkline ────────────────────────────────────────────────────────
function PctTrendCard({ ts, team, standing }) {
  const { pctTrend, trendDir } = ts;
  const seasonPct = standing?.pct ?? null;

  if (!pctTrend?.length) {
    return (
      <div className="card section-card">
        <div className="card-header">
          <span className="section-label" style={{ margin: 0 }}>Points % Trend</span>
        </div>
        <p className="empty-msg" style={{ padding: "12px 16px" }}>
          Not enough game data yet — builds as season progresses.
        </p>
      </div>
    );
  }

  const trendLabel = trendDir === "up" ? "↑ Trending Up" : trendDir === "down" ? "↓ Trending Down" : null;
  const trendColor = trendDir === "up" ? "var(--green)" : trendDir === "down" ? "var(--red)" : "var(--text-muted)";
  const lastPct = pctTrend[pctTrend.length - 1]?.pct ?? 0;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Points % Trend</span>
        {trendLabel && <span className="trend-badge" style={{ color: trendColor }}>{trendLabel}</span>}
      </div>
      <div className="chart-meta-row">
        <span className="chart-meta-val">
          {(lastPct * 100).toFixed(1)}%
        </span>
        <span className="chart-meta-lbl">Recent PCT</span>
        {seasonPct != null && (
          <>
            <span className="chart-meta-divider" />
            <span className="chart-meta-val">{(seasonPct * 100).toFixed(1)}%</span>
            <span className="chart-meta-lbl">Season PCT</span>
          </>
        )}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={pctTrend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <XAxis dataKey="game" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} label={{ value: "Game", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "var(--text-muted)" }} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <ReferenceLine y={0.5} stroke="var(--text-muted)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Tooltip
              formatter={(v) => [`${(v * 100).toFixed(1)}%`, "PCT"]}
              labelFormatter={(g, p) => p?.[0]?.payload ? `Game ${g} — ${p[0].payload.date} (${p[0].payload.result})` : `Game ${g}`}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              itemStyle={{ color: team.primaryColor }}
            />
            <Line type="monotone" dataKey="pct" stroke={team.primaryColor} strokeWidth={2} dot={{ r: 3, fill: team.primaryColor }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-sub">Computed from recent game results in rolling history</div>
    </div>
  );
}

// ─── Season Arc Chart ──────────────────────────────────────────────────────────
function SeasonArcCard({ ts, team }) {
  const { seasonArc } = ts;
  if (!seasonArc?.length) {
    return (
      <div className="card section-card">
        <div className="card-header">
          <span className="section-label" style={{ margin: 0 }}>Goals For vs Against — Recent Arc</span>
        </div>
        <p className="empty-msg" style={{ padding: "12px 16px" }}>
          Not enough game data yet — builds as season progresses.
        </p>
      </div>
    );
  }

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Goals For vs Against — Recent Arc</span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={seasonArc} margin={{ top: 8, right: 12, bottom: 4, left: -20 }} barCategoryGap="25%">
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v, name) => [v.toFixed(1), name === "gf" ? "Goals For (avg)" : "Goals Against (avg)"]}
            />
            <Legend formatter={(v) => v === "gf" ? "Goals For" : "Goals Against"} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="gf" fill={team.primaryColor} radius={[3, 3, 0, 0]} />
            <Bar dataKey="ga" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-sub">Avg GF and GA per 3-game chunk — recent games only</div>
    </div>
  );
}

// ─── Special Teams Card ───────────────────────────────────────────────────────
function SpecialTeamsCard({ ts, standing }) {
  const { leagueAvgPP, leagueAvgPK, leaguePPRank, divPPRank, leaguePKRank, divPKRank } = ts;
  const ppPct = standing.ppPct ?? 0;
  const pkPct = standing.pkPct ?? 0;
  const ppAbove = ppPct >= leagueAvgPP;
  const pkAbove = pkPct >= leagueAvgPK;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Special Teams</span>
      </div>
      <div className="st-body">
        {/* Power Play */}
        <div className="st-half">
          <div className="st-half-label">POWER PLAY</div>
          <div className="st-pct" style={{ color: ppAbove ? "var(--green)" : "var(--red)" }}>
            {ppPct.toFixed(1)}%
          </div>
          <div className="st-sub">
            {standing.ppGoals ?? 0} PPG / {standing.ppOpportunities ?? 0} opp
          </div>
          <div className="st-ranks">
            Div: {ordinal(divPPRank)} · League: {ordinal(leaguePPRank)}
          </div>
          <div className="st-bar-track">
            <div
              className="st-bar-fill"
              style={{
                width: `${Math.min(100, leagueAvgPP > 0 ? (ppPct / (leagueAvgPP * 2)) * 100 : 0)}%`,
                background: ppAbove ? "var(--green)" : "var(--red)",
              }}
            />
            {leagueAvgPP > 0 && (
              <div
                className="st-bar-avg"
                style={{ left: `${Math.min(100, (leagueAvgPP / (leagueAvgPP * 2)) * 100)}%` }}
                title={`League avg: ${leagueAvgPP.toFixed(1)}%`}
              />
            )}
          </div>
        </div>

        <div className="st-divider" />

        {/* Penalty Kill */}
        <div className="st-half">
          <div className="st-half-label">PENALTY KILL</div>
          <div className="st-pct" style={{ color: pkAbove ? "var(--green)" : "var(--red)" }}>
            {pkPct.toFixed(1)}%
          </div>
          <div className="st-sub">
            {standing.pkGoalsAllowed ?? 0} GA / {standing.timesShorthanded ?? 0} SH
          </div>
          <div className="st-ranks">
            Div: {ordinal(divPKRank)} · League: {ordinal(leaguePKRank)}
          </div>
          <div className="st-bar-track">
            <div
              className="st-bar-fill"
              style={{
                width: `${Math.min(100, leagueAvgPK > 0 ? (pkPct / (leagueAvgPK * 1.2)) * 100 : 0)}%`,
                background: pkAbove ? "var(--green)" : "var(--red)",
              }}
            />
            {leagueAvgPK > 0 && (
              <div
                className="st-bar-avg"
                style={{ left: `${Math.min(100, (leagueAvgPK / (leagueAvgPK * 1.2)) * 100)}%` }}
                title={`League avg: ${leagueAvgPK.toFixed(1)}%`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Defensive Efficiency Card ────────────────────────────────────────────────
function DefensiveEfficiencyCard({ ts, team, standing }) {
  const { gaPerGame, gfPerGame, leagueAvgGA, leagueAvgGF, leagueGARank, divGARank, leagueGFRank, divGFRank } = ts;
  const belowAvg = gaPerGame < leagueAvgGA;
  const offAbove = gfPerGame > leagueAvgGF;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Defensive Efficiency</span>
        <span className="def-badge" style={{ color: belowAvg ? "var(--green)" : "var(--red)", background: belowAvg ? "var(--green-bg)" : "var(--red-bg)" }}>
          {belowAvg ? "Above Average" : "Below Average"}
        </span>
      </div>
      <div className="def-stats-row">
        <div className="def-stat">
          <div className="def-stat-val" style={{ color: belowAvg ? "var(--green)" : "var(--red)" }}>
            {gaPerGame.toFixed(2)}
          </div>
          <div className="def-stat-lbl">GA / Game</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">{leagueAvgGA.toFixed(2)}</div>
          <div className="def-stat-lbl">League Avg GA</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">
            {ordinal(leagueGARank)}
          </div>
          <div className="def-stat-lbl">League Rank</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">
            {ordinal(divGARank)}
          </div>
          <div className="def-stat-lbl">Div Rank</div>
        </div>
      </div>
      <div className="def-bar-wrap">
        <span className="def-bar-label">GA/G vs League Average</span>
        <div className="def-bar-track">
          <div
            className="def-bar-fill"
            style={{
              width: `${Math.min(100, (gaPerGame / (leagueAvgGA * 1.5)) * 100)}%`,
              background: belowAvg ? "var(--green)" : "var(--red)",
            }}
          />
          <div
            className="def-bar-avg-marker"
            style={{ left: `${Math.min(100, (leagueAvgGA / (leagueAvgGA * 1.5)) * 100)}%` }}
            title={`League avg: ${leagueAvgGA.toFixed(2)}`}
          />
        </div>
      </div>

      {/* ── Offensive Efficiency section ── */}
      <div className="def-section-divider" />
      <div className="card-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <span className="section-label" style={{ margin: 0, fontSize: 11 }}>Offensive Efficiency</span>
        <span className="def-badge" style={{ color: offAbove ? "var(--green)" : "var(--red)", background: offAbove ? "var(--green-bg)" : "var(--red-bg)" }}>
          {offAbove ? "Above Average" : "Below Average"}
        </span>
      </div>
      <div className="def-stats-row" style={{ borderBottom: "none" }}>
        <div className="def-stat">
          <div className="def-stat-val" style={{ color: offAbove ? "var(--green)" : "var(--red)" }}>
            {gfPerGame.toFixed(2)}
          </div>
          <div className="def-stat-lbl">GF / Game</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">{leagueAvgGF.toFixed(2)}</div>
          <div className="def-stat-lbl">League Avg GF</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">{ordinal(leagueGFRank)}</div>
          <div className="def-stat-lbl">League Rank</div>
        </div>
        <div className="def-stat">
          <div className="def-stat-val">{ordinal(divGFRank)}</div>
          <div className="def-stat-lbl">Div Rank</div>
        </div>
      </div>
      <div className="def-bar-wrap" style={{ paddingTop: 4 }}>
        <span className="def-bar-label">GF/G vs League Average</span>
        <div className="def-bar-track">
          <div
            className="def-bar-fill"
            style={{
              width: `${Math.min(100, (gfPerGame / (leagueAvgGF * 1.5)) * 100)}%`,
              background: offAbove ? "var(--green)" : "var(--red)",
            }}
          />
          <div
            className="def-bar-avg-marker"
            style={{ left: `${Math.min(100, (leagueAvgGF / (leagueAvgGF * 1.5)) * 100)}%` }}
            title={`League avg: ${leagueAvgGF.toFixed(2)}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Regulation Win % Card ─────────────────────────────────────────────────────
function RegulationWinCard({ ts, team, standing }) {
  const { rwPct, rwDivRank, rwLabel, divTotalTeams } = ts;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Regulation Win %</span>
        <span className="rw-label-badge">{rwLabel}</span>
      </div>
      <div className="rw-body">
        <div className="rw-pct-display">
          {rwPct.toFixed(1)}%
        </div>
        <div className="rw-sub">
          {standing.regulationWins} of {standing.w} wins in regulation · {ordinal(rwDivRank)} in division
        </div>
        <div className="rw-bar-track">
          <div className="rw-bar-fill" style={{ width: `${Math.min(100, rwPct)}%`, background: team.primaryColor }} />
        </div>
        <div className="rw-scale">
          <span>0%</span>
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>← OT dependent · Reg dominant →</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Division H2H Card ─────────────────────────────────────────────────────────
function DivisionH2HCard({ ts, team, allStandings, navigate }) {
  const { h2h } = ts;
  if (!h2h?.length) return null;

  const hasGames = h2h.some((r) => r.gp > 0);

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Division Head-to-Head</span>
      </div>
      {!hasGames ? (
        <p className="empty-msg" style={{ padding: "12px 16px" }}>
          No division games in recent history yet — builds as season progresses.
        </p>
      ) : (
        <div className="h2h-list">
          {h2h.map((opp) => {
            const oppStanding = allStandings.find((t) => t.teamId === opp.teamId);
            const winning = opp.gp > 0 && opp.w > opp.l;
            const losing  = opp.gp > 0 && opp.w < opp.l;
            const even    = opp.gp > 0 && opp.w === opp.l;
            return (
              <div
                key={opp.teamId}
                className={`h2h-row ${winning ? "h2h-win" : losing ? "h2h-loss" : opp.gp > 0 ? "h2h-even" : "h2h-none"}`}
                onClick={() => opp.teamId && navigate(`/team/${opp.teamId}`)}
                style={{ cursor: "pointer" }}
              >
                {opp.logoUrl && <img src={opp.logoUrl} alt="" className="h2h-logo" />}
                <span className="h2h-name">{opp.teamName}</span>
                <span className="h2h-pts">
                  {oppStanding ? `${oppStanding.pts} PTS` : ""}
                </span>
                <span className="h2h-record">
                  {opp.gp > 0 ? `${opp.w}–${opp.l}` : "—"}
                </span>
                {opp.gp > 0 && (
                  <span
                    className="h2h-diff"
                    style={{
                      color: opp.diff > 0 ? "var(--green)" : opp.diff < 0 ? "var(--red)" : "var(--text-muted)",
                    }}
                  >
                    {opp.diff > 0 ? `+${opp.diff}` : opp.diff}
                  </span>
                )}
                {opp.gp === 0 && <span className="h2h-diff" />}
              </div>
            );
          })}
        </div>
      )}
      <div className="chart-sub">From rolling recent game history only</div>
    </div>
  );
}

// ─── PIM Personality Card ──────────────────────────────────────────────────────
function PimCard({ ts, team, standing }) {
  const { hasPim, pimPerGame, pimDivRank, pimLeagueRank, leagueAvgPim, pimLabel } = ts;

  if (!hasPim) {
    return (
      <div className="card section-card">
        <div className="card-header">
          <span className="section-label" style={{ margin: 0 }}>Penalty Minutes</span>
        </div>
        <p className="empty-msg" style={{ padding: "12px 16px" }}>
          PIM data will appear after the next scheduled scrape.
        </p>
      </div>
    );
  }

  const isClean = pimLabel === "Cleanest Team in Division";
  const isBad   = pimLabel === "Most Penalized in the League" || pimLabel === "Most Penalized in Division" || pimLabel === "Among the Most Penalized in League";
  const pimBadgeStyle = isClean
    ? { color: "var(--green)", background: "var(--green-bg)", border: "1px solid rgba(34,197,94,0.35)" }
    : isBad
    ? { color: "var(--red)",   background: "var(--red-bg)",   border: "1px solid rgba(239,68,68,0.35)" }
    : {};

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Penalty Minutes</span>
        <span className="pim-label-badge" style={pimBadgeStyle}>{pimLabel}</span>
      </div>
      <div className="pim-body">
        <div className="pim-stat">
          <div className="pim-val">{standing.pim ?? "—"}</div>
          <div className="pim-lbl">Total PIM</div>
        </div>
        <div className="pim-stat">
          <div className="pim-val">{pimPerGame ?? "—"}</div>
          <div className="pim-lbl">PIM / Game</div>
        </div>
        {leagueAvgPim && (
          <div className="pim-stat">
            <div className="pim-val">{leagueAvgPim}</div>
            <div className="pim-lbl">League Avg</div>
          </div>
        )}
        <div className="pim-stat">
          <div className="pim-val">{ordinal(pimDivRank)}</div>
          <div className="pim-lbl">Div Rank</div>
        </div>
        <div className="pim-stat">
          <div className="pim-val">{ordinal(pimLeagueRank)}</div>
          <div className="pim-lbl">League Rank</div>
        </div>
      </div>
    </div>
  );
}

// ─── Home Ice Advantage Card ───────────────────────────────────────────────────
function HomeIceCard({ ts, team, standing, homeRank, roadRank }) {
  const { homeStats, roadStats, divAvgHomePct, divAvgRoadPct, leagueAvgHomePct, leagueAvgRoadPct, homeDiff, homeAdvLabel } = ts;
  if (!homeStats || !roadStats) return null;

  const divName = standing.division || team.division || "Div";
  const labelColor =
    homeAdvLabel === "Home Team"    ? "var(--green)" :
    homeAdvLabel === "Road Warriors" ? "var(--amber)" : "var(--text-muted)";

  const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
  const pctColor = (pct, avg) => pct > avg ? "var(--green)" : pct < avg ? "var(--red)" : undefined;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Home Ice Advantage</span>
        <span className="home-adv-badge" style={{ color: labelColor }}>{homeAdvLabel}</span>
      </div>
      <div className="home-ice-body">
        <div className="home-ice-split">
          <div className="hi-col">
            <div className="hi-label">HOME</div>
            <div className="hi-pct" style={{ color: pctColor(homeStats.pct, leagueAvgHomePct) }}>{fmtPct(homeStats.pct)}</div>
            <div className="hi-record">{standing.homeRecord}</div>
            <div className="hi-vs-avg">Div avg: {fmtPct(divAvgHomePct)} · League avg: {fmtPct(leagueAvgHomePct)}</div>
            {(homeRank?.div || homeRank?.league) && (
              <div className="hi-vs-avg">
                {homeRank.div ? `${ordinal(homeRank.div)} in ${divName}` : ""}
                {homeRank.div && homeRank.league ? " · " : ""}
                {homeRank.league ? `${ordinal(homeRank.league)} in League` : ""}
              </div>
            )}
            <div className="hi-bar-track">
              <div className="hi-bar-fill" style={{ width: `${Math.min(100, homeStats.pct * 100)}%`, background: pctColor(homeStats.pct, leagueAvgHomePct) }} />
              <div className="hi-bar-avg" style={{ left: `${Math.min(100, divAvgHomePct * 100)}%` }} />
            </div>
          </div>
          <div className="hi-divider" />
          <div className="hi-col">
            <div className="hi-label">ROAD</div>
            <div className="hi-pct" style={{ color: pctColor(roadStats.pct, leagueAvgRoadPct) }}>{fmtPct(roadStats.pct)}</div>
            <div className="hi-record">{standing.roadRecord}</div>
            <div className="hi-vs-avg">Div avg: {fmtPct(divAvgRoadPct)} · League avg: {fmtPct(leagueAvgRoadPct)}</div>
            {(roadRank?.div || roadRank?.league) && (
              <div className="hi-vs-avg">
                {roadRank.div ? `${ordinal(roadRank.div)} in ${divName}` : ""}
                {roadRank.div && roadRank.league ? " · " : ""}
                {roadRank.league ? `${ordinal(roadRank.league)} in League` : ""}
              </div>
            )}
            <div className="hi-bar-track">
              <div className="hi-bar-fill" style={{ width: `${Math.min(100, roadStats.pct * 100)}%`, background: pctColor(roadStats.pct, leagueAvgRoadPct) }} />
              <div className="hi-bar-avg" style={{ left: `${Math.min(100, divAvgRoadPct * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="hi-diff">
          Home vs Road differential:{" "}
          <span style={{ color: homeDiff > 0 ? "var(--green)" : homeDiff < 0 ? "var(--red)" : "var(--text-muted)" }}>
            {homeDiff > 0 ? `+${(homeDiff * 100).toFixed(1)}%` : `${(homeDiff * 100).toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Existing helper components (unchanged) ────────────────────────────────────
function StatBlock({ label, value, rank, valueColor }) {
  return (
    <div className="stat-block">
      <div className="stat-block-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className="stat-block-label">{label}</div>
      {rank && <div className="stat-block-rank">{rank}</div>}
    </div>
  );
}

function parseStreak(streak) {
  if (!streak) return null;
  const m = String(streak).match(/^([WLwl](?:TL)?)\s*(\d+)$/);
  if (!m) return null;
  return { type: m[1].toUpperCase(), count: parseInt(m[2]) };
}

function StreakBadge({ streak }) {
  const parsed = parseStreak(streak);
  if (!parsed) return null;
  const isWin = parsed.type === "W";
  const isOT  = parsed.type === "OTL" || parsed.type === "WTL";
  return (
    <span className={`streak-badge ${isWin ? "streak-w" : isOT ? "streak-ot" : "streak-l"}`}>
      {parsed.type}{parsed.count}
    </span>
  );
}

function KeyStatCard({ label, value, accent }) {
  return (
    <div className="key-stat-card">
      <div className={`key-stat-value${accent ? ` key-stat-${accent}` : ""}`}>{value}</div>
      <div className="key-stat-label">{label}</div>
    </div>
  );
}

function parseLastTen(lastTen) {
  if (!lastTen) return null;
  const parts = String(lastTen).split("-").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [w = 0, l = 0, otl = 0, sol = 0] = parts;
  return { w, l, otl, sol };
}

function Last10Strip({ lastTen, recentScores, city, compact }) {
  // Prefer actual game sequence from recentScores when available
  let slots;
  if (recentScores?.length && city) {
    const c = city.toLowerCase();
    slots = recentScores.slice(0, 10).map((g) => {
      const isHome = (g.homeTeam || "").toLowerCase().includes(c);
      const myScore  = isHome ? g.homeScore  : g.visitingScore;
      const oppScore = isHome ? g.visitingScore : g.homeScore;
      const won = myScore > oppScore;
      const ot  = !!g.overtime;
      if (won) return "W";
      if (ot)  return "OTL";
      return "L";
    });
    while (slots.length < 10) slots.push(null);
  } else {
    const counts = parseLastTen(lastTen);
    if (!counts) return <div className="last10-empty">No data</div>;
    const { w, l, otl, sol } = counts;
    slots = [
      ...Array(w).fill("W"),
      ...Array(otl).fill("OTL"),
      ...Array(sol).fill("SOL"),
      ...Array(l).fill("L"),
    ].slice(0, 10);
    while (slots.length < 10) slots.push(null);
  }

  const counts = parseLastTen(lastTen);
  const { w = 0, l = 0, otl = 0, sol = 0 } = counts || {};
  const total = w + l + otl + sol;

  return (
    <div className={`last10-wrap${compact ? " last10-compact" : ""}`}>
      <div className="last10-segments">
        {slots.map((type, i) => (
          <div
            key={i}
            className={`last10-seg ${
              type === "W" ? "seg-w" :
              type === "OTL" || type === "SOL" ? "seg-ot" :
              type === "L" ? "seg-l" : "seg-empty"
            }`}
            title={type || ""}
          />
        ))}
      </div>
      {!compact && (() => {
        const sW   = slots.filter(s => s === "W").length;
        const sOT  = slots.filter(s => s === "OTL" || s === "SOL").length;
        const sL   = slots.filter(s => s === "L").length;
        const sGP  = slots.filter(Boolean).length;
        return (
          <div className="last10-counts">
            <span className="l10-count l10-w">{sW}W</span>
            {sOT > 0 && <span className="l10-count l10-ot">{sOT} OT</span>}
            <span className="l10-count l10-l">{sL}L</span>
            {sGP < 10 && <span className="l10-count l10-empty">{10 - sGP} remaining</span>}
          </div>
        );
      })()}
    </div>
  );
}

const INACTIVE_STATUSES = new Set(["ir", "reserve", "recalled_ahl", "loaned", "suspended", "leave"]);

function statusBadge(p) {
  if (!p._status || p._status === "active") return null;
  if (p._status === "ir") {
    const label = p._irDays ? `IR ${p._irDays}d` : "IR";
    return <span className="status-badge status-badge-inline status-badge-ir">{label}</span>;
  }
  if (p._status === "reserve") return <span className="status-badge status-badge-inline status-badge-res">RES</span>;
  if (p._status === "recalled_ahl" || p._status === "loaned") return <span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span>;
  if (p._status === "suspended") {
    const label = p._suspensionGamesRemaining ? `SUSP ${p._suspensionGamesRemaining}g` : "SUSP";
    return <span className="status-badge status-badge-inline status-badge-susp">{label}</span>;
  }
  if (p._status === "leave") return <span className="status-badge status-badge-inline status-badge-res">LEAVE</span>;
  return null;
}

function RosterTab({ playersData, rosterData }) {
  if (!playersData?.skaters) {
    return <p className="empty-msg" style={{ padding: "16px" }}>No roster data available.</p>;
  }

  // Build lookup: playerName (lower) → roster entry (for status info)
  const rosterByName = {};
  for (const p of (rosterData?.roster || [])) {
    rosterByName[p.player.toLowerCase()] = p;
  }

  // Active players from daily report
  const activeSkaters = playersData.skaters
    .filter((p) => p.isActive)
    .sort((a, b) => b.pts - a.pts)
    .map((p) => {
      const r = rosterByName[p.player.toLowerCase()];
      return { ...p, _status: r?.status ?? "active", _irDays: r?.irDays ?? null, _suspensionGamesRemaining: r?.suspensionGamesRemaining ?? null };
    });

  const activeGoalies = (playersData.goalies || [])
    .filter((p) => p.isActive)
    .sort((a, b) => b.gp - a.gp)
    .map((p) => {
      const r = rosterByName[p.player.toLowerCase()];
      return { ...p, _status: r?.status ?? "active", _irDays: r?.irDays ?? null, _suspensionGamesRemaining: r?.suspensionGamesRemaining ?? null };
    });

  // Inactive players from roster data not already in the daily report
  const activeSkatersNames = new Set(activeSkaters.map((p) => p.player.toLowerCase()));
  const activeGoaliesNames = new Set(activeGoalies.map((p) => p.player.toLowerCase()));

  const inactiveSkaters = (rosterData?.roster || [])
    .filter((p) => INACTIVE_STATUSES.has(p.status) && p.position !== "G" && !activeSkatersNames.has(p.player.toLowerCase()))
    .sort(sortByPosition)
    .map((p) => ({
      player: p.player, number: p.number, position: p.position,
      gp: p.stats?.gp ?? 0, g: p.stats?.g ?? 0, a: p.stats?.a ?? 0, pts: p.stats?.pts ?? 0,
      isRookie: false, _status: p.status, _irDays: p.irDays ?? null, _suspensionGamesRemaining: p.suspensionGamesRemaining ?? null,
    }));

  const inactiveGoalies = (rosterData?.roster || [])
    .filter((p) => INACTIVE_STATUSES.has(p.status) && p.position === "G" && !activeGoaliesNames.has(p.player.toLowerCase()))
    .sort(sortByPosition)
    .map((p) => ({
      player: p.player, number: p.number, position: p.position,
      gp: p.stats?.gp ?? 0, w: p.stats?.w ?? 0, l: p.stats?.l ?? 0,
      gaa: p.stats?.gaa ?? 0, svPct: p.stats?.svPct ?? 0,
      isRookie: false, _status: p.status, _irDays: p.irDays ?? null, _suspensionGamesRemaining: p.suspensionGamesRemaining ?? null,
    }));

  const byPts = (a, b) => b.pts - a.pts;
  const forwards   = [...activeSkaters, ...inactiveSkaters].filter((p) => p.position === "F").sort(byPts);
  const defensemen = [...activeSkaters, ...inactiveSkaters].filter((p) => p.position === "D").sort(byPts);
  const allGoalies = [...activeGoalies, ...inactiveGoalies];

  const skaterTable = (players) => (
    <div className="table-wrap">
      <table className="roster-table">
        <thead>
          <tr>
            <th className="num-col">#</th>
            <th>Player</th>
            <th className="num-col">GP</th>
            <th className="num-col">G</th>
            <th className="num-col">A</th>
            <th className="num-col">PTS</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i}>
              <td className="num">{p.number ?? "—"}</td>
              <td className="roster-player-name">
                {p.player}
                {p.isRookie && <span className="rookie-badge">R</span>}
                {statusBadge(p)}
              </td>
              <td className="num">{p.gp}</td>
              <td className="num">{p.g}</td>
              <td className="num">{p.a}</td>
              <td className="num bold">{p.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
    <div className="roster-sections">
      {forwards.length > 0 && (
        <div className="card section-card">
          <div className="card-header">
            <span className="section-label" style={{ margin: 0 }}>Forwards</span>
            <span className="roster-count">{forwards.length}</span>
          </div>
          {skaterTable(forwards)}
        </div>
      )}
      {defensemen.length > 0 && (
        <div className="card section-card">
          <div className="card-header">
            <span className="section-label" style={{ margin: 0 }}>Defense</span>
            <span className="roster-count">{defensemen.length}</span>
          </div>
          {skaterTable(defensemen)}
        </div>
      )}
      {allGoalies.length > 0 && (
        <div className="card section-card">
          <div className="card-header">
            <span className="section-label" style={{ margin: 0 }}>Goalies</span>
            <span className="roster-count">{allGoalies.length}</span>
          </div>
          <div className="table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th className="num-col">#</th>
                  <th>Goalie</th>
                  <th className="num-col">GP</th>
                  <th className="num-col">W</th>
                  <th className="num-col">L</th>
                  <th className="num-col">GAA</th>
                  <th className="num-col">SV%</th>
                </tr>
              </thead>
              <tbody>
                {allGoalies.map((p, i) => (
                  <tr key={i}>
                    <td className="num">{p.number ?? "—"}</td>
                    <td className="roster-player-name">
                      {p.player}
                      {p.isRookie && <span className="rookie-badge">R</span>}
                      {statusBadge(p)}
                    </td>
                    <td className="num">{p.gp}</td>
                    <td className="num">{p.w}</td>
                    <td className="num">{p.l}</td>
                    <td className="num">{p.gaa?.toFixed(2) ?? "—"}</td>
                    <td className="num">{p.svPct ? `${(p.svPct * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    <div className="roster-legend">
      <span className="roster-legend-item"><span className="rookie-badge">R</span> Rookie</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-ir">IR 14d</span> Injured Reserve (day count)</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-res">RES</span> Reserve (healthy scratch / roster compliance)</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span> On loan / recalled to AHL affiliate</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-susp">SUSP Ng</span> Suspended (N games remaining)</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-res">LEAVE</span> Personal leave</span>
    </div>
    </>
  );
}

function AttendanceCard({ standing, allStandings }) {
  const teamsWithAtt = [...allStandings]
    .filter((t) => t.attendanceAverage > 0)
    .sort((a, b) => b.attendanceAverage - a.attendanceAverage);
  const rank  = teamsWithAtt.findIndex((t) => t.teamId === standing.teamId) + 1;
  const total = teamsWithAtt.length;
  const fmt   = (n) => n ? Number(n).toLocaleString() : "—";

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Attendance</span>
        {rank > 0 && <span className="attendance-rank">#{rank} of {total}</span>}
      </div>
      <div className="attendance-body">
        <div className="att-stat">
          <div className="att-value">{fmt(standing.attendanceAverage)}</div>
          <div className="att-label">Avg / Game</div>
        </div>
        <div className="att-divider" />
        <div className="att-stat">
          <div className="att-value">{fmt(standing.attendanceTotal)}</div>
          <div className="att-label">Season Total</div>
        </div>
        <div className="att-divider" />
        <div className="att-stat">
          <div className="att-value">{standing.attendanceGames || "—"}</div>
          <div className="att-label">Home Games</div>
        </div>
      </div>
    </div>
  );
}
