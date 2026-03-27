# echlstats.com

A fast, fully static stats site for the ECHL (East Coast Hockey League) 2025–26 season. No backend — all data is pre-generated JSON updated automatically via GitHub Actions.

**Live site:** [www.echlstats.com](https://www.echlstats.com)

## Features

- **Dashboard** — live scores strip, upcoming games, league leader sidebar
- **Standings** — division standings with playoff picture, magic numbers, sortable columns, horizontal scroll on mobile
- **Leaders** — skater leaders (20 categories) and goalie leaders (5 categories), including fighting majors
- **Team pages** — roster, stats, playoff picture, PCT trend chart, division H2H records, home/road splits, special teams ranks, season arc, recent results, transaction history
- **Attendance** — arena capacity and attendance stats across the league

## Tech Stack

- **Frontend**: React 18, Vite, React Router v6, TanStack React Query, Recharts, PWA-enabled
- **Data pipeline**: Node.js scraper scripts run on a schedule via GitHub Actions

## Local Development

```bash
cd client
npm install
npm run dev       # http://localhost:5173
npm run build     # production build
```

No backend or environment variables needed for local development — the frontend reads static JSON from `client/public/data/`.

## How Data Works

Two GitHub Actions workflows run daily and auto-commit updated JSON files:

| Workflow | Schedule | Script | Output |
|----------|----------|--------|--------|
| `scrape.yml` | 6:30am ET | `scripts/scrape.js` | `standings.json`, `scores.json`, `leaders.json`, `players/{id}.json`, `boxscores/{id}.json` |
| `transactions.yml` | 6pm ET | `scripts/agent-transactions.js` | `rosters/{id}.json`, `team-moves/{id}.json`, `suspension-state.json` |

All derived stats (playoff clinching/elimination, H2H records, efficiency ranks, trend data) are computed client-side from these raw JSON files — nothing is pre-aggregated.

## Project Structure

```
client/               React frontend (Vite)
  src/
    config/           teamConfig.js — IDs, names, colors, divisions for all 30 teams
    hooks/            useECHL.js — all React Query hooks + client-side stat computation
    pages/            Dashboard, Standings, Leaders, TeamPage, Attendance
    components/       Layout, BoxScoreModal, MatchupModal, ScoreCard, LeaderList, ShareButton
  public/data/        static JSON served at runtime

scripts/              Node.js data pipeline
  scrape.js           main daily scraper (leaguestat.com)
  agent-transactions.js  transaction parser (HTML scraping)
  seed-rosters.js     one-time roster seed from echl.com
  backfill-boxscores.js  fill missing boxscores from game IDs
  backfill-attendance.cjs  backfill attendance data
  compute-fighting-majors.js  aggregate fight stats across all boxscores
  download-logos.js   fetch team logos
  generate-sitemap.mjs  generate sitemap.xml for SEO
  scrape-season.js    alternative season-wide scraper (START_ID/END_ID env vars)

.github/workflows/
  scrape.yml          daily scraper + fighting majors + boxscore backfill
  transactions.yml    daily roster/transaction update
```

## Data Files

| File | Contents |
|------|----------|
| `standings.json` | All 30 teams: W-L-OT, PTS, PCT, GF/GA, home/road splits, PP/PK, attendance |
| `scores.json` | All final scores with OT/SO indicators and game IDs |
| `leaders.json` | Full skater lists for points/goals/assists (650+); top 15 for other categories |
| `upcoming.json` | Scheduled games with team IDs, date, and tip-off time |
| `players/{teamId}.json` | Per-player skater/goalie stats with `isActive` and `isRookie` flags |
| `rosters/{teamId}.json` | Player status (active, IR, reserve, loaned, suspended, etc.), jersey numbers |
| `boxscores/{gameId}.json` | Period scoring, skater/goalie stats, penalties, three stars |
| `team-moves/{teamId}.json` | Last 20 transactions per team |
| `fighting-majors.json` | Fighting major counts per player across all boxscores |
| `game-attendance.json` | Attendance averages, totals, and sellout counts per arena |
| `meta.json` | Scraper metadata (last update timestamp, season info) |
| `penalty-stats.json` | Aggregated penalty stats (minors, majors) per player |
| `suspension-state.json` | Active suspension tracking state |

## Disclaimer

echlstats.com is an independent, unofficial website operated by a third party. It is not the official website of the ECHL or any ECHL member club, and it is not affiliated with, sponsored by, endorsed by, or approved by the ECHL or any member club. ECHL and team names, logos, and related marks are used under limited license solely for identification and statistical-reference purposes. For official league and club information, users should refer to the ECHL's and applicable clubs' official websites and channels.
