import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { useLeaders } from "../hooks/useECHL.js";
import "./LeadersPage.css";

const SKATER_ROW1 = [
  { key: "points",    label: "Points",    stat: "PTS" },
  { key: "goals",     label: "Goals",     stat: "G" },
  { key: "assists",   label: "Assists",   stat: "A" },
  { key: "plusMinus", label: "+/-",       stat: "+/-", plusMinus: true },
  { key: "gwg",       label: "GWG",       stat: "GWG" },
];

const SKATER_ROW2 = [
  { key: "ppg",         label: "PP Goals",  stat: "PPG" },
  { key: "ppp",         label: "PP Points", stat: "PPP" },
  { key: "shg",         label: "SH Goals",  stat: "SHG" },
  { key: "shp",         label: "SH Points", stat: "SHP" },
  { key: "shots",       label: "Shots",     stat: "Shots" },
  { key: "shootingPct", label: "Shot%",     stat: "SH%",  isPct: true },
  { key: "pim",         label: "PIM",       stat: "PIM" },
  { key: "soGoals",     label: "SO Goals",  stat: "SOG" },
  { key: "soPct",       label: "SO%",       stat: "SO%",  isPct: true },
];

const ALL_SKATER_CATS = [...SKATER_ROW1, ...SKATER_ROW2];

const GOALIE_CATS = [
  { key: "gaa",      label: "GAA",      stat: "GAA",  lower: true },
  { key: "svPct",    label: "SV%",      stat: "SV%",  isPct: true },
  { key: "shutouts", label: "Shutouts", stat: "SO" },
  { key: "soRecord", label: "SO Save%", stat: "SO%",  isPct: true },
];

const ACCENT_COLORS = [
  "#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe",
  "#6366f1","#818cf8","#a5b4fc","#c7d2fe","#e0e7ff",
];

function fmtLabel(value, cat) {
  if (cat.isPct) {
    return value <= 1
      ? `${(value * 100).toFixed(1)}%`
      : `${typeof value === "number" ? value.toFixed(1) : value}%`;
  }
  if (cat.plusMinus && value > 0) return `+${value}`;
  return value;
}

export default function LeadersPage() {
  const { data, isLoading, error } = useLeaders();
  const [tab, setTab] = useState("skaters");
  const [selectedCat, setSelectedCat] = useState("points");

  const leaders = data?.leaders || {};
  const cats = tab === "skaters" ? ALL_SKATER_CATS : GOALIE_CATS;
  const activeCat = cats.find((c) => c.key === selectedCat) || cats[0];
  const rawData = leaders[activeCat.key] || [];
  const sorted = activeCat.lower
    ? [...rawData].sort((a, b) => a.value - b.value)
    : [...rawData].sort((a, b) => b.value - a.value);
  const top10 = sorted.slice(0, 10);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <div className="ct-name">{d.name}</div>
        <div className="ct-team">{d.team}</div>
        <div className="ct-val">
          {activeCat.stat}: <strong>{fmtLabel(d.value, activeCat)}</strong>
        </div>
      </div>
    );
  };

  const xDomain = activeCat.plusMinus ? ["auto", "auto"] : [0, "auto"];

  return (
    <div className="leaders-page">
      <div className="leaders-header">
        <h1 className="page-title">League Leaders</h1>
        {data?.stale && <div className="stale-banner">⚠ Showing cached data</div>}
      </div>

      <div className="leaders-tab-bar">
        {["skaters", "goalies"].map((t) => (
          <button
            key={t}
            className={`leaders-tab${tab === t ? " active" : ""}`}
            onClick={() => { setTab(t); setSelectedCat(t === "skaters" ? "points" : "gaa"); }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <div className="loading-spinner">Loading leaders…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <div className="leaders-body">
          {/* Category selector */}
          {tab === "skaters" ? (
            <div className="cat-rows">
              <div className="cat-row">
                {SKATER_ROW1.map((c) => (
                  <button
                    key={c.key}
                    className={`cat-btn${selectedCat === c.key ? " active" : ""}`}
                    onClick={() => setSelectedCat(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="cat-row">
                {SKATER_ROW2.map((c) => (
                  <button
                    key={c.key}
                    className={`cat-btn${selectedCat === c.key ? " active" : ""}`}
                    onClick={() => setSelectedCat(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="cat-selector">
              {GOALIE_CATS.map((c) => (
                <button
                  key={c.key}
                  className={`cat-btn${selectedCat === c.key ? " active" : ""}`}
                  onClick={() => setSelectedCat(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div className="leaders-content">
            {/* Chart */}
            <div className="card leaders-chart-card">
              <div className="leaders-chart-header">
                <span className="section-label" style={{ margin: 0 }}>Top 10 — {activeCat.label}</span>
              </div>
              {top10.length === 0 ? (
                <p className="empty-msg" style={{ padding: 16 }}>No data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart
                    layout="vertical"
                    data={top10}
                    margin={{ top: 12, right: 72, left: 150, bottom: 12 }}
                  >
                    <XAxis
                      type="number"
                      domain={xDomain}
                      tick={{ fontSize: 11, fill: "#666" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: 600, fill: "#a0a0a0" }}
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(v) => fmtLabel(v, activeCat)}
                        style={{ fontSize: 12, fontWeight: 700, fill: "#fff" }}
                      />
                      {top10.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            activeCat.plusMinus
                              ? entry.value >= 0 ? "#22c55e" : "#ef4444"
                              : ACCENT_COLORS[i % ACCENT_COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="card leaders-table-card">
              <div className="leaders-chart-header">
                <span className="section-label" style={{ margin: 0 }}>Rankings — {activeCat.label}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Player</th>
                      <th>Team</th>
                      {activeCat.key === "shootingPct" ? (
                        <>
                          <th style={{ textAlign: "right" }}>G</th>
                          <th style={{ textAlign: "right" }}>Shots</th>
                          <th style={{ textAlign: "right" }}>SH%</th>
                        </>
                      ) : activeCat.key === "soPct" ? (
                        <>
                          <th style={{ textAlign: "right" }}>SOG</th>
                          <th style={{ textAlign: "right" }}>SOA</th>
                          <th style={{ textAlign: "right" }}>SO%</th>
                        </>
                      ) : (
                        <th style={{ textAlign: "right" }}>{activeCat.stat}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <span className="leader-rank-num">{i + 1}</span>
                        </td>
                        <td className="bold">{p.name}</td>
                        <td>{p.team}</td>
                        {activeCat.key === "shootingPct" ? (
                          <>
                            <td style={{ textAlign: "right" }}>{p.goals ?? "—"}</td>
                            <td style={{ textAlign: "right" }}>{p.shots ?? "—"}</td>
                            <td style={{ textAlign: "right" }} className="bold">
                              {p.pct != null ? fmtLabel(p.pct, activeCat) : "—"}
                            </td>
                          </>
                        ) : activeCat.key === "soPct" ? (
                          <>
                            <td style={{ textAlign: "right" }}>{p.soGoals ?? "—"}</td>
                            <td style={{ textAlign: "right" }}>{p.soAttempts ?? "—"}</td>
                            <td style={{ textAlign: "right" }} className="bold">
                              {p.pct != null ? fmtLabel(p.pct, activeCat) : "—"}
                            </td>
                          </>
                        ) : (
                          <td
                            style={{ textAlign: "right" }}
                            className={
                              activeCat.plusMinus
                                ? p.value >= 0 ? "plus-value bold" : "minus-value bold"
                                : "bold"
                            }
                          >
                            {activeCat.plusMinus && p.value > 0 ? `+${p.value}` : p.value}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
