# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (http://localhost:5173)
cd client && npm run dev

# Frontend production build
cd client && npm run build

# Run a scraper script directly
node scripts/scrape.js
node scripts/agent-transactions.js
node scripts/seed-rosters.js
```

There are no test or lint commands configured.

## Architecture

This is a **fully static frontend** — no backend API is needed at runtime. All data is pre-generated JSON served from `client/public/data/`.

### Data pipeline (automated via GitHub Actions)

Two scheduled workflows update the static JSON files and auto-commit:

1. **`scrape.yml`** (daily, 9:30am ET) — runs `scripts/scrape.js`:
   - Fetches the ECHL daily report HTML from leaguestat.com
   - Writes `standings.json`, `scores.json`, `leaders.json`, `meta.json`
   - Writes `players/{teamId}.json` (per-player stats + `isActive`/`isRookie` flags)
   - Writes `boxscores/{gameId}.json` (detailed game stats)

2. **`transactions.yml`** (daily, midnight UTC) — runs `scripts/agent-transactions.js`:
   - Fetches ECHL transaction posts and parses them via the **Anthropic Claude API** (`ANTHROPIC_API_KEY`)
   - Updates `rosters/{teamId}.json` (player status: active, ir, reserve, loaned, suspended, etc.)
   - Writes `team-moves/{teamId}.json` (transaction history shown on team pages)

### Frontend (`client/`)

- **React 18 + Vite**, React Router v6, TanStack React Query, Recharts
- Routes: `/` Dashboard, `/standings`, `/leaders`, `/team/:teamId`
- All data fetching is in `client/src/hooks/useECHL.js` — custom hooks using React Query with 6-hour stale time (matching scraper cadence)
- All derived/computed stats (playoff picture, H2H records, trend data, special teams ranks) are computed client-side in `useECHL.js` from the raw JSON — not pre-computed in the data files
- Team config (IDs, names, colors, divisions, city names for score matching) lives in `client/src/config/teamConfig.js`

### Key data sources on the frontend

| Hook | Data file(s) |
|------|-------------|
| `useStandings()` | `standings.json` |
| `useLeaders()` | `leaders.json` |
| `useScores()` | `scores.json` |
| `useRoster(teamId)` | `rosters/{teamId}.json` |
| `useTeamPlayers(teamId)` | `players/{teamId}.json` |
| `useTeamMoves(teamId)` | `team-moves/{teamId}.json` |
| `useBoxscore(gameId)` | `boxscores/{gameId}.json` |
| `useTeam(teamId)` | computed from standings + scores |
| `useTeamStats(teamId)` | computed from standings + scores |

### Player data split

There are **two separate data sources** for player info on the team page — they must be used together:

- `rosters/{teamId}.json` — player status (`active`, `ir`, `reserve`, `loaned`, etc.), jersey numbers, irDays, suspension info. Stats here can be stale.
- `players/{teamId}.json` — up-to-date skater/goalie stats with `isActive` and `isRookie` flags. This is the authoritative source for stat values.

When displaying stats (goals, assists, pts, SV%, etc.), always prefer `players/{teamId}.json`. Use `rosters/{teamId}.json` for status badges and roster filtering.

### `leaders.json` structure

Each category is an array of `{ rank, name, team, value, isRookie, position }`. Key keys:
- `allPoints`, `goals`, `assists` — full league skater lists (650+ entries each) used for rank lookups
- `points` — top 15 only
- `gaa`, `svPct`, `shutouts`, `goalieWins`, `soRecord` — goalie leader lists (qualifying only)

Rank badges on the team page only show when `rank <= 15`.

### Player position handling

`players/{teamId}.json` uses specific positions (`C`, `LW`, `RW`, `F`, `D`) while `rosters/{teamId}.json` uses generic `F`/`D`/`G`. When filtering forwards for display, use `position !== "D" && position !== "G"` rather than `position === "F"`.
