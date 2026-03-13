import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStandings } from "../hooks/useECHL.js";
import "./StandingsPage.css";

const DIVISION_ORDER = ["North", "South", "Central", "Mountain"];
const PLAYOFF_SPOTS = 4;

const TABLE_COLS = [
  { key: "gp",     label: "GP" },
  { key: "w",      label: "W" },
  { key: "l",      label: "L" },
  { key: "otl",    label: "OT" },
  { key: "pts",    label: "PTS" },
  { key: "pct",    label: "PCT",  hideOnSmall: true },
  { key: "gf",     label: "GF",   hideOnSmall: true },
  { key: "ga",     label: "GA",   hideOnSmall: true },
  { key: "diff",   label: "DIFF", hideOnSmall: true },
  { key: "homeRecord", label: "HOME", hideOnMobile: true },
  { key: "roadRecord", label: "ROAD", hideOnMobile: true },
  { key: "streak",     label: "STRK", hideOnMobile: true },
];

export default function StandingsPage() {
  const { data, isLoading, error } = useStandings();
  const [view, setView] = useState("division");
  const [sortCol, setSortCol] = useState("pts");
  const [sortDir, setSortDir] = useState("desc");
  const navigate = useNavigate();

  const standings = data?.standings || [];

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function sortedTeams(teams) {
    return [...teams].sort((a, b) => {
      let av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "desc" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  function si(col) {
    if (sortCol !== col) return null;
    return <span className="sort-icon">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  const grouped = standings.reduce((acc, t) => {
    const g = view === "division" ? (t.division || "Other") : (t.conference || "Other");
    (acc[g] = acc[g] || []).push(t);
    return acc;
  }, {});

  const groupOrder = view === "division"
    ? DIVISION_ORDER.filter((d) => grouped[d]?.length)
    : ["Eastern", "Western"].filter((c) => grouped[c]?.length);

  return (
    <div className="standings-page">
      <div className="standings-page-header">
        <h1 className="page-title">Standings</h1>
        <div className="view-tabs">
          <button
            className={`view-tab${view === "division" ? " active" : ""}`}
            onClick={() => setView("division")}
          >Division</button>
          <button
            className={`view-tab${view === "conference" ? " active" : ""}`}
            onClick={() => setView("conference")}
          >Conference</button>
        </div>
      </div>

      {data?.stale && <div className="stale-banner">⚠ Showing cached data — live data temporarily unavailable</div>}

      {isLoading && <div className="loading-spinner">Loading standings…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <div className="standings-groups">
          {groupOrder.map((groupName) => {
            const teams = sortedTeams(grouped[groupName] || []);
            return (
              <div key={groupName} className="standings-group card">
                <div className="group-header">
                  <span className="group-name">
                    {groupName} {view === "division" ? "Division" : "Conference"}
                  </span>
                  <span className="playoff-legend">
                    <span className="playoff-dot" /> Top {PLAYOFF_SPOTS} advance to playoffs
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="rank-col">#</th>
                        <th className="team-col">Team</th>
                        {TABLE_COLS.map((c) => (
                          <th
                            key={c.key}
                            onClick={() => handleSort(c.key)}
                            className={`num-col${c.hideOnMobile ? " hide-mobile" : ""}${c.hideOnSmall ? " hide-sm" : ""}`}
                          >
                            {c.label}{si(c.key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, i) => {
                        const rank = i + 1;
                        const isPlayoff = rank <= PLAYOFF_SPOTS;
                        const isCutoff = rank === PLAYOFF_SPOTS;
                        return (
                          <tr
                            key={team.teamId || i}
                            className={`team-row${isCutoff ? " playoff-cutoff" : ""}`}
                            onClick={() => team.teamId && navigate(`/team/${team.teamId}`)}
                          >
                            <td className="rank-cell">
                              <span className={`rank-num${isPlayoff ? " in-playoffs" : ""}`}>
                                {rank}
                              </span>
                            </td>
                            <td>
                              <div className="team-name-cell">
                                {team.logoUrl && (
                                  <img src={team.logoUrl} alt="" className="row-logo" />
                                )}
                                <span
                                  className="team-name-text"
                                  style={{ color: team.primaryColor || "#fff" }}
                                >
                                  {team.teamName}
                                </span>
                              </div>
                            </td>
                            {TABLE_COLS.map((c) => (
                              <td
                                key={c.key}
                                className={[
                                  "num",
                                  c.key === "pts" ? "bold" : "",
                                  c.key === "w" ? "bold" : "",
                                  c.key === "diff" && team[c.key] > 0 ? "pos" : "",
                                  c.key === "diff" && team[c.key] < 0 ? "neg" : "",
                                  c.hideOnMobile ? "hide-mobile" : "",
                                  c.hideOnSmall ? "hide-sm" : "",
                                ].filter(Boolean).join(" ")}
                              >
                                {c.key === "diff" && team[c.key] > 0
                                  ? `+${team[c.key]}`
                                  : team[c.key]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
