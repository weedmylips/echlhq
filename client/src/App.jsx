import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import StandingsPage from "./pages/StandingsPage.jsx";
import LeadersPage from "./pages/LeadersPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";
import TeamPicker from "./components/TeamPicker.jsx";
import { getFavoriteTeam, setFavoriteTeam } from "./config/teamConfig.js";

function HomePage() {
  const navigate = useNavigate();
  const favoriteTeam = getFavoriteTeam();
  const [showPicker, setShowPicker] = useState(!favoriteTeam);

  useEffect(() => {
    if (favoriteTeam) {
      navigate(`/team/${favoriteTeam}`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (favoriteTeam) return null;

  return showPicker ? (
    <TeamPicker
      isFirstVisit
      onSelect={(id) => {
        setShowPicker(false);
        if (id) {
          setFavoriteTeam(id);
          navigate(`/team/${id}`, { replace: true });
        }
      }}
    />
  ) : null;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route path="leaders" element={<LeadersPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="team/:teamId" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}
