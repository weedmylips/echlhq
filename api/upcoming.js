const { apiFetch, HT_TO_INTERNAL, SEASON_ID, num, formatDate, setCache } = require("./lib/hockeytech");

module.exports = async function handler(req, res) {
  try {
    const data = await apiFetch("modulekit", "schedule", { season_id: SEASON_ID });
    const schedule = data?.SiteKit?.Schedule || [];
    const today = new Date().toISOString().slice(0, 10);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const games = [];

    for (const g of schedule) {
      if (g.final === "1" || g.date_played < today) continue;
      const d = new Date(g.date_played + "T12:00:00Z");

      let timeStr = g.scheduled_time || "";
      if (!timeStr && g.schedule_time) {
        const [hh, mm] = g.schedule_time.split(":");
        const h = num(hh);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        timeStr = `${h12}:${mm} ${ampm}`;
        const tz = g.timezone || "";
        if (tz.includes("Eastern")) timeStr += " EDT";
        else if (tz.includes("Central")) timeStr += " CDT";
        else if (tz.includes("Mountain")) timeStr += " MDT";
        else if (tz.includes("Pacific")) timeStr += " PDT";
      }

      games.push({
        visitingTeamId: HT_TO_INTERNAL[g.visiting_team] ?? num(g.visiting_team),
        visitingTeam: g.visiting_team_city || "",
        homeTeamId: HT_TO_INTERNAL[g.home_team] ?? num(g.home_team),
        homeTeam: g.home_team_city || "",
        date: formatDate(g.date_played),
        time: timeStr,
        dayLabel: days[d.getUTCDay()],
      });
    }

    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    setCache(res, 3600, 7200);
    res.json({ games, scrapedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
