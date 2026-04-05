import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLeaders, useFightingMajors } from "../hooks/useECHL.js";
import ShareButton from "../components/ShareButton.jsx";
import PlayerModal from "../components/PlayerModal.jsx";
import { TEAMS, getFavoriteTeam } from "../config/teamConfig.js";
import "./LeadersPage.css";

const SKATER_CARDS = [
  // Row 1
  { key: "points",      label: "POINTS",           stat: "PTS"  },
  { key: "goals",       label: "GOALS",             stat: "G"    },
  { key: "assists",     label: "ASSISTS",            stat: "A"    },
  // Row 2
  { key: "plusMinus",   label: "+/-",               stat: "+/-", plusMinus: true },
  { key: "gwg",         label: "GWG",               stat: "GWG"  },
  { key: "shots",       label: "SHOTS",              stat: "SOG"  },
  // Row 3
  { key: "shootingPct", label: "SHOOTING %",         stat: "SH%", isPct: true, note: "min 50 shots" },
  { key: "ppg",         label: "PP GOALS",           stat: "PPG"  },
  { key: "ppp",         label: "PP POINTS",          stat: "PPP"  },
  // Row 4
  { key: "shg",         label: "SH GOALS",           stat: "SHG"  },
  { key: "shp",         label: "SH POINTS",          stat: "SHP"  },
  { key: "pim",         label: "PIM",                stat: "PIM"  },
  // Row 5
  { key: "minors",      label: "MINOR PENALTIES",    stat: "MIN"  },
  { key: "majors",      label: "MAJOR PENALTIES",    stat: "MAJ"  },
  { key: "soGoals",     label: "SO GOALS",           stat: "SOG"  },
  // Row 6
  { key: "soPct",       label: "SO %",               stat: "SO%", isPct: true, note: "min 3 attempts" },
  { key: "ppa",         label: "PP ASSISTS",         stat: "PPA"  },
  { key: "sha",         label: "SH ASSISTS",         stat: "SHA"  },
];

const GOALIE_CARDS = [
  { key: "gaa",        label: "GAA",        stat: "GAA", lower: true, note: "min 10 GP" },
  { key: "svPct",      label: "SV %",       stat: "SV%", isGoaliePct: true, note: "min 10 GP" },
  { key: "shutouts",   label: "SHUTOUTS",   stat: "SO"   },
  { key: "goalieWins", label: "WINS",       stat: "W"    },
  { key: "soRecord",   label: "SO SAVE %",  stat: "SO%", isGoaliePct: true, note: "min 3 attempts" },
];


function fmtVal(value, cat) {
  if (value == null) return "—";
  if (cat.isGoaliePct) {
    const v = parseFloat(value);
    return isNaN(v) ? "—" : v.toFixed(3).replace(/^0/, "");
  }
  if (cat.isPct) {
    const v = parseFloat(value);
    return isNaN(v) ? "—" : (v <= 1 ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}%`);
  }
  if (cat.plusMinus && value > 0) return `+${value}`;
  return value;
}

function StatCard({ cat, leaders, favAbbr, favColor, onPlayerClick }) {
  const rawData = leaders[cat.key] || [];
  const sorted = cat.lower
    ? [...rawData].sort((a, b) => a.value - b.value)
    : [...rawData].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 10);

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        {cat.label}
        {cat.note && <span className="stat-card-note">{cat.note}</span>}
      </div>
      {top.length === 0 ? (
        <div className="stat-card-empty">No data</div>
      ) : (
        <ol className="stat-card-list">
          {top.map((p, i) => (
            <li
              key={i}
              className={`stat-row${i === 0 ? " stat-row--first" : ""}${i % 2 !== 0 ? " stat-row--alt" : ""}${favAbbr && p.team === favAbbr ? " stat-row--fav" : ""}`}
              style={favAbbr && p.team === favAbbr && favColor ? { "--fav-color": favColor } : undefined}
            >
              <span className="stat-rank">{i + 1}</span>
              <span className="stat-name">
                <span
                  className={p.playerId ? "player-link" : ""}
                  onClick={() => p.playerId && onPlayerClick?.({ playerId: p.playerId, playerName: p.name })}
                >
                  {p.name}
                </span>
                {p.isRookie && <span className="stat-rookie">R</span>}
                {p.isActive === false && <span className="stat-ahl">↑AHL</span>}
                {p.position && <span className="stat-position">{p.position}</span>}
              </span>
              <span className="stat-team">{p.team}</span>
              <span
                className={`stat-val${cat.plusMinus ? (p.value >= 0 ? " plus" : " minus") : ""}`}
              >
                {fmtVal(p.value, cat)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const cityToAbbr = {};
Object.values(TEAMS).forEach((t) => { cityToAbbr[t.city.toLowerCase()] = t.abbr; });

function FightingMajorsCard({ data, favAbbr, favColor, onPlayerClick }) {
  const top = (data?.leaders || []).slice(0, 10);
  return (
    <div className="stat-card">
      <div className="stat-card-header">FIGHTING MAJORS</div>
      {top.length === 0 ? (
        <div className="stat-card-empty">No data</div>
      ) : (
        <ol className="stat-card-list">
          {top.map((p, i) => {
            const abbr = cityToAbbr[p.team.toLowerCase()] || p.team;
            return (
            <li
              key={i}
              className={`stat-row${i === 0 ? " stat-row--first" : ""}${i % 2 !== 0 ? " stat-row--alt" : ""}${favAbbr && abbr === favAbbr ? " stat-row--fav" : ""}`}
              style={favAbbr && abbr === favAbbr && favColor ? { "--fav-color": favColor } : undefined}
            >
              <span className="stat-rank">{i + 1}</span>
              <span className="stat-name">
                <span
                  className={p.playerId ? "player-link" : ""}
                  onClick={() => p.playerId && onPlayerClick?.({ playerId: p.playerId, playerName: p.name })}
                >
                  {p.name}
                </span>
              </span>
              <span className="stat-team">{abbr}</span>
              <span className="stat-val">{p.fightingMajors}</span>
            </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Build pill list for skaters (includes Fighting Majors after Major Penalties)
const SKATER_PILLS = [];
for (const cat of SKATER_CARDS) {
  SKATER_PILLS.push({ key: cat.key, label: cat.label });
  if (cat.key === "majors") SKATER_PILLS.push({ key: "fightingMajors", label: "FIGHTING MAJORS" });
}

export default function LeadersPage() {
  const { data, isLoading, error } = useLeaders();
  const { data: fmData } = useFightingMajors();
  const leaders = data?.leaders || {};
  const [skaterCat, setSkaterCat] = useState("points");
  const [goalieCat, setGoalieCat] = useState("gaa");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const favId = getFavoriteTeam();
  const favTeam = favId ? TEAMS[favId] : null;
  const favAbbr = favTeam?.abbr || null;

  const selectedSkater = SKATER_CARDS.find((c) => c.key === skaterCat);

  return (
    <div className="leaders-page">
      <Helmet>
        <title>ECHL Leaders 2025–26</title>
        <meta name="description" content="Points, goals, assists, and goalie leaders" />
        <meta property="og:title" content="ECHL Leaders 2025–26" />
        <meta property="og:description" content="Points, goals, assists, and goalie leaders" />
      </Helmet>
      <div className="leaders-header">
        <h1 className="page-title">League Leaders</h1>
        <ShareButton title="ECHL Leaders" />
        {data?.stale && <div className="stale-banner">⚠ Showing cached data</div>}
      </div>

      {isLoading && <div className="loading-spinner">Loading leaders…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <>
          <div className="leaders-section-label">SKATERS</div>
          {/* Mobile pills */}
          <div className="leaders-pill-bar">
            {SKATER_PILLS.map((p) => (
              <button
                key={p.key}
                className={`leaders-pill${skaterCat === p.key ? " leaders-pill--active" : ""}`}
                onClick={() => setSkaterCat(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="leaders-mobile-card">
            {skaterCat === "fightingMajors"
              ? <FightingMajorsCard data={fmData} favAbbr={favAbbr} favColor={favTeam?.primaryColor} onPlayerClick={setSelectedPlayer} />
              : selectedSkater && <StatCard cat={selectedSkater} leaders={leaders} favAbbr={favAbbr} favColor={favTeam?.primaryColor} onPlayerClick={setSelectedPlayer} />
            }
          </div>
          {/* Desktop grid */}
          <div className="leaders-grid leaders-grid--skaters leaders-desktop-grids">
            {SKATER_CARDS.map((cat) => (
              <React.Fragment key={cat.key}>
                <StatCard cat={cat} leaders={leaders} favAbbr={favAbbr} favColor={favTeam?.primaryColor} onPlayerClick={setSelectedPlayer} />
                {cat.key === "majors" && <FightingMajorsCard data={fmData} favAbbr={favAbbr} favColor={favTeam?.primaryColor} onPlayerClick={setSelectedPlayer} />}
              </React.Fragment>
            ))}
          </div>

          <div className="leaders-section-label">GOALTENDERS</div>
          {/* Mobile pills */}
          <div className="leaders-pill-bar">
            {GOALIE_CARDS.map((cat) => (
              <button
                key={cat.key}
                className={`leaders-pill${goalieCat === cat.key ? " leaders-pill--active" : ""}`}
                onClick={() => setGoalieCat(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="leaders-mobile-card">
            {(() => {
              const cat = GOALIE_CARDS.find((c) => c.key === goalieCat);
              return cat ? <StatCard cat={cat} leaders={leaders} favAbbr={favAbbr} favColor={favTeam?.primaryColor} onPlayerClick={setSelectedPlayer} /> : null;
            })()}
          </div>
          {/* Desktop grid */}
          <div className="leaders-grid leaders-grid--goalies leaders-desktop-grids">
            {GOALIE_CARDS.map((cat) => (
              <StatCard key={cat.key} cat={cat} leaders={leaders} onPlayerClick={setSelectedPlayer} />
            ))}
          </div>
        </>
      )}

      {selectedPlayer && (
        <PlayerModal
          playerId={selectedPlayer.playerId}
          playerName={selectedPlayer.playerName}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
