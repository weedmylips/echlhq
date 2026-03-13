import { Outlet, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Layout.css";

export default function Layout() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <NavLink to="/" className="logo">
            <span className="logo-puck">🏒</span>
            <span className="logo-text">ECHL Dashboard</span>
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Dashboard
            </NavLink>
            <NavLink to="/standings" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Standings
            </NavLink>
            <NavLink to="/leaders" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Leaders
            </NavLink>
          </nav>
          <button
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <p>Data sourced from echl.com · Not affiliated with the ECHL</p>
      </footer>
    </div>
  );
}
