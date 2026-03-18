import { useNavigate, useParams, NavLink } from "react-router-dom";
import { Outlet } from "react-router-dom";
import "./Layout.css";

// All 30 ECHL teams grouped by division, in order
const DIVISIONS = [
  {
    name: "North",
    teams: [
      { id: 74,  abbr: "ADK", name: "Adirondack Thunder" },
      { id: 108, abbr: "GRN", name: "Greensboro Gargoyles" },
      { id: 101, abbr: "MNE", name: "Maine Mariners" },
      { id: 63,  abbr: "NOR", name: "Norfolk Admirals" },
      { id: 55,  abbr: "REA", name: "Reading Royals" },
      { id: 103, abbr: "TR",  name: "Trois-Rivières Lions" },
      { id: 61,  abbr: "WHL", name: "Wheeling Nailers" },
      { id: 104, abbr: "WOR", name: "Worcester Railers" },
    ],
  },
  {
    name: "South",
    teams: [
      { id: 10,  abbr: "ATL", name: "Atlanta Gladiators" },
      { id: 8,   abbr: "FLA", name: "Florida Everblades" },
      { id: 52,  abbr: "GVL", name: "Greenville Swamp Rabbits" },
      { id: 79,  abbr: "JAX", name: "Jacksonville Icemen" },
      { id: 13,  abbr: "ORL", name: "Orlando Solar Bears" },
      { id: 97,  abbr: "SAV", name: "Savannah Ghost Pirates" },
      { id: 50,  abbr: "SC",  name: "South Carolina Stingrays" },
    ],
  },
  {
    name: "Central",
    teams: [
      { id: 107, abbr: "BLM", name: "Bloomington Bison" },
      { id: 5,   abbr: "CIN", name: "Cincinnati Cyclones" },
      { id: 60,  abbr: "FW",  name: "Fort Wayne Komets" },
      { id: 65,  abbr: "IND", name: "Indy Fuel" },
      { id: 98,  abbr: "IA",  name: "Iowa Heartlanders" },
      { id: 53,  abbr: "KAL", name: "Kalamazoo Wings" },
      { id: 70,  abbr: "TOL", name: "Toledo Walleye" },
    ],
  },
  {
    name: "Mountain",
    teams: [
      { id: 11,  abbr: "IDH", name: "Idaho Steelheads" },
      { id: 56,  abbr: "KC",  name: "Kansas City Mavericks" },
      { id: 85,  abbr: "RC",  name: "Rapid City Rush" },
      { id: 109, abbr: "TAH", name: "Tahoe Knight Monsters" },
      { id: 72,  abbr: "TUL", name: "Tulsa Oilers" },
      { id: 106, abbr: "UTA", name: "Utah Grizzlies" },
      { id: 66,  abbr: "ALN", name: "Allen Americans" },
      { id: 96,  abbr: "WIC", name: "Wichita Thunder" },
    ],
  },
];

export default function Layout() {
  const navigate = useNavigate();
  // Get active teamId from URL if on a team page
  const pathname = window.location.pathname;
  const teamMatch = pathname.match(/\/team\/(\d+)/);
  const activeTeamId = teamMatch ? parseInt(teamMatch[1]) : null;

  return (
    <div className="layout">
      {/* Top page nav */}
      <header className="top-bar">
        <div className="top-bar-inner">
          <NavLink to="/" className="logo-link">
            <img src="/icon-192.png" alt="ECHL Stats" className="header-logo" />
          </NavLink>
          <nav className="page-nav">
            <NavLink to="/" end className={({ isActive }) => "page-nav-link" + (isActive ? " active" : "")}>
              Home
            </NavLink>
            <NavLink to="/standings" className={({ isActive }) => "page-nav-link" + (isActive ? " active" : "")}>
              Standings
            </NavLink>
            <NavLink to="/leaders" className={({ isActive }) => "page-nav-link" + (isActive ? " active" : "")}>
              Leaders
            </NavLink>
            <NavLink to="/attendance" className={({ isActive }) => "page-nav-link" + (isActive ? " active" : "")}>
              Attendance
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Team logo navigation bar */}
      <div className="team-nav-bar">
        <div className="team-nav-scroll">
          {DIVISIONS.map((div, di) => (
            <div key={div.name} className="team-nav-division">
              <div className="division-header">{div.name}</div>
              <div className="team-nav-teams">
                {div.teams.map((team) => (
                  <button
                    key={team.id}
                    className={`team-nav-btn${activeTeamId === team.id ? " active" : ""}`}
                    onClick={() => navigate(`/team/${team.id}`)}
                    title={team.name}
                  >
                    <img
                      src={`/logos/${team.id}.png`}
                      alt={team.abbr}
                      className="team-nav-logo"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <span className="team-nav-abbr">{team.abbr}</span>
                  </button>
                ))}
              </div>
              {di < DIVISIONS.length - 1 && <div className="division-divider" />}
            </div>
          ))}
        </div>
      </div>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
