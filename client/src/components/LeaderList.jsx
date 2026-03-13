import "./LeaderList.css";

export default function LeaderList({ title, data, limit = 5, lower = false }) {
  if (!data || data.length === 0) return null;

  const sorted = lower
    ? [...data].sort((a, b) => a.value - b.value)
    : [...data].sort((a, b) => b.value - a.value);

  const items = sorted.slice(0, limit);
  const max = items[0]?.value || 1;

  return (
    <div className="leader-list">
      <div className="leader-list-title">{title}</div>
      {items.map((player, i) => (
        <div key={i} className="leader-item">
          <div className="leader-rank">{i + 1}</div>
          <div className="leader-info">
            <div className="leader-name">{player.name}</div>
            <div className="leader-team">{player.team}</div>
          </div>
          <div className="leader-bar-wrap">
            <div
              className="leader-bar"
              style={{ width: `${(player.value / max) * 100}%` }}
            />
            <span className="leader-value">{player.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
