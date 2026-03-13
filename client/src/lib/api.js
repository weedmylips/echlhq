const BASE = "/api";

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  standings: () => apiFetch("/standings"),
  leaders: () => apiFetch("/leaders"),
  scores: () => apiFetch("/scores"),
  boxscore: (gameId) => apiFetch(`/boxscore/${gameId}`),
  team: (teamId) => apiFetch(`/team/${teamId}`),
  health: () => apiFetch("/health"),
};
