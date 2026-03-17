import { useLeaders } from "../hooks/useECHL.js";
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
  { key: "svPct",      label: "SV %",       stat: "SV%", isPct: true, note: "min 10 GP" },
  { key: "shutouts",   label: "SHUTOUTS",   stat: "SO"   },
  { key: "goalieWins", label: "WINS",       stat: "W"    },
  { key: "soRecord",   label: "SO SAVE %",  stat: "SO%", isPct: true, note: "min 3 attempts" },
];


function fmtVal(value, cat) {
  if (value == null) return "—";
  if (cat.isPct) {
    const v = parseFloat(value);
    return isNaN(v) ? "—" : (v <= 1 ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}%`);
  }
  if (cat.plusMinus && value > 0) return `+${value}`;
  return value;
}

function StatCard({ cat, leaders }) {
  const rawData = leaders[cat.key] || [];
  const sorted = cat.lower
    ? [...rawData].sort((a, b) => a.value - b.value)
    : [...rawData].sort((a, b) => b.value - a.value);
  const top5 = sorted.slice(0, 5);

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        {cat.label}
        {cat.note && <span className="stat-card-note">{cat.note}</span>}
      </div>
      {top5.length === 0 ? (
        <div className="stat-card-empty">No data</div>
      ) : (
        <ol className="stat-card-list">
          {top5.map((p, i) => (
            <li
              key={i}
              className={`stat-row${i === 0 ? " stat-row--first" : ""}${i % 2 !== 0 ? " stat-row--alt" : ""}`}
            >
              <span className="stat-rank">{i + 1}</span>
              <span className="stat-name">
                {p.name}
                {p.isRookie && <span className="stat-rookie">R</span>}
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

export default function LeadersPage() {
  const { data, isLoading, error } = useLeaders();
  const leaders = data?.leaders || {};

  return (
    <div className="leaders-page">
      <div className="leaders-header">
        <h1 className="page-title">League Leaders</h1>
        {data?.stale && <div className="stale-banner">⚠ Showing cached data</div>}
      </div>

      {isLoading && <div className="loading-spinner">Loading leaders…</div>}
      {error && <div className="error-box">Error: {error.message}</div>}

      {!isLoading && !error && (
        <>
          <div className="leaders-section-label">SKATERS</div>
          <div className="leaders-grid leaders-grid--skaters">
            {SKATER_CARDS.map((cat) => (
              <StatCard key={cat.key} cat={cat} leaders={leaders} />
            ))}
          </div>

          <div className="leaders-section-label">GOALTENDERS</div>
          <div className="leaders-grid leaders-grid--goalies">
            {GOALIE_CARDS.map((cat) => (
              <StatCard key={cat.key} cat={cat} leaders={leaders} />
            ))}
          </div>


        </>
      )}
    </div>
  );
}
