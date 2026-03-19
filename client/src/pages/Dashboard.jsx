import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useScores, useUpcoming, useLeaders } from "../hooks/useECHL.js";
import { TEAMS, findTeamByName } from "../config/teamConfig.js";
import BoxScoreModal from "../components/BoxScoreModal.jsx";
import MatchupModal from "../components/MatchupModal.jsx";
import "./Dashboard.css";

export default function Dashboard() {
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const stripRef = useRef(null);
  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * 600, behavior: "smooth" });

  const { data: scoresData, isLoading: scoresLoading } = useScores();
  const { data: upcomingData, isLoading: upcomingLoading } = useUpcoming();
  const { data: leadersData, isLoading: leadersLoading } = useLeaders();

  const scores = scoresData?.scores || [];
  const upcomingGames = upcomingData?.games || [];
  const leaders = leadersData?.leaders || {};

  // Group upcoming games by day+date
  const byDay = upcomingGames.reduce((acc, g) => {
    const key = `${g.dayLabel}|${g.date}`;
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {});
  const dayOrder = [...new Set(upcomingGames.map((g) => `${g.dayLabel}|${g.date}`))];

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
        <div className="section-label">Recent Scores</div>
        {scoresLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : scores.length === 0 ? (
          <p className="empty-msg">No recent scores.</p>
        ) : (
          <div className="scores-strip-wrap">
            <button className="scroll-btn scroll-btn-left" onClick={() => scroll(-1)}>&#8249;</button>
            <div className="scores-strip" ref={stripRef}>
              {scores.map((g, i) => (
                <ScoreChip key={i} game={g} onClick={() => g.gameId && setSelectedGameId(g.gameId)} />
              ))}
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
          ) : upcomingGames.length === 0 ? (
            <div className="card">
              <div className="upcoming-header">
                <div className="section-label" style={{ margin: 0 }}>Upcoming Games</div>
              </div>
              <p className="empty-msg" style={{ padding: '24px 16px', textAlign: 'center' }}>
                No upcoming games scheduled.
              </p>
            </div>
          ) : (
            dayOrder.map((dayKey, index) => {
              const [dayLabel, dayDate] = dayKey.split("|");
              return (
                <div key={dayKey} className="upcoming-day card">
                  {index === 0 ? (
                    <div className="upcoming-header">
                      <div className="section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Upcoming Games <span className="upcoming-header-sep">&bull;</span> <span className="upcoming-header-date">{dayLabel} {dayDate}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="upcoming-day-header">
                      {dayLabel} <span className="upcoming-day-date">{dayDate}</span>
                    </div>
                  )}
                  <div className="upcoming-day-games">
                    {(byDay[dayKey] || []).map((g, i) => {
                      const visitingConfig = TEAMS[g.visitingTeamId];
                      const homeConfig = TEAMS[g.homeTeamId];
                      return (
                        <button
                          key={i}
                          className="upcoming-game-row"
                          onClick={() => g.visitingTeamId && g.homeTeamId && setSelectedMatchup(g)}
                        >
                          <div className="upcoming-team upcoming-away">
                            {visitingConfig?.logoUrl && (
                              <img src={visitingConfig.logoUrl} alt="" className="upcoming-logo" />
                            )}
                            <span className="upcoming-name">{g.visitingTeam}</span>
                          </div>
                          <div className="upcoming-center">
                            <span className="upcoming-at">@</span>
                            <span className="upcoming-time">{g.time}</span>
                          </div>
                          <div className="upcoming-team upcoming-home">
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
            })
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
    </div>
  );
}

function ScoreChip({ game, onClick }) {
  const awayTeam = findTeamByName(game.visitingTeam);
  const homeTeam = findTeamByName(game.homeTeam);

  return (
    <button className="score-chip" onClick={onClick} disabled={!game.gameId}>
      <div className="chip-content">
        <div className="chip-team chip-away">
          {awayTeam?.logoUrl ? (
            <img src={awayTeam.logoUrl} alt="" className="chip-logo" />
          ) : (
            <div className="chip-logo-placeholder">{game.visitingTeam[0]}</div>
          )}
          <div className="chip-score-box">
             <span className="chip-score">{game.visitingScore}</span>
             <span className="chip-abbr">{awayTeam?.abbr || game.visitingTeam}</span>
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
             <span className="chip-score">{game.homeScore}</span>
             <span className="chip-abbr">{homeTeam?.abbr || game.homeTeam}</span>
          </div>
        </div>
      </div>
      <div className="chip-status">
        Final{game.overtime ? ` (${game.overtime})` : ""}
      </div>
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
