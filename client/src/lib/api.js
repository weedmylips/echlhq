const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function dataFetch(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Data fetch error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  standings: () => dataFetch("/data/standings.json"),
  leaders:   () => dataFetch("/data/leaders.json"),
  scores:    () => dataFetch("/data/scores.json"),
  boxscore:  (gameId) => dataFetch(`/data/boxscores/${gameId}.json`),
  roster:    (teamId) => dataFetch(`/data/rosters/${teamId}.json`),
  teamMoves: (teamId) => dataFetch(`/data/team-moves/${teamId}.json`),
  // team endpoint still hits the API if available, else falls back gracefully
  team:      (teamId) => apiFetch(`/team/${teamId}`),
  health:    () => apiFetch("/health"),
};
