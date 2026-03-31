import { useState } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { TEAMS, DIVISIONS, getFavoriteTeam, setFavoriteTeam } from "../config/teamConfig.js";
import TeamPicker from "./TeamPicker.jsx";
import "./Layout.css";

// Build nav-friendly division data from shared DIVISIONS config
const NAV_DIVISIONS = DIVISIONS.map((div) => ({
  name: div.name,
  teams: div.teams.map((id) => TEAMS[id]).filter(Boolean),
}));

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPicker, setShowPicker] = useState(false);

  const pathname = location.pathname;
  const search = location.search;
  const teamMatch = pathname.match(/\/team\/(\d+)/);
  const activeTeamId = teamMatch ? parseInt(teamMatch[1]) : null;
  const activeTab = teamMatch ? (new URLSearchParams(search).get("tab") || "overview") : null;

  const favoriteId = getFavoriteTeam();
  const favoriteTeam = favoriteId ? TEAMS[favoriteId] : null;
  const teamColor = favoriteTeam?.primaryColor;

  return (
    <div className="layout">
      {/* Top page nav */}
      <header className="top-bar">
        <div className="top-bar-inner">
          <NavLink to="/" className="logo-link">
            <img src="/icon-192.png" alt="ECHL Stats" className="header-logo" />
          </NavLink>
          <nav className="page-nav">
            {favoriteId && (
              <NavLink
                to={`/team/${favoriteId}`}
                className={() => "page-nav-link page-nav-link--desktop-only" + (activeTeamId === favoriteId ? " active" : "")}
              >
                My Team
              </NavLink>
            )}
            <NavLink to="/standings" className={({ isActive }) => "page-nav-link page-nav-link--hideable" + (isActive ? " active" : "")}>
              Standings
            </NavLink>
            <NavLink to="/leaders" className={({ isActive }) => "page-nav-link page-nav-link--hideable" + (isActive ? " active" : "")}>
              League Leaders
            </NavLink>
            <NavLink to="/attendance" className={({ isActive }) => "page-nav-link" + (isActive ? " active" : "")}>
              Attendance Stats
            </NavLink>
          </nav>
          <button
            className="fav-team-btn"
            onClick={() => setShowPicker(true)}
            title={favoriteTeam ? `My Team: ${favoriteTeam.name}` : "Choose your team"}
          >
            {favoriteTeam ? (
              <img src={favoriteTeam.logoUrl} alt={favoriteTeam.abbr} className="fav-team-logo" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Team logo navigation bar */}
      <div className="team-nav-bar">
        <div className="team-nav-scroll">
          {NAV_DIVISIONS.map((div, di) => (
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
              {di < NAV_DIVISIONS.length - 1 && <div className="division-divider" />}
            </div>
          ))}
        </div>
      </div>

      <main className="main-content">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav (all pages) ── */}
      <div className="global-bottom-nav">
        {[
          ["overview", "Overview", <svg key="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>],
          ["roster", "Roster", <svg key="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>],
          ["schedule", "Schedule", <svg key="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>],
          ["stats", "Stats", <svg key="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>],
          ["scores", "Scores", <svg key="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>],
        ].map(([tab, label, icon]) => {
          const isActive = activeTab === tab;
          const teamId = activeTeamId || favoriteId;
          return (
            <button
              key={tab}
              className={`global-bottom-tab${isActive ? " active" : ""}`}
              style={isActive && teamColor ? { color: teamColor, borderTopColor: teamColor } : undefined}
              onClick={() => {
                if (teamId) {
                  const params = tab === "overview" ? "" : `?tab=${tab}`;
                  navigate(`/team/${teamId}${params}`);
                }
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
        <button
          className={`global-bottom-tab${pathname === "/standings" ? " active" : ""}`}
          onClick={() => navigate("/standings")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
          <span>Standings</span>
        </button>
        <button
          className={`global-bottom-tab${pathname === "/leaders" ? " active" : ""}`}
          onClick={() => navigate("/leaders")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Leaders</span>
        </button>
      </div>

      <footer className="site-footer">
        <p>
          echlstats.com is an independent, unofficial website operated by a third
          party. It is not the official website of the ECHL or any ECHL member
          club, and it is not affiliated with, sponsored by, endorsed by, or approved
          by the ECHL or any member club. ECHL and team names, logos, and
          related marks are used under limited license solely for identification and
          statistical-reference purposes. For official league and club information,
          users should refer to the ECHL's and applicable clubs' official websites
          and channels.
        </p>
      </footer>

      {showPicker && (
        <TeamPicker
          isFirstVisit={false}
          onClose={() => setShowPicker(false)}
          onSelect={(id) => {
            setFavoriteTeam(id);
            setShowPicker(false);
            if (id) navigate(`/team/${id}`);
          }}
        />
      )}
    </div>
  );
}
