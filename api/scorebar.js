const { apiFetch, HT_TO_INTERNAL, num, setCache } = require("./lib/hockeytech");

module.exports = async function handler(req, res) {
  try {
    const data = await apiFetch("modulekit", "scorebar", { numberofdaysback: "1", numberofdaysahead: "1" });
    const raw = data?.SiteKit?.Scorebar || [];

    const games = raw.map((g) => ({
      gameId: num(g.ID),
      date: g.Date || "",
      gameTime: g.ScheduledFormattedTime || "",
      timezone: g.TimezoneShort || "",
      homeTeamId: HT_TO_INTERNAL[g.HomeID] ?? num(g.HomeID),
      homeTeam: g.HomeCity || "",
      homeCode: g.HomeCode || "",
      homeGoals: num(g.HomeGoals),
      homeRecord: `${g.HomeWins || 0}-${g.HomeRegulationLosses || 0}-${g.HomeOTLosses || 0}-${g.HomeShootoutLosses || 0}`,
      visitingTeamId: HT_TO_INTERNAL[g.VisitorID] ?? num(g.VisitorID),
      visitingTeam: g.VisitorCity || "",
      visitingCode: g.VisitorCode || "",
      visitingGoals: num(g.VisitorGoals),
      visitingRecord: `${g.VisitorWins || 0}-${g.VisitorRegulationLosses || 0}-${g.VisitorOTLosses || 0}-${g.VisitorShootoutLosses || 0}`,
      period: g.PeriodNameLong || "",
      clock: g.GameClock || "",
      status: g.GameStatusStringLong || g.GameStatusString || "",
      intermission: g.Intermission === "1",
      venue: g.venue_name || "",
      floHockeyUrl: g.FloHockeyUrl || "",
    }));

    setCache(res, 120, 240);
    res.json({ games, scrapedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
