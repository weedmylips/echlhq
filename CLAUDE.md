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

This is a **mostly static frontend** — most data is pre-generated JSON served from `client/public/data/`. A small set of Vercel API routes proxy HockeyTech for live game data only.

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

### Vercel API routes (`api/`)

A few endpoints proxy the HockeyTech API via Vercel serverless functions for **live/near-real-time data only**. These use `liveOrStatic()` in `client/src/lib/api.js` which tries the API first and falls back to static JSON on error.

| Route | Purpose | Cache |
|-------|---------|-------|
| `/api/scorebar` | Live game scores, periods, clocks | 2min |
| `/api/scores` | Recent completed game scores | via HT |
| `/api/upcoming` | Upcoming schedule | via HT |
| `/api/boxscores/:gameId` | Individual game boxscores | via HT |

**Important:** Roster, leaders, standings, players, and attendance are **static only** — they do NOT use API routes. Do not add API routes for these; the scraper-generated static files are the source of truth. Previous attempts to use API routes for roster/leaders data caused persistent bugs with player badges and multi-team stat handling.

Shared HockeyTech helpers live in `api/lib/hockeytech.js`. The API key is stored in Vercel env vars (`HOCKEYTECH_API_KEY`). Routes are mapped in `vercel.json`.

### Frontend (`client/`)

- **React 18 + Vite**, React Router v6, TanStack React Query, Recharts, vite-plugin-pwa (PWA support)
- Routes: `/` Dashboard, `/standings`, `/leaders`, `/team/:teamId`, `/attendance`
- All data fetching is in `client/src/hooks/useECHL.js` — custom hooks using React Query with 6-hour stale time (matching scraper cadence)
- All derived/computed stats (playoff picture, H2H records, trend data, special teams ranks) are computed client-side in `useECHL.js` from the raw JSON — not pre-computed in the data files
- Team config (IDs, names, colors, divisions, city names for score matching) lives in `client/src/config/teamConfig.js`

### Key data sources on the frontend

| Hook | Source |
|------|--------|
| `useStandings()` | `standings.json` (static, daily scrape) |
| `useLeaders()` | `leaders.json` (static, daily scrape) |
| `useScores()` | `/api/scores` → `scores.json` fallback |
| `useUpcoming()` | `/api/upcoming` → `upcoming.json` fallback |
| `useScorebar()` | `/api/scorebar` → `scores-live.json` fallback (polls 30s live, 5min idle) |
| `useRoster(teamId)` | `rosters/{teamId}.json` (static, daily transactions) |
| `useTeamPlayers(teamId)` | `players/{teamId}.json` (static, daily scrape) |
| `useTeamMoves(teamId)` | `team-moves/{teamId}.json` (static, daily transactions) |
| `useBoxscore(gameId)` | `/api/boxscores/{id}` → `boxscores/{id}.json` fallback |
| `useFightingMajors()` | `fighting-majors.json` (static, daily scrape) |
| `useGameAttendance()` | `game-attendance.json` (static, daily scrape) |
| `useTeam(teamId)` | computed from standings + scores |
| `useTeamStats(teamId)` | computed from standings + scores |
| `useMatchupPlayers(id1, id2)` | aggregated from last-5 boxscores |

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

### Live scorebar (Dashboard)

The dashboard scores strip merges data from two sources: the live scorebar API and the static scores file. Games are ordered: live → pregame → final (by date desc) → historical (capped at 30). Date separator labels appear between game groups.

Key game type classification in `getGameType()`:
- **Live**: has `period` set, clock not at 00:00 (or period is not 1st/3rd/OT/SO at 00:00)
- **Pregame**: `period === "1st"` with `clock === "00:00"` (HockeyTech pre-populates these), or no `period`
- **Final**: status starts with "Final", OR `clock === "00:00"` with period `3rd`/`OT`/`SO`

Pregame score chips open the matchup preview modal; live/final chips open the boxscore modal. The scorebar date format (`"2026-03-29"`) must be converted to `"Mar 29, 2026"` to match the upcoming game dates used by the matchup modal.

Today's upcoming games display "Today" instead of the day name and have a highlighted card border. Upcoming games are truncated to the first 2 days with a "Show More" button.

### Sticky table columns (mobile scroll)

Standings and other tables use `position: sticky` on rank and team columns. Sticky cells must use **opaque** backgrounds (use `color-mix(in srgb, …)` to blend tint with `--bg-card: #1a1a1a`) — semi-transparent `rgba` backgrounds cause scrolling columns to bleed through on mobile.
