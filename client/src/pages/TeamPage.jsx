import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam, useStandings, useLeaders, useRoster, useTeamMoves } from "../hooks/useECHL.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import "./TeamPage.css";

const DIVISION_ORDER = ["North", "South", "Central", "Mountain"];

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

// Determine W/L/OT result badge from a score object relative to this team
function getResult(game, teamCity) {
  const city = teamCity.toLowerCase();
  const home = game.homeTeam?.toLowerCase() || "";
  const visit = game.visitingTeam?.toLowerCase() || "";
  const isHome = home.includes(city);
  const isVisit = visit.includes(city);
  if (!isHome && !isVisit) return null;

  const myScore = isHome ? game.homeScore : game.visitingScore;
  const oppScore = isHome ? game.visitingScore : game.homeScore;
  if (myScore > oppScore) return game.overtime ? "OT-W" : "W";
  if (myScore < oppScore) return game.overtime ? "OT-L" : "L";
  return null;
}

function ResultBadge({ result }) {
  if (!result) return null;
  if (result === "W") return <span className="badge-w">W</span>;
  if (result === "L") return <span className="badge-l">L</span>;
  if (result === "OT-W") return <span className="badge-ot">OT</span>;
  if (result === "OT-L") return <span className="badge-ot">OT</span>;
  return null;
}

export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGameId, setSelectedGameId] = useState(null);

  const { data, isLoading, error } = useTeam(teamId);
  const { data: standingsData } = useStandings();
  const { data: leadersData } = useLeaders();
  const { data: rosterData } = useRoster(teamId);
  const { data: movesData } = useTeamMoves(teamId);

  if (isLoading) return <div className="loading-spinner">Loading team…</div>;
  if (error) return <div className="error-box">Error loading team: {error.message}</div>;
  if (!data) return null;

  const { team, standing, recentScores } = data;
  const allStandings = standingsData?.standings || [];
  const leaders = leadersData?.leaders || {};

  // Division standings for the mini-table
  const divisionTeams = allStandings
    .filter((t) => t.division === (standing?.division || team.division))
    .sort((a, b) => b.pts - a.pts);

  // Rank helpers
  function leagueRank(key, lower = false) {
    if (!standing || !allStandings.length) return null;
    const s = [...allStandings].sort((a, b) => lower ? a[key] - b[key] : b[key] - a[key]);
    const i = s.findIndex((t) => t.teamId === standing.teamId);
    return i >= 0 ? i + 1 : null;
  }

  function divRank(key, lower = false) {
    if (!standing || !divisionTeams.length) return null;
    const s = [...divisionTeams].sort((a, b) => lower ? a[key] - b[key] : b[key] - a[key]);
    const i = s.findIndex((t) => t.teamId === standing.teamId);
    return i >= 0 ? i + 1 : null;
  }

  function divisionSuffix(rank) {
    if (!rank) return "";
    const sfx = rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
    const divName = standing?.division || team.division || "Div";
    return `${rank}${sfx} in ${divName}`;
  }

  const leagueAvg = (key) => {
    if (!allStandings.length) return null;
    const vals = allStandings.map((t) => Number(t[key]) || 0).filter((v) => !isNaN(v));
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  };

  const gfPerGame = standing?.gp ? (standing.gf / standing.gp).toFixed(2) : "—";
  const gaPerGame = standing?.gp ? (standing.ga / standing.gp).toFixed(2) : "—";

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
                  style={{ borderColor: team.primaryColor, color: team.primaryColor }}
                >
                  {team.division || "—"} Division
                </span>
                {standing && (
                  <span className="record-text">
                    {standing.w}–{standing.l}–{standing.otl} · {standing.pts} PTS
                  </span>
                )}
                {standing?.streak && <StreakBadge streak={standing.streak} />}
              </div>
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="team-tabs">
        {["overview", "roster", "standings"].map((tab) => (
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
          {/* Left/main column */}
          <div className="overview-main">
            {/* Recent Games */}
            <div className="card section-card">
              <div className="card-header">
                <span className="section-label" style={{ margin: 0 }}>Recent Games</span>
              </div>
              {recentScores?.length > 0 ? (
                <div className="recent-games-list">
                  {recentScores.map((game, i) => {
                    const result = getResult(game, team.city);
                    const isHome = (game.homeTeam || "").toLowerCase().includes(team.city.toLowerCase());
                    const opp = isHome ? game.visitingTeam : game.homeTeam;
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

            {/* Recent Moves */}
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

            {/* Key Stats Row */}
            {standing && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Key Stats</span>
                </div>
                <div className="key-stats-row">
                  <KeyStatCard
                    label="Goal Diff"
                    value={standing.diff > 0 ? `+${standing.diff}` : String(standing.diff)}
                    accent={standing.diff > 0 ? "green" : standing.diff < 0 ? "red" : null}
                  />
                  <KeyStatCard label="Reg. Wins" value={standing.regulationWins ?? "—"} />
                  <KeyStatCard label="S/O Record" value={standing.shootoutRecord || "—"} />
                  <KeyStatCard label="Games Left" value={standing.gamesRemaining ?? "—"} />
                </div>
              </div>
            )}

            {/* Home / Road Split */}
            {standing && (standing.homeRecord || standing.roadRecord) && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Home / Road</span>
                </div>
                <div className="home-road-split">
                  <div className="split-block">
                    <div className="split-label">HOME</div>
                    <div className="split-record" style={{ color: team.primaryColor }}>
                      {standing.homeRecord || "—"}
                    </div>
                    <div className="split-sub">W–L–OTL–SOL</div>
                  </div>
                  <div className="split-divider" />
                  <div className="split-block">
                    <div className="split-label">ROAD</div>
                    <div className="split-record" style={{ color: team.primaryColor }}>
                      {standing.roadRecord || "—"}
                    </div>
                    <div className="split-sub">W–L–OTL–SOL</div>
                  </div>
                </div>
              </div>
            )}

            {/* Last 10 Games Strip */}
            {standing?.lastTen && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Last 10 Games</span>
                  <span className="last10-record-label">{standing.lastTen}</span>
                </div>
                <Last10Strip lastTen={standing.lastTen} primaryColor={team.primaryColor} />
              </div>
            )}

            {/* Team Stats */}
            {standing && (
              <div className="card section-card">
                <div className="card-header">
                  <span className="section-label" style={{ margin: 0 }}>Team Stats</span>
                </div>
                <div className="stats-panels">
                  {/* Offense */}
                  <div className="stats-panel">
                    <div className="stats-panel-title">Offense</div>
                    <StatBlock
                      label="GF / Game"
                      value={gfPerGame}
                      rank={divisionSuffix(divRank("gf"))}
                    />
                    <StatBlock
                      label="Goals For"
                      value={standing.gf}
                      rank={divisionSuffix(divRank("gf"))}
                    />
                    <StatBlock
                      label="ROW"
                      value={standing.rowWins ?? "—"}
                    />
                  </div>
                  {/* Defense */}
                  <div className="stats-panel">
                    <div className="stats-panel-title">Defense</div>
                    <StatBlock
                      label="GA / Game"
                      value={gaPerGame}
                      rank={divisionSuffix(divRank("ga", true))}
                    />
                    <StatBlock
                      label="Goals Against"
                      value={standing.ga}
                      rank={divisionSuffix(divRank("ga", true))}
                    />
                    <StatBlock
                      label="Goal Diff"
                      value={standing.diff > 0 ? `+${standing.diff}` : standing.diff}
                    />
                  </div>
                </div>

                {/* Season record row */}
                <div className="season-record-strip">
                  {[
                    { label: "GP", value: standing.gp },
                    { label: "W", value: standing.w },
                    { label: "L", value: standing.l },
                    { label: "OTL", value: standing.otl },
                    { label: "SOL", value: standing.sol },
                    { label: "PTS", value: standing.pts },
                    { label: "RW", value: standing.regulationWins ?? "—" },
                    { label: "ROW", value: standing.rowWins ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="record-item">
                      <div className="record-value">{value}</div>
                      <div className="record-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="overview-sidebar">
            {/* League Leaders mini-card */}
            <div className="card section-card">
              <div className="card-header">
                <span className="section-label" style={{ margin: 0 }}>League Leaders</span>
                <a href="/leaders" className="see-all-link">All →</a>
              </div>
              {[
                { title: "G", key: "goals" },
                { title: "A", key: "assists" },
                { title: "PTS", key: "points" },
                { title: "GAA", key: "gaa", lower: true },
              ].map(({ title, key, lower }) => {
                const list = leaders[key] || [];
                const top3 = (lower ? [...list].sort((a, b) => a.value - b.value) : [...list].sort((a, b) => b.value - a.value)).slice(0, 3);
                if (!top3.length) return null;
                return (
                  <div key={key} className="mini-leader-block">
                    <div className="mini-leader-cat">{title}</div>
                    {top3.map((p, i) => (
                      <div key={i} className="mini-leader-row">
                        <span className="mini-leader-rank">{i + 1}</span>
                        <span className="mini-leader-name">{p.name}</span>
                        <span className="mini-leader-team">{p.team}</span>
                        <span className="mini-leader-val">{p.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

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
                              style={{ color: t.teamId === standing?.teamId ? team.primaryColor : undefined }}
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
        <RosterTab rosterData={rosterData} teamColor={team.primaryColor} />
      )}

      {/* ── Standings Tab ── */}
      {activeTab === "standings" && (
        <div className="card section-card">
          <div className="card-header">
            <span className="section-label" style={{ margin: 0 }}>
              {standing?.division || team.division} Division
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th className="num-col">GP</th>
                  <th className="num-col">W</th>
                  <th className="num-col">L</th>
                  <th className="num-col">OT</th>
                  <th className="num-col">PTS</th>
                  <th className="num-col">GF</th>
                  <th className="num-col">GA</th>
                  <th className="num-col">DIFF</th>
                  <th className="num-col hide-mobile">HOME</th>
                  <th className="num-col hide-mobile">ROAD</th>
                </tr>
              </thead>
              <tbody>
                {divisionTeams.map((t, i) => (
                  <tr
                    key={t.teamId || i}
                    className={`team-row${i === PLAYOFF_SPOTS - 1 ? " playoff-cutoff" : ""}${t.teamId === standing?.teamId ? " current-team-row" : ""}`}
                    onClick={() => t.teamId && navigate(`/team/${t.teamId}`)}
                  >
                    <td className="rank-cell">
                      <span className={`rank-num${i < PLAYOFF_SPOTS ? " in-playoffs" : ""}`}>{i + 1}</span>
                    </td>
                    <td>
                      <div className="team-name-cell">
                        {t.logoUrl && <img src={t.logoUrl} alt="" className="row-logo" />}
                        <span style={{ color: t.primaryColor || "#fff", fontWeight: 600 }}>{t.teamName}</span>
                      </div>
                    </td>
                    <td className="num">{t.gp}</td>
                    <td className="num bold">{t.w}</td>
                    <td className="num">{t.l}</td>
                    <td className="num">{t.otl}</td>
                    <td className="num bold">{t.pts}</td>
                    <td className="num">{t.gf}</td>
                    <td className="num">{t.ga}</td>
                    <td className={`num ${t.diff > 0 ? "pos" : t.diff < 0 ? "neg" : ""}`}>
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </td>
                    <td className="num hide-mobile">{t.homeRecord}</td>
                    <td className="num hide-mobile">{t.roadRecord}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedGameId && (
        <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      )}
    </div>
  );
}

function StatBlock({ label, value, rank }) {
  return (
    <div className="stat-block">
      <div className="stat-block-value">{value}</div>
      <div className="stat-block-label">{label}</div>
      {rank && <div className="stat-block-rank">{rank}</div>}
    </div>
  );
}

// Parses "W3" / "L2" / "OTL1" into { type, count }
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

// Parses "W-L-OTL-SOL" e.g. "5-3-1-1" into counts
function parseLastTen(lastTen) {
  if (!lastTen) return null;
  const parts = String(lastTen).split("-").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [w = 0, l = 0, otl = 0, sol = 0] = parts;
  return { w, l, otl, sol };
}

function Last10Strip({ lastTen, primaryColor }) {
  const counts = parseLastTen(lastTen);
  if (!counts) return <div className="last10-empty">No data</div>;

  const { w, l, otl, sol } = counts;
  const total = w + l + otl + sol;
  // Build ordered slots: wins first, then OTL/SOL, then losses
  const slots = [
    ...Array(w).fill("W"),
    ...Array(otl).fill("OTL"),
    ...Array(sol).fill("SOL"),
    ...Array(l).fill("L"),
  ].slice(0, 10);
  // Pad to 10 if total < 10
  while (slots.length < 10) slots.push(null);

  return (
    <div className="last10-wrap">
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
      <div className="last10-counts">
        <span className="l10-count l10-w">{w}W</span>
        {(otl + sol) > 0 && <span className="l10-count l10-ot">{otl + sol} OT</span>}
        <span className="l10-count l10-l">{l}L</span>
        {total < 10 && <span className="l10-count l10-empty">{10 - total} remaining</span>}
      </div>
    </div>
  );
}

function RosterTab({ rosterData, teamColor }) {
  if (!rosterData?.roster) {
    return <p className="empty-msg" style={{ padding: "16px" }}>No roster data available.</p>;
  }

  const roster = rosterData.roster;
  const sections = [
    { key: "active",       label: "Active Roster",    filter: (p) => p.status === "active" || p.status === "signed", badge: null },
    { key: "ir",           label: "Injured Reserve",   filter: (p) => p.status === "ir",           badge: "IR",   badgeClass: "status-badge-ir" },
    { key: "reserve",      label: "Reserve",           filter: (p) => p.status === "reserve",      badge: "RES",  badgeClass: "status-badge-res" },
    { key: "recalled_ahl", label: "With AHL Club",     filter: (p) => p.status === "recalled_ahl", badge: "\u2191AHL", badgeClass: "status-badge-ahl" },
    { key: "suspended",    label: "Suspended",         filter: (p) => p.status === "suspended",    badge: "SUSP", badgeClass: "status-badge-susp" },
  ];

  return (
    <div className="roster-sections">
      {sections.map(({ key, label, filter, badge, badgeClass }) => {
        const players = roster.filter(filter).sort(sortByPosition);
        if (players.length === 0) return null;
        return (
          <div key={key} className="card section-card">
            <div className="card-header">
              <span className="section-label" style={{ margin: 0 }}>{label}</span>
              {badge && <span className={`status-badge ${badgeClass}`}>{badge}</span>}
              <span className="roster-count">{players.length}</span>
            </div>
            <div className="table-wrap">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th className="num-col">#</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="num-col">GP</th>
                    <th className="num-col">G</th>
                    <th className="num-col">A</th>
                    <th className="num-col">PTS</th>
                    {key === "ir" && <th>IR Days</th>}
                    {key === "suspended" && <th>Games</th>}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.playerId || i}>
                      <td className="num">{p.number ?? "—"}</td>
                      <td className="roster-player-name" style={{ color: teamColor }}>{p.player}</td>
                      <td>{p.position}</td>
                      <td className="num">{p.stats?.gp ?? 0}</td>
                      <td className="num">{p.stats?.g ?? 0}</td>
                      <td className="num">{p.stats?.a ?? 0}</td>
                      <td className="num bold">{p.stats?.pts ?? 0}</td>
                      {key === "ir" && <td>{p.irDays ? `${p.irDays}-day` : "—"}</td>}
                      {key === "suspended" && <td>{p.suspensionGamesRemaining ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceCard({ standing, allStandings }) {
  const teamsWithAtt = [...allStandings]
    .filter((t) => t.attendanceAverage > 0)
    .sort((a, b) => b.attendanceAverage - a.attendanceAverage);
  const rank = teamsWithAtt.findIndex((t) => t.teamId === standing.teamId) + 1;
  const total = teamsWithAtt.length;

  const fmt = (n) => n ? Number(n).toLocaleString() : "—";

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Attendance</span>
        {rank > 0 && (
          <span className="attendance-rank">#{rank} of {total}</span>
        )}
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
