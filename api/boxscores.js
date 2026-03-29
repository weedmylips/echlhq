const { apiFetch, MONTHS, num, setCache } = require("./lib/hockeytech");

module.exports = async function handler(req, res) {
  try {
    const { gameId } = req.query;
    const summary = await apiFetch("statviewfeed", "gameSummary", { game_id: gameId });

    if (!summary?.details) return res.status(404).json({ error: `No game found: ${gameId}` });

    const d = summary.details;
    const home = summary.homeTeam;
    const vis = summary.visitingTeam;
    if (!home || !vis) return res.status(404).json({ error: "Incomplete game data" });

    // Reformat "Friday, March 27, 2026" → "Mar 27, 2026"
    let dateStr = d.date || "";
    const dateMatch = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)$/);
    if (dateMatch) {
      const fullMonths = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const idx = fullMonths.indexOf(dateMatch[1]);
      if (idx >= 0) dateStr = `${MONTHS[idx]} ${dateMatch[2]}, ${dateMatch[3]}`;
    }

    // Get current period/clock from the last period in the summary
    const periods = summary.periods || [];
    const lastPeriod = periods.length ? periods[periods.length - 1] : null;

    const gameInfo = {
      gameId: d.id,
      visitingTeam: vis.info?.city || "",
      homeTeam: home.info?.city || "",
      date: dateStr,
      arena: d.venue || "",
      attendance: d.attendance || 0,
      finalScore: { visiting: num(vis.stats?.goals), home: num(home.stats?.goals) },
      period: lastPeriod?.info?.longName || "",
      clock: d.GameClock || d.gameClock || d.clock || "",
      status: d.GameStatusStringLong || d.GameStatusString || d.status || "",
    };

    // Period scoring
    const periodScoring = [];
    for (const period of summary.periods || []) {
      for (const goal of period.goals || []) {
        const props = goal.properties || {};
        let strength = "EV";
        if (props.isPowerPlay === "1") strength = "PP";
        else if (props.isShortHanded === "1") strength = "SH";
        else if (props.isEmptyNet === "1") strength = "EN";
        const assistNames = (goal.assists || [])
          .map((a) => `${(a.firstName || "")[0] || ""}. ${a.lastName || ""}`)
          .join(", ");
        periodScoring.push({
          period: period.info?.longName || "",
          time: goal.time || "",
          team: goal.team?.abbreviation || "",
          scorer: `${(goal.scoredBy?.firstName || "")[0] || ""}. ${goal.scoredBy?.lastName || ""} (${goal.scorerGoalNumber || ""})`,
          assists: assistNames,
          strength,
        });
      }
    }

    // Shots by period
    const homeShots = { team: home.info?.city || "", p1: 0, p2: 0, p3: 0, ot: 0, total: 0 };
    const visShots = { team: vis.info?.city || "", p1: 0, p2: 0, p3: 0, ot: 0, total: 0 };
    for (const period of summary.periods || []) {
      const pId = period.info?.shortName || "";
      const hS = num(period.stats?.homeShots);
      const vS = num(period.stats?.visitingShots);
      if (pId === "1") { homeShots.p1 = hS; visShots.p1 = vS; }
      else if (pId === "2") { homeShots.p2 = hS; visShots.p2 = vS; }
      else if (pId === "3") { homeShots.p3 = hS; visShots.p3 = vS; }
      else { homeShots.ot += hS; visShots.ot += vS; }
      homeShots.total += hS;
      visShots.total += vS;
    }

    function mapSkaters(players) {
      return (players || []).map((p) => ({
        number: String(p.info?.jerseyNumber ?? ""),
        name: `${(p.info?.firstName || "")[0] || ""}. ${p.info?.lastName || ""}`,
        pos: p.info?.position || "",
        g: num(p.stats?.goals), a: num(p.stats?.assists), pts: num(p.stats?.points),
        plusMinus: num(p.stats?.plusMinus), shots: num(p.stats?.shots), pim: num(p.stats?.penaltyMinutes),
      }));
    }

    function mapGoalies(goalies) {
      return (goalies || []).map((g) => {
        const sa = num(g.stats?.shotsAgainst);
        const sv = num(g.stats?.saves);
        return {
          number: String(g.info?.jerseyNumber ?? ""),
          name: `${(g.info?.firstName || "")[0] || ""}. ${g.info?.lastName || ""}`,
          minsPlayed: g.stats?.timeOnIce || "0:00",
          shotsAgainst: sa, saves: sv, ga: num(g.stats?.goalsAgainst),
          svPct: sa > 0 ? Math.round((sv / sa) * 1000) / 1000 : 0,
        };
      });
    }

    const penalties = [];
    for (const period of summary.periods || []) {
      for (const pen of period.penalties || []) {
        const isHome = pen.againstTeam?.id === home.info?.id;
        penalties.push({
          period: period.info?.longName || "",
          team: isHome ? "H" : "V",
          player: `${(pen.takenBy?.firstName || "")[0] || ""}. ${pen.takenBy?.lastName || ""}`,
          minutes: pen.minutes || 0,
          infraction: [pen.description, pen.ruleNumber ? `(${pen.ruleNumber})` : ""].filter(Boolean).join(" "),
          time: pen.time || "",
        });
      }
    }

    const stars = (summary.mostValuablePlayers || []).map((mvp, i) => {
      const info = mvp.player?.info || {};
      const stats = mvp.player?.stats || {};
      const star = { star: i + 1, team: mvp.team?.abbreviation || "", name: `${(info.firstName || "")[0] || ""}. ${info.lastName || ""}` };
      if (mvp.isGoalie) { star.saves = num(stats.saves); star.svPct = num(stats.savePercentage || 0); }
      else { star.g = num(stats.goals); star.a = num(stats.assists); star.pts = num(stats.points); }
      return star;
    });

    const isFinal = d.final === "1" || d.final === 1;

    // Final boxscores never change — cache aggressively
    const maxAge = isFinal ? 3600 : 60;
    const swr = isFinal ? 86400 : 120;
    setCache(res, maxAge, swr);

    res.json({
      gameInfo, periodScoring, shotsByPeriod: [visShots, homeShots],
      skaterStats: { visiting: mapSkaters(vis.skaters), home: mapSkaters(home.skaters) },
      goalieStats: { visiting: mapGoalies(vis.goalies), home: mapGoalies(home.goalies) },
      penalties, stars, isFinal, scrapedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
