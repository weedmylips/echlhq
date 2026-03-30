import React, { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useScores, useUpcoming, useLeaders, useScorebar } from "../hooks/useECHL.js";
import { TEAMS, findTeamByName } from "../config/teamConfig.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import MatchupModal from "../components/MatchupModal.jsx";
import "./Dashboard.css";

export default function Dashboard() {
  const { gameId, visitingTeamId, homeTeamId, date } = useParams();
  const navigate = useNavigate();

  const selectedGameId = gameId || null;
  const selectedMatchup = (visitingTeamId && homeTeamId && date)
    ? { visitingTeamId: Number(visitingTeamId), homeTeamId: Number(homeTeamId), date: decodeURIComponent(date) }
    : null;

  const stripRef = useRef(null);
  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  const [showAllDays, setShowAllDays] = useState(false);

  const { data: scoresData, isLoading: scoresLoading } = useScores();
  const { data: upcomingData, isLoading: upcomingLoading } = useUpcoming();
  const { data: leadersData, isLoading: leadersLoading } = useLeaders();

  const scores = scoresData?.scores || [];
  const upcomingGames = upcomingData?.games || [];
  const leaders = leadersData?.leaders || {};

  const { data: scorebarData } = useScorebar();
  const scorebarGames = scorebarData?.games || [];

  // Merge: live games first, then pre-game, then recent finals
  // De-dupe: if a scorebar game has the same gameId as a score, prefer scorebar (fresher)
  const scorebarIds = new Set(scorebarGames.map((g) => g.gameId));
  const recentScores = scores
    .filter((g) => !scorebarIds.has(g.gameId))
    .slice(0, 30);
  const scorebarFinals = scorebarGames
    .filter((g) => getGameType(g) === "final")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  // Only show today's pregame games in the scores strip — future days are in Upcoming
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPregames = scorebarGames.filter(
    (g) => getGameType(g) === "pregame" && normalizeDate(g.date) === todayStr
  );
  const mergedGames = [
    ...scorebarGames.filter((g) => getGameType(g) === "live"),
    ...todayPregames,
    ...scorebarFinals,
    ...recentScores,
  ];

  // Build scorebar lookup for live/final game data overlay
  const scorebarByKey = {};
  for (const sg of scorebarGames) {
    scorebarByKey[`${sg.visitingTeamId}-${sg.homeTeamId}-${normalizeDate(sg.date)}`] = sg;
  }
  const filteredUpcoming = upcomingGames;

  // Group upcoming games by day+date
  const byDay = filteredUpcoming.reduce((acc, g) => {
    const key = `${g.dayLabel}|${g.date}`;
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {});
  const dayOrder = [...new Set(filteredUpcoming.map((g) => `${g.dayLabel}|${g.date}`))];
  const DEFAULT_DAYS = 2;
  const visibleDays = showAllDays ? dayOrder : dayOrder.slice(0, DEFAULT_DAYS);
  const hiddenDayCount = dayOrder.length - DEFAULT_DAYS;

  return (
    <div className="dashboard">
      <Helmet>
        <title>ECHL Stats — Dashboard</title>
        <meta name="description" content="Scores, upcoming games, and league leaders" />
        <meta property="og:title" content="ECHL Stats — Dashboard" />
        <meta property="og:description" content="Scores, upcoming games, and league leaders" />
      </Helmet>
      {/* ── Scores Strip ── */}
      <section className="scores-section">
        <div className="section-label">Scores</div>
        {scoresLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : mergedGames.length === 0 ? (
          <p className="empty-msg">No recent scores.</p>
        ) : (
          <div className="scores-strip-wrap">
            <button className="scroll-btn scroll-btn-left" onClick={() => scroll(-1)}>&#8249;</button>
            <div className="scores-strip" ref={stripRef}>
              {mergedGames.map((g, i) => {
                const dateKey = normalizeDate(g.date);
                const prevDateKey = i > 0 ? normalizeDate(mergedGames[i - 1].date) : null;
                const showSep = i === 0 || dateKey !== prevDateKey;
                return (
                  <React.Fragment key={g.gameId || i}>
                    {showSep && <div className="scores-date-sep">{formatDateLabel(g.date)}</div>}
                    <ScoreChip game={g} onClick={() => {
                      if (getGameType(g) === "pregame" && g.visitingTeamId && g.homeTeamId) {
                        const displayDate = formatUpcomingDate(g.date);
                        navigate(`/matchup/${g.visitingTeamId}/${g.homeTeamId}/${encodeURIComponent(displayDate)}`);
                      } else if (g.gameId) {
                        navigate(`/game/${g.gameId}`);
                      }
                    }} />
                  </React.Fragment>
                );
              })}
            </div>
            <button className="scroll-btn scroll-btn-right" onClick={() => scroll(1)}>&#8250;</button>
          </div>
        )}
      </section>

      <div className="dashboard-body">
        {/* ── Upcoming Games ── */}
        <section className="upcoming-section">
          {upcomingLoading ? (
            <div className="loading-spinner">Loading...</div>
          ) : filteredUpcoming.length === 0 ? (
            <div className="card">
              <div className="upcoming-header">
                <div className="section-label" style={{ margin: 0 }}>Upcoming Games</div>
              </div>
              <p className="empty-msg" style={{ padding: '24px 16px', textAlign: 'center' }}>
                No upcoming games scheduled.
              </p>
            </div>
          ) : (
            <>
              {visibleDays.map((dayKey, index) => {
                const [dayLabel, dayDate] = dayKey.split("|");
                const isToday = isDateToday(dayDate);
                const displayLabel = isToday ? "Today" : dayLabel;
                return (
                  <div key={dayKey} className={`upcoming-day card${isToday ? " upcoming-day-today" : ""}`}>
                    {index === 0 ? (
                      <div className="upcoming-header">
                        <div className="section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isToday ? "Today's Games" : "Upcoming Games"} <span className="upcoming-header-sep">&bull;</span> <span className="upcoming-header-date">{displayLabel} {dayDate}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="upcoming-day-header">
                        {displayLabel} <span className="upcoming-day-date">{dayDate}</span>
                      </div>
                    )}
                    <div className="upcoming-day-games">
                      {(byDay[dayKey] || []).map((g, i) => {
                        const visitingConfig = TEAMS[g.visitingTeamId];
                        const homeConfig = TEAMS[g.homeTeamId];
                        const sg = scorebarByKey[`${g.visitingTeamId}-${g.homeTeamId}-${normalizeDate(g.date)}`];
                        const gameType = sg ? getGameType(sg) : null;
                        const isLive = gameType === "live";
                        const isFinal = gameType === "final";
                        const hasScore = isLive || isFinal;
                        return (
                          <button
                            key={i}
                            className={`upcoming-game-row${isLive ? " upcoming-game-live" : ""}${isFinal ? " upcoming-game-final" : ""}`}
                            onClick={() => {
                              if ((isLive || isFinal) && sg.gameId) {
                                navigate(`/game/${sg.gameId}`);
                              } else if (g.visitingTeamId && g.homeTeamId) {
                                navigate(`/matchup/${g.visitingTeamId}/${g.homeTeamId}/${encodeURIComponent(g.date)}`);
                              }
                            }}
                          >
                            <div className="upcoming-team upcoming-away">
                              {visitingConfig?.logoUrl && (
                                <img src={visitingConfig.logoUrl} alt="" className="upcoming-logo" />
                              )}
                              <span className="upcoming-name">{g.visitingTeam}</span>
                              {hasScore && <span className="upcoming-live-score">{sg.visitingGoals}</span>}
                            </div>
                            <div className="upcoming-center">
                              {isLive ? (
                                <>
                                  <span className="live-badge">LIVE</span>
                                  <span className="upcoming-live-period">
                                    {sg.intermission ? `${sg.period} INT` : `${sg.period} · ${sg.clock}`}
                                  </span>
                                </>
                              ) : isFinal ? (
                                <span className="upcoming-final-label">Final</span>
                              ) : (
                                <>
                                  <span className="upcoming-at">@</span>
                                  <span className="upcoming-time">{g.time}</span>
                                </>
                              )}
                            </div>
                            <div className="upcoming-team upcoming-home">
                              {hasScore && <span className="upcoming-live-score">{sg.homeGoals}</span>}
                              <span className="upcoming-name">{g.homeTeam}</span>
                              {homeConfig?.logoUrl && (
                                <img src={homeConfig.logoUrl} alt="" className="upcoming-logo" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {hiddenDayCount > 0 && (
                <button
                  className="upcoming-show-more"
                  onClick={() => setShowAllDays((prev) => !prev)}
                >
                  {showAllDays
                    ? "Show Less"
                    : `Show ${hiddenDayCount} More Day${hiddenDayCount === 1 ? "" : "s"}`}
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Leaders Sidebar ── */}
        <aside className="leaders-sidebar">
          <div className="card leaders-card">
            <div className="leaders-card-header">
              <span className="section-label" style={{ margin: 0 }}>League Leaders</span>
              <a href="/leaders" className="see-all-link">All &rarr;</a>
            </div>

            {leadersLoading ? (
              <div className="loading-spinner" style={{ padding: 24 }}>Loading...</div>
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
        <BoxScoreModal gameId={selectedGameId} onClose={() => navigate("/")} />
      )}
      {selectedMatchup && (() => {
        const upcomingGame = upcomingGames.find(
          (g) => g.visitingTeamId === selectedMatchup.visitingTeamId
            && g.homeTeamId === selectedMatchup.homeTeamId
            && g.date === selectedMatchup.date
        );
        return (
          <MatchupModal
            visitingTeamId={selectedMatchup.visitingTeamId}
            homeTeamId={selectedMatchup.homeTeamId}
            date={selectedMatchup.date}
            time={upcomingGame?.time || ""}
            onClose={() => navigate("/")}
          />
        );
      })()}
    </div>
  );
}

/** Check if a date string like "Mar 29, 2026" is today. */
function isDateToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Convert "2026-03-29" to "Mar 29, 2026" to match upcoming game date format. */
function formatUpcomingDate(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(/^\d{4}-/.test(dateStr) ? dateStr + "T12:00:00" : dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Normalize both "2026-03-28" and "Mar 28, 2026" to a comparable YYYY-MM-DD string. */
function normalizeDate(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toISOString().slice(0, 10);
}

/** Format a date string as a short label like "Fri Mar 28". */
function formatDateLabel(dateStr) {
  const d = new Date(/^\d{4}-/.test(dateStr) ? dateStr + "T12:00:00" : dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getGameType(game) {
  const isFinal = /Final/i.test(game.status) ||
    (game.clock === "00:00" && /^(3rd|OT|SO)/.test(game.period));
  const isPregame = (game.clock === "00:00" || game.clock === "20:00") && game.period === "1st" && !/Final/i.test(game.status);
  if (isFinal) return "final";
  if (isPregame || !game.period) return "pregame";
  return "live";
}

function formatLiveStatus(game) {
  if (game.intermission) {
    return `${game.period} INT`;
  }
  if (game.clock) {
    return `${game.period} · ${game.clock}`;
  }
  return game.period;
}

function ScoreChip({ game, onClick }) {
  const awayTeam = findTeamByName(game.visitingTeam);
  const homeTeam = findTeamByName(game.homeTeam);
  const gameType = getGameType(game);
  const isLive = gameType === "live";
  const isPregame = gameType === "pregame";

  // Scorebar uses visitingGoals/homeGoals; scores use visitingScore/homeScore
  const awayScore = game.visitingScore ?? game.visitingGoals;
  const homeScore = game.homeScore ?? game.homeGoals;

  return (
    <button
      className={`score-chip${isLive ? " chip-live" : ""}`}
      onClick={onClick}
      disabled={!game.gameId}
    >
      <div className="chip-content">
        <div className="chip-team chip-away">
          {awayTeam?.logoUrl ? (
            <img src={awayTeam.logoUrl} alt="" className="chip-logo" />
          ) : (
            <div className="chip-logo-placeholder">{game.visitingTeam[0]}</div>
          )}
          <div className="chip-score-box">
            <span className="chip-score">
              {isPregame ? "–" : awayScore}
            </span>
            <span className="chip-abbr">
              {awayTeam?.abbr || game.visitingCode || game.visitingTeam}
            </span>
          </div>
        </div>

        <div className="chip-vs">vs</div>

        <div className="chip-team chip-home">
          {homeTeam?.logoUrl ? (
            <img src={homeTeam.logoUrl} alt="" className="chip-logo" />
          ) : (
            <div className="chip-logo-placeholder">{game.homeTeam[0]}</div>
          )}
          <div className="chip-score-box">
            <span className="chip-score">
              {isPregame ? "–" : homeScore}
            </span>
            <span className="chip-abbr">
              {homeTeam?.abbr || game.homeCode || game.homeTeam}
            </span>
          </div>
        </div>
      </div>

      {isLive ? (
        <div className="chip-status chip-status-live">
          <span className="live-badge">LIVE</span>
          <span className="chip-period">{formatLiveStatus(game)}</span>
        </div>
      ) : isPregame ? (
        <div className="chip-status">
          <span className="chip-pregame-time">
            {game.gameTime || game.time || "TBD"}{game.timezone ? ` ${game.timezone}` : ""}
          </span>
        </div>
      ) : (
        <div className="chip-status">
          Final{game.overtime ? ` (${game.overtime})` : ""}
        </div>
      )}
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
          <span className="leader-mini-val">{title === "SV%" ? p.value.toFixed(3).replace(/^0/, "") : p.value}</span>
        </div>
      ))}
    </div>
  );
}
