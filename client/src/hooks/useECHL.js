import { useRef } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { TEAMS } from "../config/teamConfig.js";

// staleTime values match the scraper schedule (~6 hrs)
const STALE = 6 * 60 * 60 * 1000;

export function useStandings() {
  return useQuery({
    queryKey: ["standings"],
    queryFn: api.standings,
    staleTime: STALE,
  });
}

export function useLeaders() {
  return useQuery({
    queryKey: ["leaders"],
    queryFn: api.leaders,
    staleTime: STALE,
  });
}

export function useFightingMajors() {
  return useQuery({
    queryKey: ["fightingMajors"],
    queryFn: api.fightingMajors,
    staleTime: STALE,
  });
}

export function useScores() {
  return useQuery({
    queryKey: ["scores"],
    queryFn: api.scores,
    staleTime: STALE,
  });
}

export function useGameAttendance() {
  return useQuery({
    queryKey: ["gameAttendance"],
    queryFn: api.gameAttendance,
    staleTime: STALE,
  });
}

export function useBoxscore(gameId) {
  // First fetch uses staticOrLive (tries static, falls back to API).
  // If the game is live (not final), subsequent polls go straight to the API
  // to avoid a static 404 on every poll cycle.
  const isLive = useRef(false);
  return useQuery({
    queryKey: ["boxscore", gameId],
    queryFn: async () => {
      if (isLive.current) return api.boxscoreLive(gameId);
      const data = await api.boxscore(gameId);
      if (!data.isFinal) isLive.current = true;
      return data;
    },
    enabled: !!gameId,
    staleTime: 15 * 1000,
    retry: 1,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.isFinal) return false;
      return 15 * 1000;
    },
  });
}

export function useRoster(teamId) {
  return useQuery({
    queryKey: ["roster", teamId],
    queryFn: () => api.roster(teamId),
    enabled: !!teamId,
    staleTime: STALE,
  });
}

export function useTeamMoves(teamId) {
  return useQuery({
    queryKey: ["teamMoves", teamId],
    queryFn: () => api.teamMoves(teamId),
    enabled: !!teamId,
    staleTime: STALE,
    retry: 1,
  });
}

export function useTeamPlayers(teamId) {
  return useQuery({
    queryKey: ["players", teamId],
    queryFn: () => api.players(teamId),
    enabled: !!teamId,
    staleTime: STALE,
    retry: 1,
  });
}

// ─── helpers used by useTeamStats ─────────────────────────────────────────────
function parseRecord(str) {
  if (!str) return null;
  const parts = String(str).split("-").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [w = 0, l = 0, otl = 0, sol = 0] = parts;
  const gp = w + l + otl + sol;
  const pts = w * 2 + otl + sol;
  return { w, l, otl, sol, gp, pts, pct: gp > 0 ? pts / (gp * 2) : 0 };
}

function matchCity(teamStr, city) {
  return (teamStr || "").toLowerCase().includes(city);
}

function computeTeamStats(id, standingsData, scoresData) {
  const allStandings = standingsData?.standings || [];
  const allScores    = scoresData?.scores || [];
  const standing = allStandings.find((t) => t.teamId === id);
  if (!standing) return null;

  const city = (TEAMS[id]?.city || standing.teamName).toLowerCase();
  const divTeams = allStandings
    .filter((t) => t.division === standing.division)
    .sort((a, b) => b.pts - a.pts);

  // ── 1 & 8: Playoff picture + clinching ─────────────────────────────────────
  const rank = divTeams.findIndex((t) => t.teamId === id) + 1;
  const fifthPlace   = divTeams[4];
  const fourthPlace  = divTeams[3];
  const fourthPts    = fourthPlace?.pts ?? 0;
  const firstPts     = divTeams[0]?.pts ?? 0;
  const maxFifthPts  = fifthPlace ? fifthPlace.pts + (fifthPlace.gamesRemaining || 0) * 2 : 0;
  const maxOurPts    = standing.pts + (standing.gamesRemaining || 0) * 2;
  const isClinched   = rank <= 4 && (!fifthPlace || standing.pts > maxFifthPts);
  const isEliminated = rank > 4 && maxOurPts < fourthPts;
  const ptsBack4th   = Math.max(0, fourthPts - standing.pts);
  const ptsBack1st   = Math.max(0, firstPts - standing.pts);
  const magicNumber  = isClinched ? 0
    : rank <= 4 && fifthPlace ? Math.max(0, maxFifthPts - standing.pts + 1)
    : !isEliminated ? Math.max(1, fourthPts - standing.pts + 1)
    : 0;
  const playoffStatus =
    isClinched   ? "CLINCHED" :
    isEliminated ? "ELIMINATED" :
    rank <= 4    ? "IN PLAYOFF POSITION" :
    ptsBack4th <= 6 ? "ON THE BUBBLE" : "CHASING";
  const clinchedText = (!isClinched && !isEliminated && magicNumber > 0)
    ? `${standing.teamName} clinches a playoff spot by earning ${magicNumber} more point${magicNumber !== 1 ? "s" : ""}`
    : isClinched ? `${standing.teamName} has clinched a playoff spot!`
    : isEliminated ? `${standing.teamName} has been eliminated from playoff contention`
    : null;

  // ── 2: PCT Trend (from scores) ──────────────────────────────────────────────
  const teamGames = allScores
    .filter((g) => matchCity(g.homeTeam, city) || matchCity(g.visitingTeam, city))
    .reverse(); // oldest first
  let runPts = 0;
  const pctTrend = teamGames.map((g, i) => {
    const isHome  = matchCity(g.homeTeam, city);
    const myScore = isHome ? g.homeScore : g.visitingScore;
    const oppScore = isHome ? g.visitingScore : g.homeScore;
    const won = myScore > oppScore;
    const ot  = !!g.overtime;
    runPts += won ? 2 : ot ? 1 : 0;
    return {
      game: i + 1,
      pct: runPts / ((i + 1) * 2),
      date: g.date,
      result: won ? (ot ? "OT-W" : "W") : (ot ? "OT-L" : "L"),
    };
  });
  const trendDir = pctTrend.length >= 2
    ? (pctTrend[pctTrend.length - 1].pct >= pctTrend[0].pct ? "up" : "down")
    : null;

  // ── 3: Division H2H ─────────────────────────────────────────────────────────
  const h2h = divTeams
    .filter((t) => t.teamId !== id)
    .map((opp) => {
      const oppCity = (TEAMS[opp.teamId]?.city || opp.teamName).toLowerCase();
      const games = allScores.filter((g) =>
        (matchCity(g.homeTeam, city) && matchCity(g.visitingTeam, oppCity)) ||
        (matchCity(g.visitingTeam, city) && matchCity(g.homeTeam, oppCity))
      );
      let w = 0, l = 0, gfTotal = 0, gaTotal = 0;
      games.forEach((g) => {
        const isHome  = matchCity(g.homeTeam, city);
        const myScore  = isHome ? g.homeScore  : g.visitingScore;
        const oppScore = isHome ? g.visitingScore : g.homeScore;
        gfTotal += (myScore  || 0);
        gaTotal += (oppScore || 0);
        if (myScore > oppScore) w++; else l++;
      });
      return { teamId: opp.teamId, teamName: opp.teamName, logoUrl: opp.logoUrl, w, l, gp: games.length, gfTotal, gaTotal, diff: gfTotal - gaTotal };
    });

  // ── 4: PIM ──────────────────────────────────────────────────────────────────
  const hasPim = allStandings.some((t) => (t.pim || 0) > 0);
  const pimPerGame = (standing.pim && standing.gp) ? (standing.pim / standing.gp).toFixed(1) : null;
  const divByPim = [...divTeams].sort((a, b) => (b.pim || 0) - (a.pim || 0));
  const pimDivRank = divByPim.findIndex((t) => t.teamId === id) + 1;
  const leagueByPim = [...allStandings].sort((a, b) => (b.pim || 0) - (a.pim || 0));
  const pimLeagueRank = leagueByPim.findIndex((t) => t.teamId === id) + 1;
  const leagueAvgPim = hasPim
    ? (allStandings.reduce((s, t) => s + (t.pim || 0), 0) / allStandings.length).toFixed(0)
    : null;
  const pimLabel =
    pimLeagueRank === 1 ? "Most Penalized in the League" :
    pimDivRank === 1    ? "Most Penalized in Division" :
    pimDivRank === divTeams.length ? "Cleanest Team in Division" :
    pimLeagueRank <= 3  ? "Among the Most Penalized in League" :
    pimLeagueRank >= allStandings.length - 2 ? "Among the Least Penalized" :
    "Average Discipline";

  // ── 6: Home Ice Advantage ───────────────────────────────────────────────────
  const homeStats = parseRecord(standing.homeRecord);
  const roadStats = parseRecord(standing.roadRecord);
  const divHomeStats = divTeams.map((t) => parseRecord(t.homeRecord)).filter(Boolean);
  const divAvgHomePct = divHomeStats.length
    ? divHomeStats.reduce((s, r) => s + r.pct, 0) / divHomeStats.length : 0;
  const divRoadStats = divTeams.map((t) => parseRecord(t.roadRecord)).filter(Boolean);
  const divAvgRoadPct = divRoadStats.length
    ? divRoadStats.reduce((s, r) => s + r.pct, 0) / divRoadStats.length : 0;
  const leagueHomeStats = allStandings.map((t) => parseRecord(t.homeRecord)).filter(Boolean);
  const leagueAvgHomePct = leagueHomeStats.length
    ? leagueHomeStats.reduce((s, r) => s + r.pct, 0) / leagueHomeStats.length : 0;
  const leagueRoadStats = allStandings.map((t) => parseRecord(t.roadRecord)).filter(Boolean);
  const leagueAvgRoadPct = leagueRoadStats.length
    ? leagueRoadStats.reduce((s, r) => s + r.pct, 0) / leagueRoadStats.length : 0;
  const homeDiff = homeStats && roadStats ? homeStats.pct - roadStats.pct : 0;
  const homeAdvLabel =
    homeDiff > 0.10 ? "Home Team" :
    homeDiff < -0.10 ? "Road Warriors" : "Balanced";

  // ── 7: Defensive + Offensive Efficiency ─────────────────────────────────────
  const gaPerGame = standing.gp > 0 ? standing.ga / standing.gp : 0;
  const gfPerGame = standing.gp > 0 ? standing.gf / standing.gp : 0;
  const leagueAvgGA = allStandings.length
    ? allStandings.reduce((s, t) => s + (t.gp > 0 ? t.ga / t.gp : 0), 0) / allStandings.length : 0;
  const leagueAvgGF = allStandings.length
    ? allStandings.reduce((s, t) => s + (t.gp > 0 ? t.gf / t.gp : 0), 0) / allStandings.length : 0;
  const sortedByGA = [...allStandings].filter((t) => t.gp > 0).sort((a, b) => (a.ga / a.gp) - (b.ga / b.gp));
  const leagueGARank = sortedByGA.findIndex((t) => t.teamId === id) + 1;
  const divSortedByGA = [...divTeams].filter((t) => t.gp > 0).sort((a, b) => (a.ga / a.gp) - (b.ga / b.gp));
  const divGARank = divSortedByGA.findIndex((t) => t.teamId === id) + 1;
  const sortedByGF = [...allStandings].filter((t) => t.gp > 0).sort((a, b) => (b.gf / b.gp) - (a.gf / a.gp));
  const leagueGFRank = sortedByGF.findIndex((t) => t.teamId === id) + 1;
  const divSortedByGF = [...divTeams].filter((t) => t.gp > 0).sort((a, b) => (b.gf / b.gp) - (a.gf / a.gp));
  const divGFRank = divSortedByGF.findIndex((t) => t.teamId === id) + 1;

  // ── 11: Special Teams Ranks ──────────────────────────────────────────────────
  const hasST = allStandings.some((t) => (t.ppPct || 0) > 0);
  const leagueAvgPP = hasST
    ? allStandings.reduce((s, t) => s + (t.ppPct || 0), 0) / allStandings.length : 0;
  const leagueAvgPK = hasST
    ? allStandings.reduce((s, t) => s + (t.pkPct || 0), 0) / allStandings.length : 0;
  const sortedByPP = [...allStandings].filter((t) => (t.ppPct || 0) > 0).sort((a, b) => b.ppPct - a.ppPct);
  const leaguePPRank = hasST ? sortedByPP.findIndex((t) => t.teamId === id) + 1 : 0;
  const divSortedByPP = [...divTeams].filter((t) => (t.ppPct || 0) > 0).sort((a, b) => b.ppPct - a.ppPct);
  const divPPRank = hasST ? divSortedByPP.findIndex((t) => t.teamId === id) + 1 : 0;
  const sortedByPK = [...allStandings].filter((t) => (t.pkPct || 0) > 0).sort((a, b) => b.pkPct - a.pkPct);
  const leaguePKRank = hasST ? sortedByPK.findIndex((t) => t.teamId === id) + 1 : 0;
  const divSortedByPK = [...divTeams].filter((t) => (t.pkPct || 0) > 0).sort((a, b) => b.pkPct - a.pkPct);
  const divPKRank = hasST ? divSortedByPK.findIndex((t) => t.teamId === id) + 1 : 0;

  // ── 9: Season Arc ───────────────────────────────────────────────────────────
  const CHUNK = 3;
  const seasonArc = [];
  for (let i = 0; i < teamGames.length; i += CHUNK) {
    const chunk = teamGames.slice(i, i + CHUNK);
    if (!chunk.length) break;
    const gf = chunk.reduce((s, g) => s + (matchCity(g.homeTeam, city) ? g.homeScore : g.visitingScore), 0) / chunk.length;
    const ga = chunk.reduce((s, g) => s + (matchCity(g.homeTeam, city) ? g.visitingScore : g.homeScore), 0) / chunk.length;
    seasonArc.push({
      label: `G${i + 1}–${i + chunk.length}`,
      gf: parseFloat(gf.toFixed(1)),
      ga: parseFloat(ga.toFixed(1)),
    });
  }

  // ── 10: Regulation Win % ────────────────────────────────────────────────────
  const rwPct = standing.w > 0 ? (standing.regulationWins / standing.w) * 100 : 0;
  const divRwSorted = [...divTeams]
    .map((t) => ({ teamId: t.teamId, rwPct: t.w > 0 ? (t.regulationWins / t.w) * 100 : 0 }))
    .sort((a, b) => b.rwPct - a.rwPct);
  const rwDivRank = divRwSorted.findIndex((t) => t.teamId === id) + 1;
  const rwLabel =
    rwPct >= 60 ? "Dominant Closer" :
    rwPct >= 40 ? "Regulation Team" :
    rwPct >= 25 ? "Overtime Dependent" : "Lives in OT";

  return {
    divTeams, rank,
    // playoff
    isClinched, isEliminated, playoffStatus, magicNumber, ptsBack1st, ptsBack4th, clinchedText,
    // trend
    pctTrend, trendDir,
    // h2h
    h2h,
    // pim
    hasPim, pimPerGame, pimDivRank, pimLeagueRank, leagueAvgPim, pimLabel,
    // home ice
    homeStats, roadStats, divAvgHomePct, divAvgRoadPct, leagueAvgHomePct, leagueAvgRoadPct, homeDiff, homeAdvLabel,
    // defense + offense
    gaPerGame, gfPerGame, leagueAvgGA, leagueAvgGF, leagueGARank, divGARank, leagueGFRank, divGFRank,
    leagueTotalTeams: allStandings.length, divTotalTeams: divTeams.length,
    // special teams
    hasST, leagueAvgPP, leagueAvgPK, leaguePPRank, divPPRank, leaguePKRank, divPKRank,
    // season arc
    seasonArc,
    // reg wins
    rwPct, rwDivRank, rwLabel,
  };
}

// Derives team data from the static JSON files (no backend needed)
export function useTeam(teamId) {
  const id = teamId ? parseInt(teamId) : null;

  const standings = useStandings();
  const scores    = useScores();

  const data = (standings.data && scores.data) ? (() => {
    const team = TEAMS[id];
    if (!team) return null;

    const standing = standings.data.standings?.find((s) => s.teamId === id) || null;

    const city = team.city.toLowerCase();
    const recentScores = (scores.data.scores || []).filter((s) => {
      return (s.homeTeam || "").toLowerCase().includes(city) ||
             (s.visitingTeam || "").toLowerCase().includes(city);
    }).slice(0, 10);

    return {
      team,
      standing,
      recentScores,
      scrapedAt: standings.data.scrapedAt,
    };
  })() : null;

  return {
    data,
    isLoading: standings.isLoading || scores.isLoading,
    error: standings.error || scores.error,
  };
}

export function useTeamStats(teamId) {
  const { data: standingsData } = useStandings();
  const { data: scoresData }    = useScores();
  const id = teamId ? parseInt(teamId) : null;
  const data = (standingsData && id) ? computeTeamStats(id, standingsData, scoresData) : null;
  return { data };
}

export function useUpcoming() {
  return useQuery({
    queryKey: ["upcoming"],
    queryFn: api.upcoming,
    staleTime: STALE,
  });
}

export function useScorebar() {
  const query = useQuery({
    queryKey: ["scorebar"],
    queryFn: api.scorebar,
    staleTime: 20 * 1000,
    refetchInterval: (query) => {
      const games = query.state.data?.games;
      if (!games?.length) return false;
      const isLive = (g) => g.period && !/Final/i.test(g.status) &&
        !((g.clock === "00:00" || g.clock === "20:00") && g.period === "1st");
      if (games.some(isLive)) return 15 * 1000;
      // Check how soon the next pregame game starts
      const upcoming = games.filter((g) => !isLive(g) && !/^Final/.test(g.status));
      if (!upcoming.length) return false;
      const TZ = { EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7 };
      let soonestMs = Infinity;
      for (const g of upcoming) {
        if (!g.gameTime || !g.date) continue;
        const m = g.gameTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!m) continue;
        let h = parseInt(m[1]);
        if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
        const off = TZ[(g.timezone || "").toUpperCase()] ?? -4;
        const dateStr = /^\d{4}-/.test(g.date) ? g.date + "T12:00:00" : g.date;
        const gameDate = new Date(dateStr);
        const gameUtc = Date.UTC(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate(), h - off, parseInt(m[2]));
        soonestMs = Math.min(soonestMs, gameUtc - Date.now());
      }
      if (soonestMs < 15 * 60 * 1000) return 60 * 1000;
      // Sleep until 15 min before the next game, then re-evaluate
      const sleepMs = Math.max(soonestMs - 15 * 60 * 1000, 60 * 1000);
      return Math.min(sleepMs, 30 * 60 * 1000);
    },
    refetchOnWindowFocus: true,
  });

  const games = query.data?.games || [];
  const isLive = games.some((g) => g.period && !/^Final/.test(g.status));

  return { ...query, isLive };
}

export function usePlayer(playerId) {
  return useQuery({
    queryKey: ["player", playerId],
    queryFn: () => api.player(playerId),
    enabled: !!playerId,
    staleTime: STALE,
  });
}

// Fetches last-5-game boxscores for two teams and aggregates per-player stats.
// Returns { team1: [...top3], team2: [...top3], isLoading }
export function useScoresStatic() {
  return useQuery({
    queryKey: ["scoresStatic"],
    queryFn: api.scoresStatic,
    staleTime: STALE,
  });
}

export function useMatchupPlayers(teamId1, teamId2) {
  const { data: scoresData } = useScoresStatic();
  const scores = scoresData?.scores || [];

  const city1 = TEAMS[teamId1]?.city?.toLowerCase() || "";
  const city2 = TEAMS[teamId2]?.city?.toLowerCase() || "";

  const gameIds1 = scores
    .filter((g) => matchCity(g.homeTeam, city1) || matchCity(g.visitingTeam, city1))
    .slice(0, 5)
    .map((g) => g.gameId)
    .filter(Boolean);

  const gameIds2 = scores
    .filter((g) => matchCity(g.homeTeam, city2) || matchCity(g.visitingTeam, city2))
    .slice(0, 5)
    .map((g) => g.gameId)
    .filter(Boolean);

  const allIds = [...new Set([...gameIds1, ...gameIds2])];

  const boxscoreQueries = useQueries({
    queries: allIds.map((id) => ({
      queryKey: ["boxscore", id],
      queryFn: () => api.boxscoreStatic(id),
      staleTime: 60 * 1000,
      enabled: !!id,
      retry: 1,
    })),
  });

  const isLoading = boxscoreQueries.some((q) => q.isLoading);
  const boxscoreMap = {};
  boxscoreQueries.forEach((q) => {
    if (q.data?.gameInfo?.gameId) boxscoreMap[q.data.gameInfo.gameId] = q.data;
  });

  function aggregatePlayers(city, gameIds) {
    const playerMap = {};
    for (const gid of gameIds) {
      const bs = boxscoreMap[gid];
      if (!bs) continue;
      const isHome = matchCity(bs.gameInfo.homeTeam || "", city);
      const skaters = isHome ? bs.skaterStats?.home : bs.skaterStats?.visiting;
      if (!skaters) continue;
      for (const p of skaters) {
        if (!p.name || p.name === "Totals:" || p.name === "Team:") continue;
        if (!playerMap[p.name]) playerMap[p.name] = { name: p.name, g: 0, a: 0, pts: 0, gp: 0 };
        playerMap[p.name].g   += (p.g || 0);
        playerMap[p.name].a   += (p.a || 0);
        playerMap[p.name].pts += (p.pts || 0);
        playerMap[p.name].gp  += 1;
      }
    }
    // Top 3 players sorted by points
    const players = Object.values(playerMap).filter((p) => p.pts > 0 || p.g > 0 || p.a > 0);
    return [...players].sort((a, b) => b.pts - a.pts || b.g - a.g).slice(0, 3);
  }

  const team1Players = isLoading ? [] : aggregatePlayers(city1, gameIds1);
  const team2Players = isLoading ? [] : aggregatePlayers(city2, gameIds2);

  return { team1: team1Players, team2: team2Players, isLoading };
}

export function useHotPlayers(teamId) {
  const { data: scoresData, isLoading: scoresLoading } = useScores();
  const scores = scoresData?.scores || [];
  const id = teamId ? parseInt(teamId) : null;
  const city = TEAMS[id]?.city?.toLowerCase() || "";

  const gameIds = scores
    .filter((g) => matchCity(g.homeTeam, city) || matchCity(g.visitingTeam, city))
    .slice(0, 5)
    .map((g) => g.gameId)
    .filter(Boolean);

  const boxscoreQueries = useQueries({
    queries: gameIds.map((gid) => ({
      queryKey: ["boxscore", gid],
      queryFn: () => api.boxscoreStatic(gid),
      staleTime: STALE,
      enabled: !!gid,
      retry: 1,
    })),
  });

  const boxLoading = gameIds.length > 0 && boxscoreQueries.some((q) => q.isLoading);
  const isLoading = scoresLoading || boxLoading;
  const boxscoreMap = {};
  boxscoreQueries.forEach((q) => {
    if (q.data?.gameInfo?.gameId) boxscoreMap[q.data.gameInfo.gameId] = q.data;
  });

  if (isLoading || !city || !gameIds.length) return { hotSkaters: [], hotGoalies: [], isLoading };

  // Aggregate skaters — track games with points for streak gate
  const skaterMap = {};
  for (const gid of gameIds) {
    const bs = boxscoreMap[gid];
    if (!bs) continue;
    const isHome = matchCity(bs.gameInfo.homeTeam || "", city);
    const skaters = isHome ? bs.skaterStats?.home : bs.skaterStats?.visiting;
    if (!skaters) continue;
    for (const p of skaters) {
      if (!p.name || p.name === "Totals:" || p.name === "Team:") continue;
      if (!skaterMap[p.name]) skaterMap[p.name] = { name: p.name, g: 0, a: 0, pts: 0, gp: 0, plusMinus: 0, pointGames: 0 };
      skaterMap[p.name].g += (p.g || 0);
      skaterMap[p.name].a += (p.a || 0);
      skaterMap[p.name].pts += (p.pts || 0);
      skaterMap[p.name].plusMinus += (p.plusMinus || 0);
      skaterMap[p.name].gp += 1;
      if ((p.pts || 0) > 0) skaterMap[p.name].pointGames += 1;
    }
  }
  // Streak gate: must have a point in 3+ of their games, min 3 GP
  // Hot score: (goals × 1.5 + assists) / gamesPlayed
  const hotSkaters = Object.values(skaterMap)
    .filter((p) => p.gp >= 3 && p.pointGames >= 3)
    .map((p) => ({ ...p, hotScore: (p.g * 1.5 + p.a) / p.gp }))
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 3);

  // Aggregate goalies
  const goalieMap = {};
  for (const gid of gameIds) {
    const bs = boxscoreMap[gid];
    if (!bs) continue;
    const isHome = matchCity(bs.gameInfo.homeTeam || "", city);
    const goalies = isHome ? bs.goalieStats?.home : bs.goalieStats?.visiting;
    if (!goalies) continue;
    for (const g of goalies) {
      if (!g.name || g.name === "Totals:" || g.name === "Team:") continue;
      if (!goalieMap[g.name]) goalieMap[g.name] = { name: g.name, gp: 0, saves: 0, ga: 0, shotsAgainst: 0 };
      goalieMap[g.name].gp += 1;
      goalieMap[g.name].saves += (g.saves || 0);
      goalieMap[g.name].ga += (g.ga || 0);
      goalieMap[g.name].shotsAgainst += (g.shotsAgainst || 0);
    }
  }
  const hotGoalies = Object.values(goalieMap)
    .filter((g) => g.gp >= 2 && g.shotsAgainst > 0)
    .map((g) => ({
      ...g,
      svPct: g.shotsAgainst > 0 ? g.saves / g.shotsAgainst : 0,
      gaa: g.gp > 0 ? g.ga / g.gp : 0,
    }))
    .filter((g) => g.svPct >= 0.9)
    .sort((a, b) => b.svPct - a.svPct)
    .slice(0, 2);

  return { hotSkaters, hotGoalies, isLoading };
}
