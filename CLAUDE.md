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

# Manual/one-time scripts
node scripts/backfill-boxscores.js    # fill missing boxscore JSON from scores.json
node scripts/compute-fighting-majors.js  # recompute fight stats (--reset to rebuild all)
node scripts/backfill.js              # probe HockeyTech IDs to rebuild full season
node scripts/scrape-season.js         # alternative season-wide scraper (START_ID/END_ID env vars)
```

There are no test or lint commands configured.

## Architecture

This is a **fully static frontend** — no backend API is needed at runtime. All data is pre-generated JSON served from `client/public/data/`.

### Data pipeline (automated via GitHub Actions)

Two scheduled workflows update the static JSON files and auto-commit:

1. **`scrape.yml`** (daily, 10:30 UTC / 6:30am ET) — runs `scripts/scrape.js`:
   - Fetches the ECHL daily report HTML from leaguestat.com
   - Writes `standings.json`, `scores.json`, `leaders.json`, `meta.json`
   - Writes `players/{teamId}.json` (per-player stats + `isActive`/`isRookie` flags)
   - Writes `boxscores/{gameId}.json` (detailed game stats); keeps last 20 per team
   - Also runs `compute-fighting-majors.js` (with `--reset`) and `backfill-boxscores.js` first

2. **`transactions.yml`** (daily, 22:00 UTC / 6pm ET) — runs `scripts/agent-transactions.js`:
   - Fetches ECHL transaction posts and parses them via the **Anthropic Claude API** (`ANTHROPIC_API_KEY`)
   - Updates `rosters/{teamId}.json` (player status: active, ir, reserve, loaned, suspended, etc.)
   - Writes `team-moves/{teamId}.json` (transaction history, last 20 moves per team)

### Frontend (`client/`)

- **React 18 + Vite**, React Router v6, TanStack React Query, Recharts, vite-plugin-pwa (PWA support)
- Routes: `/` Dashboard, `/standings`, `/leaders`, `/team/:teamId`, `/attendance`
- All data fetching is in `client/src/hooks/useECHL.js` — custom hooks using React Query with 6-hour stale time (matching scraper cadence)
- All derived/computed stats (playoff picture, H2H records, trend data, special teams ranks) are computed client-side in `useECHL.js` from the raw JSON — not pre-computed in the data files
- Team config (IDs, names, colors, divisions, city names for score matching) lives in `client/src/config/teamConfig.js`

### Key data sources on the frontend

| Hook | Data file(s) |
|------|-------------|
| `useStandings()` | `standings.json` |
| `useLeaders()` | `leaders.json` |
| `useScores()` | `scores.json` |
| `useUpcoming()` | `upcoming.json` |
| `useRoster(teamId)` | `rosters/{teamId}.json` |
| `useTeamPlayers(teamId)` | `players/{teamId}.json` |
| `useTeamMoves(teamId)` | `team-moves/{teamId}.json` |
| `useBoxscore(gameId)` | `boxscores/{gameId}.json` (60s stale, retry once) |
| `useFightingMajors()` | `fighting-majors.json` |
| `useGameAttendance()` | `game-attendance.json` |
| `useTeam(teamId)` | computed from standings + scores |
| `useTeamStats(teamId)` | computed from standings + scores (via `computeTeamStats()`) |
| `useMatchupPlayers(id1, id2)` | aggregated from last-5 boxscores for two teams |

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

### Suspension tracking

Suspensions are parsed from ECHL news posts (regex-based). Fields tracked per player: `suspensionGamesRemaining`, `suspensionGamesOriginal`, `suspensionGpAtStart`. Auto-expired when elapsed games equals original games. Suspension status is protected — reserve placements do not overwrite an active suspension.

### Boxscore pruning & fighting majors

`scrape.js` keeps only the last 20 boxscores per team to save disk space. `compute-fighting-majors.js` maintains a persistent `processedGames` set so fight counts survive pruning. Run with `--reset` to recompute from all existing boxscores on disk.

### Playoff logic (client-side)

Computed in `StandingsPage.jsx` and `useTeamStats()`:
- Clinched: rank ≤ 4 AND max possible 5th-place pts < current team pts
- Eliminated: rank > 4 AND max possible pts < 4th-place pts
- Magic number: `maxFifthPts - team.pts + 1`
- Display values: `X` = clinched, `E` = eliminated, `—` = not applicable

### Sticky table columns (mobile scroll)

Standings and other tables use `position: sticky` on rank and team columns. Sticky cells must use **opaque** backgrounds (use `color-mix(in srgb, …)` to blend tint with `--bg-card: #1a1a1a`) — semi-transparent `rgba` backgrounds cause scrolling columns to bleed through on mobile.
