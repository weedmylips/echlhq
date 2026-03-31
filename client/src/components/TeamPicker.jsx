import { useEffect } from "react";
import { TEAMS, DIVISIONS } from "../config/teamConfig.js";
import "./TeamPicker.css";

export default function TeamPicker({ onSelect, onClose, isFirstVisit }) {
  // Close on Escape (only when close is available)
  useEffect(() => {
    if (isFirstVisit) return;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFirstVisit, onClose]);

  return (
    <div
      className="team-picker-overlay"
      onClick={(e) => {
        if (!isFirstVisit && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="team-picker">
        <div className="team-picker-header">
          <h2 className="team-picker-title">Choose Your Team</h2>
          {!isFirstVisit && (
            <button className="team-picker-close" onClick={onClose}>
              &times;
            </button>
          )}
        </div>

        {DIVISIONS.map((div) => (
          <div key={div.name} className="team-picker-division">
            <div className="team-picker-division-label">{div.name}</div>
            <div className="team-picker-grid">
              {div.teams.map((id) => {
                const t = TEAMS[id];
                if (!t) return null;
                return (
                  <button
                    key={id}
                    className="team-picker-team"
                    onClick={() => onSelect(id)}
                  >
                    <img src={t.logoUrl} alt="" className="team-picker-logo" />
                    <span className="team-picker-name">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {isFirstVisit && (
          <button className="team-picker-skip" onClick={() => onSelect(null)}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
