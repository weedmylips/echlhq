import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useStandings, useGameAttendance } from "../hooks/useECHL.js";
import { TEAMS, getFavoriteTeam } from "../config/teamConfig.js";
import ShareButton from "../components/ShareButton.jsx";
import "./AttendancePage.css";

const fmt = (n) => (n ? Number(n).toLocaleString() : "—");

const CATEGORIES = [
  { key: "avg", label: "Avg Attendance" },
  { key: "total", label: "Total Attendance" },
  { key: "capacity", label: "Capacity %" },
  { key: "sellouts", label: "Sellouts" },
  { key: "topGames", label: "Top Games" },
];

function TeamRow({ team, rank, label, isAlt, isFav, favColor }) {
  const config = Object.values(TEAMS).find(
    (t) => t.city.toLowerCase() === team.teamName?.toLowerCase() || t.name.toLowerCase().includes(team.teamName?.toLowerCase())
  );
  return (
    <li
      className={`att-row${rank === 1 ? " att-row--first" : ""}${isAlt ? " att-row--alt" : ""}${isFav ? " att-row--fav" : ""}`}
      style={isFav && favColor ? { "--fav-color": favColor } : undefined}
    >
      <span className="att-row-rank">{rank}</span>
      {config && <img src={config.logoUrl} alt="" className="att-row-logo" />}
      <span className="att-row-name">{config?.name || team.teamName}</span>
      <span className="att-row-value">{label}</span>
    </li>
  );
}

function SelloutRow({ teamId, count, rank, isAlt, isFav, favColor }) {
  const config = TEAMS[teamId];
  return (
    <li
      className={`att-row${rank === 1 ? " att-row--first" : ""}${isAlt ? " att-row--alt" : ""}${isFav ? " att-row--fav" : ""}`}
      style={isFav && favColor ? { "--fav-color": favColor } : undefined}
    >
      <span className="att-row-rank">{rank}</span>
      {config && <img src={config.logoUrl} alt="" className="att-row-logo" />}
      <span className="att-row-name">{config?.name || `Team ${teamId}`}</span>
      <span className="att-row-value">{count}</span>
    </li>
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

export default function AttendancePage() {
  const { data: standingsData, isLoading: standingsLoading, error: standingsError } = useStandings();
  const { data: gameAttData, isLoading: gameAttLoading, error: gameAttError } = useGameAttendance();
  const [activeCat, setActiveCat] = useState("avg");

  const isLoading = standingsLoading || gameAttLoading;
  const error = standingsError || gameAttError;
  const standings = standingsData?.standings || [];
  const allGames = gameAttData?.games || [];

  const favId = getFavoriteTeam();
  const favTeam = favId ? TEAMS[favId] : null;
  const favColor = favTeam?.primaryColor;

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

  const selloutCounts = {};
  for (const g of allGames) {
    const teamId = g.homeTeamId;
    if (!teamId) continue;
    const cap = TEAMS[teamId]?.arenaCapacity;
    if (cap && g.attendance >= cap) {
      selloutCounts[teamId] = (selloutCounts[teamId] || 0) + 1;
    }
  }
  const sellouts = Object.entries(selloutCounts)
    .map(([id, count]) => ({ teamId: parseInt(id), count }))
    .sort((a, b) => b.count - a.count);

  const topGames = allGames.slice(0, 20);

  function renderPanel() {
    if (activeCat === "avg") return (
      <div className="att-panel">
        <ol className="att-panel-list">
          {byAvg.map((t, i) => (
            <TeamRow key={t.teamId} team={t} rank={i + 1} label={t._label} isAlt={i % 2 !== 0} isFav={t.teamId === favId} favColor={favColor} />
          ))}
        </ol>
      </div>
    );
    if (activeCat === "total") return (
      <div className="att-panel">
        <ol className="att-panel-list">
          {byTotal.map((t, i) => (
            <TeamRow key={t.teamId} team={t} rank={i + 1} label={t._label} isAlt={i % 2 !== 0} isFav={t.teamId === favId} favColor={favColor} />
          ))}
        </ol>
      </div>
    );
    if (activeCat === "capacity") return (
      <div className="att-panel">
        <ol className="att-panel-list">
          {byCapacity.map((t, i) => (
            <TeamRow key={t.teamId} team={t} rank={i + 1} label={t._label} isAlt={i % 2 !== 0} isFav={t.teamId === favId} favColor={favColor} />
          ))}
        </ol>
      </div>
    );
    if (activeCat === "sellouts") return (
      <div className="att-panel">
        <ol className="att-panel-list">
          {sellouts.length === 0
            ? <div className="att-panel-empty">No data</div>
            : sellouts.map((s, i) => (
              <SelloutRow key={s.teamId} teamId={s.teamId} count={s.count} rank={i + 1} isAlt={i % 2 !== 0} isFav={s.teamId === favId} favColor={favColor} />
            ))
          }
        </ol>
      </div>
    );
    if (activeCat === "topGames") return (
      <div className="att-panel att-panel--games">
        <ol className="att-panel-list">
          {topGames.length === 0
            ? <div className="att-panel-empty">No data</div>
            : topGames.map((g, i) => (
              <GameRow key={g.gameId} game={g} rank={i + 1} isAlt={i % 2 !== 0} />
            ))
          }
        </ol>
      </div>
    );
    return null;
  }

  return (
    <div className="attendance-page">
      <Helmet>
        <title>ECHL Attendance 2025–26</title>
        <meta name="description" content="Game-by-game attendance figures" />
        <meta property="og:title" content="ECHL Attendance 2025–26" />
        <meta property="og:description" content="Game-by-game attendance figures" />
      </Helmet>
      <div className="attendance-page-header">
        <h1 className="page-title">Attendance</h1>
        <ShareButton title="ECHL Attendance" />
      </div>

      {isLoading && <div className="loading-spinner">Loading attendance...</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <>
          <div className="att-pill-bar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`att-pill${activeCat === cat.key ? " att-pill--active" : ""}`}
                onClick={() => setActiveCat(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {renderPanel()}
        </>
      )}
    </div>
  );
}
