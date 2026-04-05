const { apiFetch, num, setCache } = require("./lib/hockeytech");

module.exports = async function handler(req, res) {
  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    // Fetch profile and career stats in parallel
    const [profileData, statsData] = await Promise.all([
      apiFetch("modulekit", "player", { player_id: playerId, category: "profile" }),
      apiFetch("modulekit", "player", { player_id: playerId, category: "seasonstats" }),
    ]);

    const profile = profileData?.SiteKit?.Player;
    const player = statsData?.SiteKit?.Player;
    if (!player && !profile) return res.status(404).json({ error: `No player found: ${playerId}` });

    // Build bio from profile
    let bio = null;
    if (profile) {
      const birthParts = [profile.birthtown, profile.birthprov, profile.birthcntry].filter(Boolean);
      bio = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        height: profile.height || "",
        weight: profile.weight || "",
        birthdate: profile.birthdate || "",
        birthplace: birthParts.join(", "),
        shoots: profile.position === "G" ? (profile.catches || "") : (profile.shoots || ""),
        position: profile.position || "",
        number: profile.jersey_number || "",
        teamName: profile.most_recent_team_name || "",
        photoUrl: profile.primary_image || `https://assets.leaguestat.com/echl/120x160/${playerId}.jpg`,
        isRookie: profile.rookie === "1",
      };
    }

    // Format career stats
    const formatSeason = (s) => ({
      seasonName: s.season_name || "",
      teamName: s.team_name || "",
      teamCode: s.team_code || "",
      gp: num(s.games_played),
      g: num(s.goals),
      a: num(s.assists),
      pts: num(s.points),
      pm: num(s.plus_minus),
      pim: num(s.penalty_minutes),
      ppg: num(s.power_play_goals),
      shg: num(s.short_handed_goals),
      gwg: num(s.game_winning_goals),
      shots: num(s.shots),
      shPct: parseFloat(s.shooting_percentage || "0"),
    });

    const formatGoalieSeason = (s) => ({
      seasonName: s.season_name || "",
      teamName: s.team_name || "",
      teamCode: s.team_code || "",
      gp: num(s.games_played),
      w: num(s.wins),
      l: num(s.losses),
      otl: num(s.ot_losses),
      gaa: parseFloat(s.gaa || s.goals_against_average || "0"),
      svPct: parseFloat(s.savepct || s.save_percentage || "0"),
      so: num(s.shutouts),
      ga: num(s.goals_against),
      sa: num(s.shots_against),
    });

    const isGoalie = bio?.position === "G";
    const formatter = isGoalie ? formatGoalieSeason : formatSeason;

    const isTotal = (s) => (s.season_name || "").toLowerCase() === "total";
    const regular = (player?.regular || []).filter((s) => !isTotal(s)).map(formatter);
    const playoff = (player?.playoff || []).filter((s) => !isTotal(s)).map(formatter);

    // Get totals rows
    const regularTotal = (player?.regular || []).find(isTotal);
    const playoffTotal = (player?.playoff || []).find(isTotal);

    setCache(res, 3600, 7200);
    res.json({
      playerId,
      bio,
      isGoalie,
      regular,
      playoff,
      regularTotal: regularTotal ? formatter(regularTotal) : null,
      playoffTotal: playoffTotal ? formatter(playoffTotal) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
