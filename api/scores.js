const { apiFetch, SEASON_ID, num, formatDate, setCache } = require("./lib/hockeytech");

module.exports = async function handler(req, res) {
  try {
    const data = await apiFetch("modulekit", "schedule", { season_id: SEASON_ID });
    const schedule = data?.SiteKit?.Schedule || [];

    const scores = [];
    for (const g of schedule) {
      if (g.final !== "1") continue;
      const hGoals = num(g.home_goal_count);
      const vGoals = num(g.visiting_goal_count);
      const status = g.game_status || "";
      let overtime = null;
      if (status.includes("SO")) overtime = "SO";
      else if (status.includes("OT")) overtime = "OT";

      scores.push({
        visitingTeam: g.visiting_team_city || "",
        visitingScore: vGoals,
        homeTeam: g.home_team_city || "",
        homeScore: hGoals,
        overtime,
        score: overtime ? `${vGoals}-${hGoals} (${overtime})` : `${vGoals}-${hGoals}`,
        gameId: num(g.game_id),
        date: formatDate(g.date_played),
      });
    }

    scores.sort((a, b) => new Date(b.date) - new Date(a.date) || b.gameId - a.gameId);

    setCache(res, 900, 1800);
    res.json({ scores, scrapedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
