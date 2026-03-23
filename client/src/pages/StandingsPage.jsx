import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useStandings } from "../hooks/useECHL.js";
import ShareButton from "../components/ShareButton.jsx";
import "./StandingsPage.css";

const DIVISION_ORDER = ["North", "South", "Central", "Mountain"];
const PLAYOFF_SPOTS = 4;

const TABLE_COLS = [
  { key: "gp",         label: "GP" },
  { key: "w",          label: "W" },
  { key: "l",          label: "L" },
  { key: "otl",        label: "OT" },
  { key: "pts",        label: "PTS" },
  { key: "magicNum",   label: "M#" },
  { key: "pct",        label: "PCT" },
  { key: "gf",         label: "GF" },
  { key: "ga",         label: "GA" },
  { key: "diff",       label: "DIFF" },
  { key: "homeRecord", label: "HOME" },
  { key: "roadRecord", label: "ROAD" },
  { key: "streak",     label: "STRK" },
];

export default function StandingsPage() {
  const { data, isLoading, error } = useStandings();
  const [sortCol, setSortCol] = useState("pts");
  const [sortDir, setSortDir] = useState("desc");
  const navigate = useNavigate();

  const standings = data?.standings || [];

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function magicNumSortVal(v) {
    if (v === "X") return 0;
    if (v === "E") return 999;
    if (v === "—") return 998;
    return v;
  }

  function sortedTeams(teams) {
    return [...teams].sort((a, b) => {
      let av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      if (sortCol === "magicNum") { av = magicNumSortVal(av); bv = magicNumSortVal(bv); }
      else if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "desc" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  function si(col) {
    if (sortCol !== col) return null;
    return <span className="sort-icon">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  function enrichWithMagicNumber(divisionTeams) {
    const sorted = [...divisionTeams].sort((a, b) => b.pts - a.pts);
    const fifthPlace = sorted[4];
    const fourthPts = sorted[3]?.pts ?? 0;
    const maxFifthPts = fifthPlace
      ? fifthPlace.pts + (fifthPlace.gamesRemaining || 0) * 2
      : 0;
    return divisionTeams.map((team) => {
      const rank = sorted.findIndex((t) => t.teamId === team.teamId) + 1;
      const maxOurPts = team.pts + (team.gamesRemaining || 0) * 2;
      const isClinched = rank <= 4 && (!fifthPlace || team.pts > maxFifthPts);
      const isEliminated = rank > 4 && maxOurPts < fourthPts;
      let magicNum;
      if (isClinched) magicNum = "X";
      else if (isEliminated) magicNum = "E";
      else if (rank <= 4 && fifthPlace) magicNum = Math.max(0, maxFifthPts - team.pts + 1);
      else if (rank > 4 && !isEliminated) magicNum = Math.max(1, fourthPts - team.pts + 1);
      else magicNum = "—";
      return { ...team, magicNum };
    });
  }

  const grouped = standings.reduce((acc, t) => {
    const g = t.division || "Other";
    (acc[g] = acc[g] || []).push(t);
    return acc;
  }, {});

  const groupOrder = DIVISION_ORDER.filter((d) => grouped[d]?.length);

  return (
    <div className="standings-page">
      <Helmet>
        <title>ECHL Standings 2025–26</title>
        <meta name="description" content="Full ECHL standings with playoff picture" />
        <meta property="og:title" content="ECHL Standings 2025–26" />
        <meta property="og:description" content="Full ECHL standings with playoff picture" />
      </Helmet>
      <div className="standings-page-header">
        <h1 className="page-title">Standings</h1>
        <ShareButton title="ECHL Standings" />
      </div>

      {data?.stale && <div className="stale-banner">⚠ Showing cached data — live data temporarily unavailable</div>}

      {isLoading && <div className="loading-spinner">Loading standings…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <div className="standings-groups">
          {groupOrder.map((groupName) => {
            const teams = sortedTeams(enrichWithMagicNumber(grouped[groupName] || []));
            return (
              <div key={groupName} className="standings-group card">
                <div className="group-header">
                  <span className="group-name">
                    {groupName} Division
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
                            className="num-col"
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
                        const isClinched = team.magicNum === "X";
                        const isEliminated = team.magicNum === "E";
                        return (
                          <tr
                            key={team.teamId || i}
                            className={[
                              "team-row",
                              isCutoff ? "playoff-cutoff" : "",
                              isClinched ? "row-clinched" : "",
                              isEliminated ? "row-eliminated" : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() => team.teamId && navigate(`/team/${team.teamId}`)}
                          >
                            <td className="rank-cell">
                              <span className={`rank-num${isPlayoff ? " in-playoffs" : ""}`}>
                                {rank}
                              </span>
                            </td>
                            <td className="team-cell">
                              <div className="team-name-cell">
                                {team.logoUrl && (
                                  <img src={team.logoUrl} alt="" className="row-logo" />
                                )}
                                <span className="team-name-text">
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
                                  c.key === "magicNum" && team[c.key] === "X" ? "pos" : "",
                                  c.key === "magicNum" && team[c.key] === "E" ? "neg" : "",
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
