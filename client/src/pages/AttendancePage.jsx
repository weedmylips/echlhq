import { useStandings, useTopGames } from "../hooks/useECHL.js";
import { TEAMS } from "../config/teamConfig.js";
import "./AttendancePage.css";

const fmt = (n) => (n ? Number(n).toLocaleString() : "—");

function TeamRow({ team, rank, value, label, isAlt }) {
  const config = Object.values(TEAMS).find(
    (t) => t.city.toLowerCase() === team.teamName?.toLowerCase() || t.name.toLowerCase().includes(team.teamName?.toLowerCase())
  );
  return (
    <li className={`att-row${rank === 1 ? " att-row--first" : ""}${isAlt ? " att-row--alt" : ""}`}>
      <span className="att-row-rank">{rank}</span>
      {config && <img src={config.logoUrl} alt="" className="att-row-logo" />}
      <span className="att-row-name">{config?.name || team.teamName}</span>
      <span className="att-row-value">{label}</span>
    </li>
  );
}

function TeamPanel({ title, teams }) {
  return (
    <div className="att-panel">
      <div className="att-panel-header">{title}</div>
      {teams.length === 0 ? (
        <div className="att-panel-empty">No data</div>
      ) : (
        <ol className="att-panel-list">
          {teams.map((t, i) => (
            <TeamRow key={t.teamId} team={t} rank={i + 1} value={t._value} label={t._label} isAlt={i % 2 !== 0} />
          ))}
        </ol>
      )}
    </div>
  );
}

function GameRow({ game, rank, isAlt }) {
  const homeConfig = Object.values(TEAMS).find(
    (t) => t.city.toLowerCase() === game.homeTeam?.toLowerCase() || t.name.toLowerCase().includes(game.homeTeam?.toLowerCase())
  );
  const visConfig = Object.values(TEAMS).find(
    (t) => t.city.toLowerCase() === game.visitingTeam?.toLowerCase() || t.name.toLowerCase().includes(game.visitingTeam?.toLowerCase())
  );
  return (
    <li className={`att-row${rank === 1 ? " att-row--first" : ""}${isAlt ? " att-row--alt" : ""}`}>
      <span className="att-row-rank">{rank}</span>
      <span className="att-row-matchup">
        {visConfig && <img src={visConfig.logoUrl} alt="" className="att-row-logo" />}
        <span className="att-row-team-abbr">{visConfig?.abbr || game.visitingTeam}</span>
        <span className="att-row-at">@</span>
        {homeConfig && <img src={homeConfig.logoUrl} alt="" className="att-row-logo" />}
        <span className="att-row-team-abbr">{homeConfig?.abbr || game.homeTeam}</span>
      </span>
      <span className="att-row-date">{game.date}</span>
      <span className="att-row-value">{fmt(game.attendance)}</span>
    </li>
  );
}

function GamesPanel({ title, games }) {
  return (
    <div className="att-panel att-panel--games">
      <div className="att-panel-header">{title}</div>
      {games.length === 0 ? (
        <div className="att-panel-empty">No data</div>
      ) : (
        <ol className="att-panel-list">
          {games.map((g, i) => (
            <GameRow key={g.gameId} game={g} rank={i + 1} isAlt={i % 2 !== 0} />
          ))}
        </ol>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const { data: standingsData, isLoading: standingsLoading, error: standingsError } = useStandings();
  const { data: topGamesData, isLoading: gamesLoading, error: gamesError } = useTopGames();

  const isLoading = standingsLoading || gamesLoading;
  const error = standingsError || gamesError;
  const standings = standingsData?.standings || [];
  const topGames = topGamesData?.topGames || [];

  const teamsWithAtt = standings.filter((t) => t.attendanceAverage > 0);

  const byAvg = [...teamsWithAtt]
    .sort((a, b) => b.attendanceAverage - a.attendanceAverage)
    .map((t) => ({ ...t, _label: fmt(t.attendanceAverage) }));

  const byTotal = [...teamsWithAtt]
    .sort((a, b) => b.attendanceTotal - a.attendanceTotal)
    .map((t) => ({ ...t, _label: fmt(t.attendanceTotal) }));

  const byCapacity = [...teamsWithAtt]
    .map((t) => {
      const cap = TEAMS[t.teamId]?.arenaCapacity;
      const pct = cap ? Math.round((t.attendanceAverage / cap) * 100) : 0;
      return { ...t, _pct: pct, _label: pct > 0 ? `${pct}%` : "—" };
    })
    .sort((a, b) => b._pct - a._pct);

  return (
    <div className="attendance-page">
      <div className="attendance-page-header">
        <h1 className="page-title">Attendance</h1>
      </div>

      {isLoading && <div className="loading-spinner">Loading attendance...</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <div className="attendance-grid">
          <TeamPanel title="AVG ATTENDANCE" teams={byAvg} />
          <TeamPanel title="TOTAL ATTENDANCE" teams={byTotal} />
          <TeamPanel title="CAPACITY %" teams={byCapacity} />
          <GamesPanel title="TOP ATTENDED GAMES" games={topGames} />
        </div>
      )}
    </div>
  );
}
