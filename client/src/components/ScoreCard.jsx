// ScoreCard replaced by inline ScoreChip in Dashboard.jsx
// Kept as a re-export for any future use
export default function ScoreCard({ game, onClick }) {
  if (!game) return null;
  return (
    <button
      className="score-chip"
      onClick={() => game.gameId && onClick && onClick(game.gameId)}
      disabled={!game.gameId}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{game.date}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{game.visitingTeam}</span>
        <span style={{ fontWeight: 800 }}>{game.score || "vs"}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{game.homeTeam}</span>
      </div>
    </button>
  );
}
