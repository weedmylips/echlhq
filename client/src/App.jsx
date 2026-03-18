import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import StandingsPage from "./pages/StandingsPage.jsx";
import LeadersPage from "./pages/LeadersPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route path="leaders" element={<LeadersPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="team/:teamId" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}
