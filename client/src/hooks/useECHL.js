import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

// staleTime matches backend TTLs
export function useStandings() {
  return useQuery({
    queryKey: ["standings"],
    queryFn: api.standings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaders() {
  return useQuery({
    queryKey: ["leaders"],
    queryFn: api.leaders,
    staleTime: 15 * 60 * 1000,
  });
}

export function useScores() {
  return useQuery({
    queryKey: ["scores"],
    queryFn: api.scores,
    staleTime: 15 * 60 * 1000,
  });
}

export function useBoxscore(gameId) {
  return useQuery({
    queryKey: ["boxscore", gameId],
    queryFn: () => api.boxscore(gameId),
    enabled: !!gameId,
    staleTime: 60 * 1000,
  });
}

export function useTeam(teamId) {
  return useQuery({
    queryKey: ["team", teamId],
    queryFn: () => api.team(teamId),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}
