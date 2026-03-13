import "./ScoreCard.css";

export default function ScoreCard({ game, onClick }) {
  if (!game) return null;
  const { homeTeam, visitingTeam, score, date, gameId } = game;

  return (
    <button
      className="score-card"
      onClick={() => gameId && onClick && onClick(gameId)}
      disabled={!gameId}
      title={gameId ? "Click to view box score" : "Box score unavailable"}
    >
      <div className="score-card-date">{date || "—"}</div>
      <div className="score-card-matchup">
        <span className="score-card-team">{visitingTeam || "—"}</span>
        <span className="score-card-score">{score || "vs"}</span>
        <span className="score-card-team">{homeTeam || "—"}</span>
      </div>
      {gameId && <div className="score-card-link">View Box Score →</div>}
    </button>
  );
}
