import { Router } from "express";
import { fetchStandings } from "../scrapers/standings.js";
import { fetchScores } from "../scrapers/dailyReport.js";
import { teams } from "../config/teamConfig.js";

const router = Router();

router.get("/:teamId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) {
    return res.status(400).json({ error: "Invalid teamId" });
  }

  const config = teams[teamId];
  if (!config) {
    return res.status(404).json({ error: "Team not found" });
  }

  try {
    const [standingsData, scoresData] = await Promise.allSettled([
      fetchStandings(),
      fetchScores(),
    ]);

    const standingsResult = standingsData.status === "fulfilled" ? standingsData.value : null;
    const scoresResult = scoresData.status === "fulfilled" ? scoresData.value : null;

    // Find this team's row in standings
    const teamStanding = standingsResult?.standings?.find(
      (s) => s.teamId === teamId || s.teamName?.toLowerCase().includes(config.city.toLowerCase())
    ) || null;

    // Filter scores involving this team
    const teamScores = scoresResult?.scores?.filter((s) => {
      const home = s.homeTeam?.toLowerCase() || "";
      const visit = s.visitingTeam?.toLowerCase() || "";
      const city = config.city.toLowerCase();
      return home.includes(city) || visit.includes(city);
    }) || [];

    res.json({
      team: config,
      standing: teamStanding,
      recentScores: teamScores.slice(0, 5),
      scrapedAt: standingsResult?.scrapedAt || scoresResult?.scrapedAt,
      stale: standingsResult?.stale || scoresResult?.stale || false,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
