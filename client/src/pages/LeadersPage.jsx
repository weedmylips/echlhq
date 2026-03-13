import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { useLeaders } from "../hooks/useECHL.js";
import "./LeadersPage.css";

const SKATER_CATS = [
  { key: "goals", label: "Goals", stat: "G" },
  { key: "assists", label: "Assists", stat: "A" },
  { key: "points", label: "Points", stat: "PTS" },
];

const GOALIE_CATS = [
  { key: "gaa", label: "Goals Against Avg", stat: "GAA", lower: true },
  { key: "svPct", label: "Save Percentage", stat: "SV%" },
];

export default function LeadersPage() {
  const { data, isLoading, error } = useLeaders();
  const [tab, setTab] = useState("skaters");
  const [selectedCat, setSelectedCat] = useState("goals");

  const leaders = data?.leaders || {};
  const cats = tab === "skaters" ? SKATER_CATS : GOALIE_CATS;
  const activeCat = cats.find((c) => c.key === selectedCat) || cats[0];
  const rawData = leaders[activeCat.key] || [];
  const sorted = activeCat.lower
    ? [...rawData].sort((a, b) => a.value - b.value)
    : [...rawData].sort((a, b) => b.value - a.value);
  const top10 = sorted.slice(0, 10);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.[0]) {
      const d = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <strong>{d.name}</strong>
          <div>{d.team}</div>
          <div>{activeCat.stat}: {d.value}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="leaders-page">
      <div className="page-header">
        <h1>League Leaders</h1>
        {data?.stale && (
          <div className="stale-banner">⚠ Showing cached data — live data unavailable</div>
        )}
      </div>

      {/* Tab toggle */}
      <div className="tab-bar">
        <button
          className={tab === "skaters" ? "tab active" : "tab"}
          onClick={() => { setTab("skaters"); setSelectedCat("goals"); }}
        >
          Skaters
        </button>
        <button
          className={tab === "goalies" ? "tab active" : "tab"}
          onClick={() => { setTab("goalies"); setSelectedCat("gaa"); }}
        >
          Goalies
        </button>
      </div>

      {isLoading && <div className="loading-spinner">Loading leaders…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <div className="leaders-layout">
          {/* Category selector */}
          <div className="cat-list">
            {cats.map((c) => (
              <button
                key={c.key}
                className={selectedCat === c.key ? "cat-btn active" : "cat-btn"}
                onClick={() => setSelectedCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="leaders-chart card">
            <h2 className="section-title">Top 10 — {activeCat.label}</h2>
            {top10.length === 0 ? (
              <p className="empty-msg">No data available for this category.</p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  layout="vertical"
                  data={top10}
                  margin={{ top: 10, right: 60, left: 140, bottom: 10 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    width={130}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      style={{ fontSize: 12, fontWeight: 700 }}
                    />
                    {top10.map((_, i) => (
                      <Cell key={i} fill={`hsl(${215 - i * 15}, 70%, 50%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="leaders-table card">
            <h2 className="section-title">Full List — {activeCat.label}</h2>
            {top10.length === 0 ? (
              <p className="empty-msg">No data available.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Team</th>
                      <th>{activeCat.stat}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((p, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.team}</td>
                        <td><strong>{p.value}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
