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
    }).slice(0, 5);

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
