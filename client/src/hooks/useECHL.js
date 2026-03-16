import { useQuery } from "@tanstack/react-query";
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

export function useScores() {
  return useQuery({
    queryKey: ["scores"],
    queryFn: api.scores,
    staleTime: STALE,
  });
}

export function useBoxscore(gameId) {
  return useQuery({
    queryKey: ["boxscore", gameId],
    queryFn: () => api.boxscore(gameId),
    enabled: !!gameId,
    staleTime: 60 * 1000,
    retry: 1,
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
  const fourthPts    = divTeams[3]?.pts ?? 0;
  const firstPts     = divTeams[0]?.pts ?? 0;
  const maxFifthPts  = fifthPlace ? fifthPlace.pts + (fifthPlace.gamesRemaining || 0) * 2 : 0;
  const maxOurPts    = standing.pts + (standing.gamesRemaining || 0) * 2;
  const isClinched   = rank <= 4 && (!fifthPlace || standing.pts > maxFifthPts);
  const isEliminated = rank > 4 && maxOurPts < fourthPts;
  const ptsBack4th   = Math.max(0, fourthPts - standing.pts);
  const ptsBack1st   = Math.max(0, firstPts - standing.pts);
  const magicNumber  = isClinched ? 0 : fifthPlace
    ? Math.max(0, maxFifthPts - standing.pts + 1) : 0;
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
      let w = 0, l = 0;
      games.forEach((g) => {
        const isHome  = matchCity(g.homeTeam, city);
        const myScore = isHome ? g.homeScore : g.visitingScore;
        const oppScore = isHome ? g.visitingScore : g.homeScore;
        if (myScore > oppScore) w++; else l++;
      });
      return { teamId: opp.teamId, teamName: opp.teamName, logoUrl: opp.logoUrl, w, l, gp: games.length };
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
  const homeDiff = homeStats && roadStats ? homeStats.pct - roadStats.pct : 0;
  const homeAdvLabel =
    homeDiff > 0.10 ? "Home Team" :
    homeDiff < -0.10 ? "Road Warriors" : "Balanced";

  // ── 7: Defensive Efficiency ─────────────────────────────────────────────────
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
    homeStats, roadStats, divAvgHomePct, divAvgRoadPct, homeDiff, homeAdvLabel,
    // defense
    gaPerGame, gfPerGame, leagueAvgGA, leagueAvgGF, leagueGARank, divGARank,
    leagueTotalTeams: allStandings.length, divTotalTeams: divTeams.length,
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
