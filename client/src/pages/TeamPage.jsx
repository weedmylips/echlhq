import React, { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { useTeam, useStandings, useRoster, useTeamMoves, useTeamStats, useTeamPlayers, useLeaders, useScores, useUpcoming, useScorebar, useGameAttendance, useFightingMajors, useHotPlayers } from "../hooks/useECHL.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import MatchupModal from "../components/MatchupModal.jsx";
import PlayerModal from "../components/PlayerModal.jsx";
import ShareButton from "../components/ShareButton.jsx";
import { TEAMS, findTeamByName } from "../config/teamConfig.js";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const setActiveTab = (tab) => {
    if (tab === "overview") setSearchParams({}, { replace: true });
    else setSearchParams({ tab }, { replace: true });
  };
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const { data, isLoading, error } = useTeam(teamId);
  const { data: standingsData } = useStandings();
  const { data: rosterData } = useRoster(teamId);
  const { data: playersData } = useTeamPlayers(teamId);
  const { data: movesData } = useTeamMoves(teamId);
  const { data: teamStats } = useTeamStats(teamId);
  const { data: leadersData } = useLeaders();
  const { data: upcomingData } = useUpcoming();
  const { data: scorebarData } = useScorebar();
  const scorebarGames = scorebarData?.games || [];
  const { data: scoresData } = useScores();
  const { data: attendanceData } = useGameAttendance();
  const { data: fightingMajorsData } = useFightingMajors();
  const { hotSkaters, hotGoalies, isLoading: hotLoading } = useHotPlayers(teamId);

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

  // Playoff header info — only shown when ≤ 20 games remaining
  const showPlayoffInfo = teamStats && standing?.gamesRemaining != null && standing.gamesRemaining <= 20;
  const headerStatusClass = teamStats
    ? teamStats.playoffStatus === "CLINCHED"            ? "badge-clinched"
    : teamStats.playoffStatus === "IN PLAYOFF POSITION" ? "badge-position"
    : teamStats.playoffStatus === "ON THE BUBBLE"       ? "badge-bubble"
    : teamStats.playoffStatus === "ELIMINATED"          ? "badge-eliminated" : "badge-chasing"
    : "";

  return (
    <div className="team-page" style={{
      "--team-primary": team.primaryColor || "#1a6aff",
      "--team-secondary": team.secondaryColor || "#ff8c00",
      "--team-primary-light": `color-mix(in srgb, ${team.primaryColor || "#1a6aff"} 60%, #ffffff)`,
      "--team-secondary-light": `color-mix(in srgb, ${team.secondaryColor || "#ff8c00"} 60%, #ffffff)`,
    }}>
      <Helmet>
        <title>{team?.name || "Team"} — ECHL Stats</title>
        <meta name="description" content={`Roster, stats, and recent results for ${team?.name || "team"}`} />
        <meta property="og:title" content={`${team?.name || "Team"} — ECHL Stats`} />
        <meta property="og:description" content={`Roster, stats, and recent results for ${team?.name || "team"}`} />
      </Helmet>
      {/* ── Header ── */}
      <div className="team-header">
        <div
          className="team-header-accent"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${team.primaryColor} 28%, transparent) 0%, color-mix(in srgb, ${team.secondaryColor} 8%, transparent) 50%, transparent 100%)` }}
        />
        <div className="team-header-content">
          <div className="team-header-left">
            <div className="team-logo-col">
              {team.logoUrl && (
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="team-header-logo"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
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
                </div>
              )}
            </div>
            <div className="team-header-info">
              <h1 className="team-header-name">{team.name}</h1>
              <div className="team-header-meta">
                {standing && (
                  <span className="record-text header-record-text">
                    {standing.w}–{standing.l}–{standing.otl} · {standing.pts} PTS
                  </span>
                )}
              </div>
              {standing?.lastTen && (
                <div className="header-last10" style={{ marginTop: 4 }}>
                  <span className="header-last10-label">L10</span>
                  <span className="record-text">{standing.lastTen}</span>
                  {standing?.streak && <StreakBadge streak={standing.streak} />}
                </div>
              )}
              {showPlayoffInfo && teamStats.playoffStatus && (
                <div style={{ marginTop: 4 }}>
                  <span className={`playoff-status-badge ${headerStatusClass}`}>{teamStats.playoffStatus}</span>
                </div>
              )}
              <div className="header-stats-stack">
                {standing?.gamesRemaining != null && (
                  <div className="header-last10">
                    <span className="header-last10-label">GAMES LEFT</span>
                    <span className="record-text">{standing.gamesRemaining}</span>
                  </div>
                )}
                {standing?.homeRecord && (() => {
                  const homeGamesPlayed = standing.homeRecord.split("-").reduce((acc, v) => acc + parseInt(v || "0", 10), 0);
                  const homeGamesLeft = Math.max(0, 36 - homeGamesPlayed);
                  return (
                    <div className="header-last10">
                      <span className="header-last10-label">HOME LEFT</span>
                      <span className="record-text">{homeGamesLeft}</span>
                    </div>
                  );
                })()}
                {showPlayoffInfo && !teamStats.isClinched && teamStats.ptsBack1st > 0 && (
                  <div className="header-last10">
                    <span className="header-last10-label">BACK OF 1ST</span>
                    <span className="record-text">{teamStats.ptsBack1st}</span>
                  </div>
                )}
                {showPlayoffInfo && teamStats.rank > 4 && (
                  <div className="header-last10">
                    <span className="header-last10-label">BACK OF 4TH</span>
                    <span className="record-text">{teamStats.ptsBack4th}</span>
                  </div>
                )}
                {showPlayoffInfo && !teamStats.isClinched && !teamStats.isEliminated && (
                  <div className="header-last10">
                    <span className="header-last10-label">MAGIC #</span>
                    <span className="record-text">{teamStats.magicNumber || "—"}</span>
                    <span className="header-last10-sub">
                      {teamStats.rank <= 4 ? "pts to clinch" : "pts to pass 4th"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="team-tabs">
        {[["overview", "Overview"], ["roster", "Roster"], ["schedule", "Schedule"], ["stats", "Team Stats"], ["scores", "Scores"]].map(([tab, label]) => (
          <button
            key={tab}
            className={`team-tab${activeTab === tab ? " active" : ""}`}
            style={activeTab === tab ? { borderBottomColor: team.primaryColor } : {}}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="overview-layout">
          {/* ── Left/main column ── */}
          <div className="overview-main">

            {/* Hot Players */}
            <HotPlayersCard hotSkaters={hotSkaters} hotGoalies={hotGoalies} isLoading={hotLoading} rosterData={rosterData} />

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

            {/* Division Head-to-Head — full width */}
            {teamStats && (
              <DivisionH2HCard ts={teamStats} team={team} allStandings={allStandings} navigate={navigate} />
            )}

            {/* Attendance Card */}
            {standing?.attendanceAverage > 0 && (
              <AttendanceCard standing={standing} allStandings={allStandings} attendanceGames={attendanceData?.games} teamId={parseInt(teamId, 10)} />
            )}

          </div>

          {/* ── Right sidebar — DO NOT MODIFY ── */}
          <div className="overview-sidebar">
            {/* Team Leaders card */}
            {rosterData?.roster && (() => {
              const isOnTeam = (s) => s === "active" || s === "signed" || s === "loaned";
              const normalize = (n) => (n || "").replace(/^x\s+/i, "").replace(/^\*\s*/i, "").trim().toLowerCase();
              const skaters = (playersData?.skaters || []).filter((p) => p.isActive && (p.gp ?? 0) > 0);
              const goalies = rosterData.roster.filter((p) => {
                if ((!isOnTeam(p.status) && p.status !== "reserve") || p.position !== "G" || (p.stats?.gp ?? 0) === 0) return false;
                const pd = playersData?.goalies?.find((g) => normalize(g.player) === normalize(p.player));
                return pd ? pd.isActive : true;
              });
              const top = (arr, key, n = 3) =>
                [...arr].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n);

              // Look up league rank for a skater in a stat category
              const rankFrom = (arr, name) => {
                if (!arr) return null;
                const entry = arr.find((e) => normalize(e.name) === normalize(name));
                return (entry && entry.rank <= 15) ? entry.rank : null;
              };
              const leagueRankFor = (name, cat) => {
                const leaders = leadersData?.leaders;
                const arr = cat === "PTS" ? leaders?.allPoints
                          : cat === "G"   ? leaders?.goals
                          :                 leaders?.assists;
                return rankFrom(arr, name);
              };
              const goalieRanks = (name) => ({
                svPct: rankFrom(leadersData?.leaders?.svPct, name),
              });

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

              const topGoalies = [...goalies].sort((a, b) => {
                const gsA = goalieStats(a.player);
                const gsB = goalieStats(b.player);
                return (gsB?.svPct ?? 0) - (gsA?.svPct ?? 0);
              }).slice(0, 3);

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
                        const val  = title === "PTS" ? p.pts
                                   : title === "G"   ? p.g
                                   :                   p.a;
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
                        const gRanks = goalieRanks(p.player);
                        return (
                          <div key={i} className="mini-leader-row">
                            <span className="mini-leader-rank">{i + 1}</span>
                            <span className="mini-leader-name-group">
                              <span className="mini-leader-name">{p.player}</span>
                              {gRanks.svPct && <span className="league-rank-pill">#{gRanks.svPct} SV%</span>}
                            </span>
                            <span className="mini-leader-team">G</span>
                            {gs ? (
                              <>
                                <span className="mini-leader-val">{gs.gaa.toFixed(2)}</span>
                                <span className="mini-goalie-sv">{gs.svPct.toFixed(3).replace(/^0/, "")}</span>
                              </>
                            ) : (
                              <span className="mini-leader-val">{p.stats?.gp}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(() => {
                    const matchSkater = (abbr) => {
                      const fmLast = abbr.split(" ").slice(1).join(" ").toLowerCase();
                      const fmInit = abbr[0]?.toLowerCase();
                      return skaters.find((s) => {
                        const full = normalize(s.player);
                        return full.split(" ").slice(1).join(" ") === fmLast && full[0] === fmInit;
                      });
                    };
                    const allFighters = fightingMajorsData?.leaders || [];
                    const fmLeagueRank = (name) => {
                      const idx = allFighters.findIndex((f) => f.name === name);
                      if (idx < 0) return null;
                      // Account for ties — rank = first index with same value + 1
                      const val = allFighters[idx].fightingMajors;
                      const rank = allFighters.findIndex((f) => f.fightingMajors === val) + 1;
                      return rank <= 15 ? rank : null;
                    };
                    const teamFighters = allFighters
                      .filter((p) => p.team.toLowerCase() === team.city.toLowerCase())
                      .map((p) => ({ ...p, skater: matchSkater(p.name), leagueRank: fmLeagueRank(p.name) }))
                      .filter((p) => p.skater)
                      .slice(0, 5);
                    if (teamFighters.length === 0) return null;
                    return (
                      <div className="mini-leader-block">
                        <div className="mini-leader-cat">Fighting Majors</div>
                        {teamFighters.map((p, i) => (
                          <div key={i} className="mini-leader-row">
                            <span className="mini-leader-rank">{i + 1}</span>
                            <span className="mini-leader-name-group">
                              <span className="mini-leader-name">{p.skater.player}</span>
                              {p.leagueRank && <span className="league-rank-pill">#{p.leagueRank}</span>}
                            </span>
                            <span className="mini-leader-val">{p.fightingMajors}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

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
        <RosterTab playersData={playersData} rosterData={rosterData} onPlayerClick={setSelectedPlayer} />
      )}

      {/* ── Stats Tab ── */}
      {activeTab === "stats" && (
        <div className="overview-layout stats-layout">
          <div className="overview-main">

            {/* Team Stats */}
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

            {/* Special Teams + Defensive + Offensive Efficiency + PIM */}
            {teamStats && standing && teamStats.hasST && (
              <SpecialTeamsCard ts={teamStats} standing={standing} />
            )}
            {teamStats && standing && (
              <DefensiveEfficiencyCard ts={teamStats} team={team} standing={standing} />
            )}
            {teamStats && standing && (
              <OffensiveEfficiencyCard ts={teamStats} team={team} standing={standing} />
            )}
            {teamStats && standing && <PimCard ts={teamStats} team={team} standing={standing} />}

          </div>
        </div>
      )}

      {/* ── Scores Tab ── */}
      {activeTab === "scores" && (
        <ScoresTab
          scoresData={scoresData}
          upcomingData={upcomingData}
          scorebarGames={scorebarGames}
          allStandings={allStandings}
          teamId={teamId}
          team={team}
          navigate={navigate}
          setSelectedGameId={setSelectedGameId}
          setSelectedMatchup={setSelectedMatchup}
        />
      )}

      {/* ── Schedule Tab ── */}
      {activeTab === "schedule" && (
        <ScheduleTab
          recentScores={recentScores}
          upcomingData={upcomingData}
          scorebarGames={scorebarGames}
          teamId={teamId}
          team={team}
          navigate={navigate}
          setSelectedGameId={setSelectedGameId}
          setSelectedMatchup={setSelectedMatchup}
        />
      )}

      {selectedGameId && (
        <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      )}

      {selectedMatchup && (
        <MatchupModal
          visitingTeamId={selectedMatchup.visitingTeamId}
          homeTeamId={selectedMatchup.homeTeamId}
          date={selectedMatchup.date}
          time={selectedMatchup.time}
          onClose={() => setSelectedMatchup(null)}
        />
      )}
      {selectedPlayer && (
        <PlayerModal
          playerId={selectedPlayer.playerId}
          playerName={selectedPlayer.playerName}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

// ─── Hot Players Card ─────────────────────────────────────────────────────────
function HotPlayersCard({ hotSkaters, hotGoalies, isLoading, rosterData }) {
  if (isLoading) return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>On Fire · Last 5 Games</span>
      </div>
      <p className="empty-msg" style={{ padding: "16px" }}>Loading…</p>
    </div>
  );
  if (!hotSkaters.length && !hotGoalies.length) return null;

  // Build lookup from roster: map abbreviated boxscore names ("D. Wendt") to full names + statuses
  const rosterByAbbr = {};
  if (rosterData?.roster) {
    for (const p of rosterData.roster) {
      const full = (p.player || "").replace(/^x\s+/i, "").replace(/^\*\s*/i, "").trim();
      const parts = full.split(/\s+/);
      if (parts.length >= 2) {
        const abbr = (parts[0][0] + ". " + parts.slice(1).join(" ")).toLowerCase();
        rosterByAbbr[abbr] = { fullName: full, status: p.status };
      }
      rosterByAbbr[full.toLowerCase()] = { fullName: full, status: p.status };
    }
  }
  const getRoster = (name) => rosterByAbbr[(name || "").toLowerCase()];
  const fullName = (name) => getRoster(name)?.fullName || name;
  const isAHLDown = (name) => getRoster(name)?.status === "assigned_ahl";
  const isAHLUp = (name) => { const s = getRoster(name)?.status; return s === "recalled_ahl" || s === "loaned"; };

  return (
    <div className="card section-card hot-players-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>On Fire · Last 5 Games</span>
      </div>
      <div className="hot-players-list">
        {hotSkaters.length > 0 && (
          <>
            <div className="hot-section-label">Skaters</div>
            {hotSkaters.map((p, i) => (
              <div key={i} className="hot-player-row">
                <span className="hot-icon">🔥</span>
                <span className="hot-name">
                  {fullName(p.name)}
                  {isAHLDown(p.name) && <span className="status-badge status-badge-inline status-badge-ahl-down">↓AHL</span>}
                  {isAHLUp(p.name) && <span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span>}
                </span>
                <span className="hot-stats">{p.g}G · {p.a}A · {p.pts}PTS</span>
              </div>
            ))}
          </>
        )}
        {hotGoalies.length > 0 && (
          <>
            <div className="hot-section-label">Goalies</div>
            {hotGoalies.map((g, i) => (
              <div key={i} className="hot-player-row">
                <span className="hot-icon">🔥</span>
                <span className="hot-name">
                  {fullName(g.name)}
                  {isAHLDown(g.name) && <span className="status-badge status-badge-inline status-badge-ahl-down">↓AHL</span>}
                  {isAHLUp(g.name) && <span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span>}
                </span>
                <span className="hot-stats">{g.svPct.toFixed(3).replace(/^0/, "")} SV% · {g.gaa.toFixed(2)} GAA</span>
              </div>
            ))}
          </>
        )}
      </div>
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
          <div className="playoff-stat-item">
            <div className="playoff-stat-val" style={
              ts.isClinched ? { color: "var(--green)" } :
              ts.isEliminated ? { color: "var(--text-muted)" } : {}
            }>
              {ts.isClinched ? "✓" : ts.isEliminated ? "—" : (ts.magicNumber || "—")}
            </div>
            <div className="playoff-stat-lbl">Magic #</div>
            {!ts.isClinched && !ts.isEliminated && (
              <div className="playoff-stat-sub">
                {ts.rank <= 4 ? "pts to clinch" : "pts to pass 4th"}
              </div>
            )}
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
            Div: <span className="rank-badge">{ordinal(divPPRank)}</span> · League: <span className="rank-badge">{ordinal(leaguePPRank)}</span>
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
            Div: <span className="rank-badge">{ordinal(divPKRank)}</span> · League: <span className="rank-badge">{ordinal(leaguePKRank)}</span>
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
  const { gaPerGame, leagueAvgGA, leagueGARank, divGARank } = ts;
  const belowAvg = gaPerGame < leagueAvgGA;

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
    </div>
  );
}

function OffensiveEfficiencyCard({ ts, team, standing }) {
  const { gfPerGame, leagueAvgGF, leagueGFRank, divGFRank } = ts;
  const offAbove = gfPerGame > leagueAvgGF;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Offensive Efficiency</span>
        <span className="def-badge" style={{ color: offAbove ? "var(--green)" : "var(--red)", background: offAbove ? "var(--green-bg)" : "var(--red-bg)" }}>
          {offAbove ? "Above Average" : "Below Average"}
        </span>
      </div>
      <div className="def-stats-row">
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
      <div className="def-bar-wrap">
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

function getGameType(game) {
  const isFinal = /Final/i.test(game.status) ||
    (game.clock === "00:00" && /^(3rd|OT|SO)/.test(game.period));
  const isPregame = (game.clock === "00:00" || game.clock === "20:00") && game.period === "1st" && !/Final/i.test(game.status);
  if (isFinal) return "final";
  if (isPregame || !game.period) return "pregame";
  return "live";
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
    return <span className="status-badge status-badge-inline status-badge-ir">IR</span>;
  }
  if (p._status === "reserve") return <span className="status-badge status-badge-inline status-badge-res">RES</span>;
  if (p._status === "recalled_ahl" || p._status === "loaned") return <span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span>;
  if (p._status === "assigned_ahl") return <span className="status-badge status-badge-inline status-badge-ahl-down">↓AHL</span>;
  if (p._status === "suspended") {
    const label = p._suspensionGamesRemaining ? `SUSP ${p._suspensionGamesRemaining}g` : "SUSP";
    return <span className="status-badge status-badge-inline status-badge-susp">{label}</span>;
  }
  if (p._status === "leave") return <span className="status-badge status-badge-inline status-badge-res">LEAVE</span>;
  return null;
}

// ─── Scores Tab ──────────────────────────────────────────────────────────────

function toDateKey(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function dateKeyToDisplay(key) {
  const d = new Date(key + "T12:00:00");
  if (isNaN(d)) return key;
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const isToday = key === todayET;
  const yesterdayD = new Date(todayET + "T12:00:00Z"); yesterdayD.setUTCDate(yesterdayD.getUTCDate() - 1);
  const isYesterday = key === yesterdayD.toISOString().slice(0, 10);
  const tomorrowD = new Date(todayET + "T12:00:00Z"); tomorrowD.setUTCDate(tomorrowD.getUTCDate() + 1);
  const isTomorrow = key === tomorrowD.toISOString().slice(0, 10);
  const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  if (isToday) return `Today — ${label}`;
  if (isYesterday) return `Yesterday — ${label}`;
  if (isTomorrow) return `Tomorrow — ${label}`;
  return label;
}

function scoresGameType(game) {
  const isFinal = /Final/i.test(game.status) ||
    (game.clock === "00:00" && /^(3rd|OT|SO)/.test(game.period));
  const isPregame = (game.clock === "00:00" || game.clock === "20:00") && game.period === "1st" && !/Final/i.test(game.status);
  if (isFinal) return "final";
  if (isPregame || !game.period) return "pregame";
  return "live";
}

function ScoresTab({ scoresData, upcomingData, scorebarGames, allStandings, teamId, team, navigate, setSelectedGameId, setSelectedMatchup }) {
  const tid = parseInt(teamId, 10);
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Build record lookup from standings: teamId → "W-L-OTL"
  const recordMap = {};
  for (const s of allStandings) {
    if (s.teamId) recordMap[s.teamId] = `${s.w}-${s.l}-${s.otl}`;
  }
  const [dateKey, setDateKey] = useState(todayKey);

  const scores = scoresData?.scores || [];
  const upcoming = upcomingData?.games || [];

  // Build date → games map from all sources
  const gamesByDate = {};
  const addGame = (dateK, game) => {
    (gamesByDate[dateK] = gamesByDate[dateK] || []).push(game);
  };

  // Scorebar games (live + recent) — richest data, keyed by gameId to dedup
  const scorebarById = {};
  for (const sg of scorebarGames) {
    const dk = toDateKey(sg.date);
    scorebarById[sg.gameId] = true;
    addGame(dk, { ...sg, _source: "scorebar" });
  }

  // Historical scores — skip if already in scorebar
  for (const s of scores) {
    if (s.gameId && scorebarById[s.gameId]) continue;
    const dk = toDateKey(s.date);
    addGame(dk, { ...s, _source: "scores" });
  }

  // Upcoming — skip if already covered by scorebar
  for (const u of upcoming) {
    const dk = toDateKey(u.date);
    const already = (gamesByDate[dk] || []).some(
      (g) => g.visitingTeamId === u.visitingTeamId && g.homeTeamId === u.homeTeamId
    );
    if (!already) addGame(dk, { ...u, _source: "upcoming" });
  }

  // Get sorted list of all available dates
  const allDates = Object.keys(gamesByDate).sort();

  // Navigate date
  const shiftDate = (offset) => {
    const d = new Date(dateKey + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setDateKey(d.toISOString().slice(0, 10));
  };

  const games = gamesByDate[dateKey] || [];

  return (
    <div className="scores-tab">
      {/* Date nav header */}
      <div className="scores-date-nav">
        <button className="scores-date-arrow" onClick={() => shiftDate(-1)}>&#8249;</button>
        <span className="scores-date-label">{dateKeyToDisplay(dateKey)}</span>
        <button className="scores-date-arrow" onClick={() => shiftDate(1)}>&#8250;</button>
      </div>

      {/* Game cards grid */}
      {games.length === 0 ? (
        <p className="empty-msg" style={{ textAlign: "center", padding: "32px 16px" }}>No games scheduled for this date.</p>
      ) : (
        <div className="scores-grid">
          {games.map((g, i) => {
            const awayConfig = TEAMS[g.visitingTeamId] || findTeamByName(g.visitingTeam);
            const homeConfig = TEAMS[g.homeTeamId] || findTeamByName(g.homeTeam);
            const type = g._source === "scorebar" ? scoresGameType(g) : (g._source === "scores" ? "final" : "pregame");
            const isLive = type === "live";
            const isFinal = type === "final";
            const awayScore = g.visitingScore ?? g.visitingGoals;
            const homeScore = g.homeScore ?? g.homeGoals;
            const isMyGame = g.visitingTeamId === tid || g.homeTeamId === tid ||
              awayConfig?.id === tid || homeConfig?.id === tid;

            return (
              <button
                key={g.gameId || i}
                className={`scores-card${isLive ? " scores-card-live" : ""}${isMyGame ? " scores-card-mine" : ""}`}
                style={isMyGame ? { "--team-glow": team.primaryColor } : undefined}
                onClick={() => {
                  if ((isLive || isFinal) && g.gameId) {
                    setSelectedGameId(g.gameId);
                  } else if (g.visitingTeamId && g.homeTeamId) {
                    setSelectedMatchup({ visitingTeamId: g.visitingTeamId, homeTeamId: g.homeTeamId, date: g.date });
                  }
                }}
              >
                {/* Status bar */}
                <div className="scores-card-top">
                  <span className="scores-card-status">
                    {isLive ? (
                      <>
                        <span className="live-badge">LIVE</span>
                        <span className="scores-card-period">
                          {g.intermission ? `${g.period} INT` : `${g.period} · ${g.clock}`}
                        </span>
                      </>
                    ) : isFinal ? (
                      <span className="scores-card-final">Final{g.overtime ? ` (${g.overtime})` : ""}</span>
                    ) : (
                      <span className="scores-card-time">{g.gameTime || g.time || "TBD"}</span>
                    )}
                  </span>
                </div>

                {/* Away team row */}
                <div className="scores-card-team">
                  {awayConfig?.logoUrl && <img src={awayConfig.logoUrl} alt="" className="scores-card-logo" />}
                  <span className="scores-card-abbr">{awayConfig?.abbr || g.visitingCode || g.visitingTeam}</span>
                  <span className="scores-card-record">{g.visitingRecord || (!isFinal ? recordMap[g.visitingTeamId || awayConfig?.id] : "") || ""}</span>
                  <span className="scores-card-score">{(isLive || isFinal) ? awayScore : "–"}</span>
                </div>

                <div className="scores-card-divider" />

                {/* Home team row */}
                <div className="scores-card-team">
                  {homeConfig?.logoUrl && <img src={homeConfig.logoUrl} alt="" className="scores-card-logo" />}
                  <span className="scores-card-abbr">{homeConfig?.abbr || g.homeCode || g.homeTeam}</span>
                  <span className="scores-card-record">{g.homeRecord || (!isFinal ? recordMap[g.homeTeamId || homeConfig?.id] : "") || ""}</span>
                  <span className="scores-card-score">{(isLive || isFinal) ? homeScore : "–"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab({ recentScores, upcomingData, scorebarGames, teamId, team, navigate, setSelectedGameId, setSelectedMatchup }) {
  const tid = parseInt(teamId, 10);
  const city = team.city.toLowerCase();

  // Last 10 games, reversed to chronological order (oldest first)
  const last10 = (recentScores || []).slice(0, 10).reverse();

  // Build scorebar lookup for live overlays
  const scorebarByKey = {};
  for (const sg of scorebarGames) {
    scorebarByKey[`${sg.visitingTeamId}-${sg.homeTeamId}`] = sg;
  }

  // IDs of recent games to avoid duplicates in upcoming
  const recentIds = new Set((recentScores || []).map((g) => g.gameId).filter(Boolean));

  // Next 15 upcoming games for this team, excluding already-final games in recent results
  const next15 = (upcomingData?.games || [])
    .filter((g) => g.visitingTeamId === tid || g.homeTeamId === tid)
    .filter((g) => {
      const sg = scorebarByKey[`${g.visitingTeamId}-${g.homeTeamId}`];
      if (sg && getGameType(sg) === "final" && recentIds.has(sg.gameId)) return false;
      return true;
    })
    .slice(0, 15);

  return (
    <div className="schedule-tab">
      <div className="card section-card">
        <div className="card-header">
          <span className="section-label" style={{ margin: 0 }}>Schedule</span>
        </div>
        <div className="schedule-list">
          {/* Recent completed games */}
          {last10.map((game, i) => {
            const isHome = (game.homeTeam || "").toLowerCase().includes(city);
            const oppCity = isHome ? game.visitingTeam : game.homeTeam;
            const oppId = isHome ? game.visitingTeamId : game.homeTeamId;
            const oppConfig = oppId ? TEAMS[oppId] : null;
            const myScore = isHome ? game.homeScore : game.visitingScore;
            const oppScore = isHome ? game.visitingScore : game.homeScore;
            const result = getResult(game, team.city);
            return (
              <button
                key={`past-${i}`}
                className="schedule-row schedule-row-past"
                onClick={() => game.gameId && setSelectedGameId(game.gameId)}
              >
                <span className="schedule-date">{game.date || "—"}</span>
                <span className="schedule-loc">{isHome ? "vs" : "@"}</span>
                <span className="schedule-opp">
                  {oppConfig?.logoUrl && <img src={oppConfig.logoUrl} alt="" className="schedule-logo" />}
                  {oppCity}
                </span>
                <span className="schedule-result">
                  <ResultBadge result={result} />
                  <span className="schedule-score">
                    {myScore !== undefined ? `${myScore}–${oppScore}` : "—"}
                    {game.overtime ? ` (${game.overtime})` : ""}
                  </span>
                </span>
                <span className="schedule-chevron">›</span>
              </button>
            );
          })}

          {/* Divider between past and upcoming */}
          {last10.length > 0 && next15.length > 0 && (
            <div className="schedule-divider"><span>Upcoming</span></div>
          )}

          {/* Upcoming / live games */}
          {next15.map((g, i) => {
            const isHome = g.homeTeamId === tid;
            const oppId = isHome ? g.visitingTeamId : g.homeTeamId;
            const oppCity = isHome ? g.visitingTeam : g.homeTeam;
            const oppConfig = TEAMS[oppId];
            const sg = scorebarByKey[`${g.visitingTeamId}-${g.homeTeamId}`];
            const gameType = sg ? getGameType(sg) : null;
            const isLive = gameType === "live";
            const isFinal = gameType === "final";
            const hasScore = isLive || isFinal;
            const myScore = isHome ? sg?.homeGoals : sg?.visitingGoals;
            const oppScore = isHome ? sg?.visitingGoals : sg?.homeGoals;
            return (
              <button
                key={`upcoming-${i}`}
                className={`schedule-row schedule-row-upcoming${isLive ? " schedule-row-live" : ""}${isFinal ? " schedule-row-final" : ""}`}
                onClick={() => {
                  if ((isLive || isFinal) && sg?.gameId) {
                    setSelectedGameId(sg.gameId);
                  } else if (g.visitingTeamId && g.homeTeamId) {
                    setSelectedMatchup(g);
                  }
                }}
              >
                <span className="schedule-date">{g.date || "—"}</span>
                <span className="schedule-loc">{isHome ? "vs" : "@"}</span>
                <span className="schedule-opp">
                  {oppConfig?.logoUrl && <img src={oppConfig.logoUrl} alt="" className="schedule-logo" />}
                  {oppCity}
                </span>
                <span className="schedule-result">
                  {isLive ? (
                    <>
                      <span className="live-badge">LIVE</span>
                      <span className="schedule-live-detail">
                        {myScore}–{oppScore} · {sg.intermission ? `${sg.period} INT` : `${sg.period} ${sg.clock}`}
                      </span>
                    </>
                  ) : isFinal ? (
                    <>
                      <ResultBadge result={myScore > oppScore ? "W" : myScore < oppScore ? "L" : null} />
                      <span className="schedule-score">{myScore}–{oppScore}</span>
                    </>
                  ) : (
                    <span className="schedule-time">{g.time}</span>
                  )}
                </span>
                <span className="schedule-chevron">›</span>
              </button>
            );
          })}

          {last10.length === 0 && next15.length === 0 && (
            <p className="empty-msg" style={{ padding: "16px" }}>No games available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RosterTab({ playersData, rosterData, onPlayerClick }) {
  const [sortCol, setSortCol] = useState("pts");
  const [sortDesc, setSortDesc] = useState(true);

  if (!playersData?.skaters) {
    return <p className="empty-msg" style={{ padding: "16px" }}>No roster data available.</p>;
  }

  const handleSort = (col) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
  };

  const sortIcon = (col) => sortCol === col ? <span className="sort-icon" style={{marginLeft: 4}}>{sortDesc ? "↓" : "↑"}</span> : null;

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
      return { ...p, _playerId: r?.playerId ?? null, _status: r?.status ?? "active", _irDays: r?.irDays ?? null, _suspensionGamesRemaining: r?.suspensionGamesRemaining ?? null };
    });

  const activeGoalies = (playersData.goalies || [])
    .filter((p) => p.isActive)
    .sort((a, b) => (b.svPct ?? 0) - (a.svPct ?? 0))
    .map((p) => {
      const r = rosterByName[p.player.toLowerCase()];
      return { ...p, _playerId: r?.playerId ?? null, _status: r?.status ?? "active", _irDays: r?.irDays ?? null, _suspensionGamesRemaining: r?.suspensionGamesRemaining ?? null };
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
      pm: p.stats?.plusMinus ?? p.stats?.pm ?? 0, pim: p.stats?.pim ?? 0,
      isRookie: false, _playerId: p.playerId ?? null, _status: p.status, _irDays: p.irDays ?? null, _suspensionGamesRemaining: p.suspensionGamesRemaining ?? null,
    }));

  const inactiveGoalies = (rosterData?.roster || [])
    .filter((p) => INACTIVE_STATUSES.has(p.status) && p.position === "G" && !activeGoaliesNames.has(p.player.toLowerCase()))
    .sort(sortByPosition)
    .map((p) => ({
      player: p.player, number: p.number, position: p.position,
      gp: p.stats?.gp ?? 0, w: p.stats?.w ?? 0, l: p.stats?.l ?? 0,
      gaa: p.stats?.gaa ?? 0, svPct: p.stats?.svPct ?? 0,
      isRookie: false, _playerId: p.playerId ?? null, _status: p.status, _irDays: p.irDays ?? null, _suspensionGamesRemaining: p.suspensionGamesRemaining ?? null,
    }));

  const byPts = (a, b) => {
    let result = 0;
    if (sortCol === "player") result = a.player.localeCompare(b.player);
    else result = (a[sortCol] ?? 0) - (b[sortCol] ?? 0);
    return sortDesc ? -result : result;
  };
  const forwards   = [...activeSkaters, ...inactiveSkaters].filter((p) => p.position !== "D" && p.position !== "G").sort(byPts);
  const defensemen = [...activeSkaters, ...inactiveSkaters].filter((p) => p.position === "D").sort(byPts);
  const allGoalies = [...activeGoalies, ...inactiveGoalies].sort((a, b) => (b.svPct ?? 0) - (a.svPct ?? 0));

  const skaterTable = (players) => (
    <div className="table-wrap">
      <table className="roster-table">
        <thead>
          <tr>
            <th className="num-col">#</th>
            <th onClick={() => handleSort("player")} style={{ cursor: "pointer" }}>Player{sortIcon("player")}</th>
            <th className="num-col" onClick={() => handleSort("gp")} style={{ cursor: "pointer" }}>GP{sortIcon("gp")}</th>
            <th className="num-col" onClick={() => handleSort("g")} style={{ cursor: "pointer" }}>G{sortIcon("g")}</th>
            <th className="num-col" onClick={() => handleSort("a")} style={{ cursor: "pointer" }}>A{sortIcon("a")}</th>
            <th className="num-col" onClick={() => handleSort("pts")} style={{ cursor: "pointer" }}>PTS{sortIcon("pts")}</th>
            <th className="num-col" onClick={() => handleSort("pm")} style={{ cursor: "pointer" }}>+/-{sortIcon("pm")}</th>
            <th className="num-col" onClick={() => handleSort("pim")} style={{ cursor: "pointer" }}>PIM{sortIcon("pim")}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i}>
              <td className="num">{p.number ?? "—"}</td>
              <td className="roster-player-name">
                <span className={p._playerId ? "player-link" : ""} onClick={() => p._playerId && onPlayerClick({ playerId: p._playerId, playerName: p.player })}>{p.player}</span>
                {p.isRookie && <span className="rookie-badge">R</span>}
                {statusBadge(p)}
              </td>
              <td className="num">{p.gp}</td>
              <td className="num">{p.g}</td>
              <td className="num">{p.a}</td>
              <td className="num bold">{p.pts}</td>
              <td className={`num ${p.pm > 0 ? "pos" : p.pm < 0 ? "neg" : ""}`}>{p.pm > 0 ? `+${p.pm}` : p.pm}</td>
              <td className="num">{p.pim}</td>
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
                      <span className={p._playerId ? "player-link" : ""} onClick={() => p._playerId && onPlayerClick({ playerId: p._playerId, playerName: p.player })}>{p.player}</span>
                      {p.isRookie && <span className="rookie-badge">R</span>}
                      {statusBadge(p)}
                    </td>
                    <td className="num">{p.gp}</td>
                    <td className="num">{p.w}</td>
                    <td className="num">{p.l}</td>
                    <td className="num">{p.gaa?.toFixed(2) ?? "—"}</td>
                    <td className="num">{p.svPct ? p.svPct.toFixed(3).replace(/^0/, "") : "—"}</td>
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
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-ir">IR</span> Injured Reserve</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-res">RES</span> Reserve (healthy scratch / roster compliance)</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-ahl">↑AHL</span> On loan / recalled to AHL affiliate</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-ahl-down">↓AHL</span> Assigned from AHL</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-susp">SUSP Ng</span> Suspended (N games remaining)</span>
      <span className="roster-legend-item"><span className="status-badge status-badge-inline status-badge-res">LEAVE</span> Personal leave</span>
    </div>
    </>
  );
}

function AttendanceCard({ standing, allStandings, attendanceGames, teamId }) {
  const teamsWithAtt = [...allStandings].filter((t) => t.attendanceAverage > 0);
  const fmt   = (n) => n ? Number(n).toLocaleString() : "—";
  const teamConfig = TEAMS[standing.teamId];
  const capacity = teamConfig?.arenaCapacity;
  const capacityPct = capacity && standing.attendanceAverage
    ? Math.round((standing.attendanceAverage / capacity) * 100)
    : null;

  const rankBy = (sortFn) => {
    const sorted = [...teamsWithAtt].sort(sortFn);
    return sorted.findIndex((t) => t.teamId === standing.teamId) + 1;
  };
  const avgRank   = rankBy((a, b) => b.attendanceAverage - a.attendanceAverage);
  const totalRank = rankBy((a, b) => b.attendanceTotal - a.attendanceTotal);
  const capRank   = capacityPct != null
    ? rankBy((a, b) => {
        const capA = TEAMS[a.teamId]?.arenaCapacity;
        const capB = TEAMS[b.teamId]?.arenaCapacity;
        const pctA = capA ? a.attendanceAverage / capA : 0;
        const pctB = capB ? b.attendanceAverage / capB : 0;
        return pctB - pctA;
      })
    : null;

  const topGames = (attendanceGames || [])
    .filter((g) => g.homeTeamId === teamId)
    .sort((a, b) => b.attendance - a.attendance)
    .slice(0, 10);

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="section-label" style={{ margin: 0 }}>Attendance</span>
        <a href="/attendance" className="see-all-link">Stats →</a>
      </div>
      <div className="attendance-body">
        <div className="att-stat">
          <div className="att-value">{fmt(standing.attendanceAverage)}</div>
          <div className="att-label">Avg / Game</div>
          {avgRank > 0 && <div className="att-rank">#{avgRank}</div>}
        </div>
        <div className="att-divider" />
        <div className="att-stat">
          <div className="att-value">{fmt(standing.attendanceTotal)}</div>
          <div className="att-label">Season Total</div>
          {totalRank > 0 && <div className="att-rank">#{totalRank}</div>}
        </div>
        {capacityPct != null && <>
          <div className="att-divider" />
          <div className="att-stat">
            <div className="att-value">{capacityPct}%</div>
            <div className="att-label">{fmt(capacity)} Cap.</div>
            {capRank > 0 && <div className="att-rank">#{capRank}</div>}
          </div>
        </>}
      </div>
      {topGames.length > 0 && (
        <div className="att-top-games">
          <div className="att-top-games-header">Top 10 Attended Games</div>
          {topGames.map((g, i) => (
            <div key={g.gameId} className="att-game-row">
              <span className="att-game-rank">{i + 1}</span>
              <span className="att-game-opponent">vs {g.visitingTeam}</span>
              <span className="att-game-date">{g.date}</span>
              <span className="att-game-count">{fmt(g.attendance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
