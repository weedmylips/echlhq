import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useStandings } from "../hooks/useECHL.js";
import "./StandingsPage.css";

const COLS = [
  { key: "teamName", label: "Team", sortable: true },
  { key: "gp", label: "GP", sortable: true },
  { key: "w", label: "W", sortable: true },
  { key: "l", label: "L", sortable: true },
  { key: "otl", label: "OTL", sortable: true },
  { key: "sol", label: "SOL", sortable: true },
  { key: "pts", label: "PTS", sortable: true },
  { key: "pct", label: "PCT", sortable: true },
  { key: "gf", label: "GF", sortable: true },
  { key: "ga", label: "GA", sortable: true },
  { key: "diff", label: "DIFF", sortable: true },
  { key: "home", label: "Home", sortable: false },
  { key: "away", label: "Away", sortable: false },
  { key: "streak", label: "Streak", sortable: false },
];

const PLAYOFF_SPOTS = { North: 2, South: 2, Central: 2, Mountain: 2 };

export default function StandingsPage() {
  const { data, isLoading, error } = useStandings();
  const [view, setView] = useState("division"); // division | conference
  const [sort, setSort] = useState({ col: "pts", dir: "desc" });
  const navigate = useNavigate();

  const standings = data?.standings || [];

  function handleSort(col) {
    setSort((s) =>
      s.col === col ? { col, dir: s.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }
    );
  }

  function sortedTeams(teams) {
    return [...teams].sort((a, b) => {
      let av = a[sort.col] ?? 0;
      let bv = b[sort.col] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sort.dir === "desc" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  function sortIcon(col) {
    if (sort.col !== col) return "";
    return sort.dir === "desc" ? " ↓" : " ↑";
  }

  const grouped =
    view === "division"
      ? standings.reduce((acc, t) => {
          const g = t.division || "Other";
          (acc[g] = acc[g] || []).push(t);
          return acc;
        }, {})
      : standings.reduce((acc, t) => {
          const g = t.conference || "Other";
          (acc[g] = acc[g] || []).push(t);
          return acc;
        }, {});

  const groupOrder =
    view === "division"
      ? ["North", "South", "Central", "Mountain", "Other"]
      : ["Eastern", "Western", "Other"];

  const groups = groupOrder.filter((g) => grouped[g]?.length);

  // Playoff bubble highlight: within 4 pts of a playoff spot
  function isPlayoffBubble(team, groupTeams) {
    const divisionName = team.division;
    const spots = PLAYOFF_SPOTS[divisionName] || 2;
    const sorted = [...groupTeams].sort((a, b) => b.pts - a.pts);
    const cutoffTeam = sorted[spots - 1];
    if (!cutoffTeam) return false;
    const cutoffPts = cutoffTeam.pts;
    return team.pts < cutoffPts && cutoffPts - team.pts <= 4;
  }

  function isPlayoffTeam(team, groupTeams) {
    const spots = PLAYOFF_SPOTS[team.division] || 2;
    const sorted = [...groupTeams].sort((a, b) => b.pts - a.pts);
    return sorted.slice(0, spots).some((t) => t.teamId === team.teamId);
  }

  // Chart data: sorted by diff
  const chartData = [...standings]
    .sort((a, b) => b.diff - a.diff)
    .map((t) => ({
      name: t.teamName?.split(" ").pop() || t.teamName,
      diff: t.diff,
      color: t.primaryColor || "#555",
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.[0]) {
      return (
        <div className="chart-tooltip">
          <strong>{payload[0].payload.name}</strong>
          <div>Goal Diff: {payload[0].value > 0 ? `+${payload[0].value}` : payload[0].value}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="standings-page">
      <div className="page-header">
        <h1>Standings</h1>
        {data?.stale && (
          <div className="stale-banner">⚠ Showing cached data — live data unavailable</div>
        )}
        <div className="view-toggle">
          <button
            className={view === "division" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setView("division")}
          >
            Division
          </button>
          <button
            className={view === "conference" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setView("conference")}
          >
            Conference
          </button>
        </div>
      </div>

      {isLoading && <div className="loading-spinner">Loading standings…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <>
          {/* Standings Tables */}
          {groups.map((groupName) => {
            const groupTeams = sortedTeams(grouped[groupName]);
            return (
              <section key={groupName} className="standings-group card">
                <h2 className="group-title">{groupName} {view === "division" ? "Division" : "Conference"}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 24 }}></th>
                        {COLS.map((c) => (
                          <th
                            key={c.key}
                            onClick={c.sortable ? () => handleSort(c.key) : undefined}
                            style={{ cursor: c.sortable ? "pointer" : "default" }}
                          >
                            {c.label}{c.sortable ? sortIcon(c.key) : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupTeams.map((team, i) => {
                        const playoff = isPlayoffTeam(team, grouped[groupName]);
                        const bubble = isPlayoffBubble(team, grouped[groupName]);
                        return (
                          <tr
                            key={team.teamId || i}
                            className={`team-row ${playoff ? "playoff" : ""} ${bubble ? "bubble" : ""}`}
                            onClick={() => team.teamId && navigate(`/team/${team.teamId}`)}
                          >
                            <td>
                              <div className="playoff-indicator">
                                {playoff && <span title="Playoff position" className="dot dot-green" />}
                                {bubble && <span title="Playoff bubble (within 4 pts)" className="dot dot-yellow" />}
                              </div>
                            </td>
                            {COLS.map((c) => (
                              <td key={c.key} className={c.key === "diff" && team[c.key] > 0 ? "pos" : c.key === "diff" && team[c.key] < 0 ? "neg" : ""}>
                                {c.key === "teamName" ? (
                                  <div className="team-cell">
                                    {team.logoUrl && <img src={team.logoUrl} alt="" className="team-logo-sm" />}
                                    <span style={{ color: team.primaryColor, fontWeight: 700 }}>
                                      {team.teamName}
                                    </span>
                                  </div>
                                ) : c.key === "diff" ? (
                                  team[c.key] > 0 ? `+${team[c.key]}` : team[c.key]
                                ) : c.key === "pts" ? (
                                  <strong>{team[c.key]}</strong>
                                ) : (
                                  team[c.key]
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="playoff-legend">
                  <span><span className="dot dot-green" /> In playoff position</span>
                  <span><span className="dot dot-yellow" /> Playoff bubble (≤4 pts back)</span>
                </div>
              </section>
            );
          })}

          {/* Goal Differential Chart */}
          {chartData.length > 0 && (
            <section className="card diff-chart-section">
              <h2 className="section-title">Goal Differential by Team</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="diff" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.diff >= 0 ? entry.color : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}
    </div>
  );
}
