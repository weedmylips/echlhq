# SEO & Social Sharing Design

## Problem

The site has no per-page titles, meta descriptions, or Open Graph tags. Modals (box score, matchup preview) are state-driven with no URL — they can't be shared or indexed. Social media crawlers (Discord, Twitter, iMessage) don't render JavaScript, so even if meta tags are added in React, social share previews show the generic site title.

## Decisions

- **Modal URL strategy**: Hybrid routes + modal overlay (dedicated URLs that open as modals over the dashboard)
- **Social sharing**: Edge middleware injects OG tags into raw HTML (no Puppeteer, no build-time pre-rendering)
- **OG image strategy**: Text-only cards (title + description, no generated images)
- **Hosting**: Vercel (middleware available)

## Design

### 1. URL Structure

New routes in React Router:

| Route | Component behavior |
|---|---|
| `/game/:gameId` | Dashboard + BoxScoreModal open |
| `/matchup/:visitingTeamId/:homeTeamId/:date` | Dashboard + MatchupModal open |

Navigation behavior:
- Direct navigation to `/game/2026020123` loads the Dashboard with BoxScoreModal pre-opened
- Clicking a score chip on the dashboard navigates to `/game/:gameId` (URL updates, modal opens)
- Closing the modal navigates back to `/`
- Browser back button closes the modal naturally

Implementation:
- Add the two new `<Route>` entries in `App.jsx` pointing to a wrapper component (e.g., `DashboardWithModal`) or use the existing `Dashboard` with `useParams` to detect modal state from the URL
- `Dashboard` reads `:gameId` or matchup params from the URL; if present, opens the corresponding modal
- Modal `onClose` calls `navigate("/")` instead of just clearing state

### 2. Meta Tag System

Install `react-helmet-async`. Wrap the app in `<HelmetProvider>` in `main.jsx`.

Each page/modal route sets its own `<Helmet>` with `<title>`, `<meta name="description">`, and Open Graph tags:

| Route | `<title>` | `<meta description>` |
|---|---|---|
| `/` | ECHL Stats — Dashboard | Scores, upcoming games, and league leaders |
| `/standings` | ECHL Standings 2025–26 | Full ECHL standings with playoff picture |
| `/leaders` | ECHL Leaders 2025–26 | Points, goals, assists, and goalie leaders |
| `/attendance` | ECHL Attendance 2025–26 | Game-by-game attendance figures |
| `/team/:teamId` | {Team Name} — ECHL Stats | Roster, stats, and recent results for {Team Name} |
| `/game/:gameId` | {Away} {awayScore}, {Home} {homeScore} — Box Score · {date} | Period scoring, skater stats, goalie stats |
| `/matchup/:v/:h/:date` | {Away} vs {Home} Matchup Preview · {date} | H2H record, special teams, players to watch |

OG tags set per page:
- `og:title` — same as `<title>`
- `og:description` — same as meta description
- `og:url` — canonical URL for the page
- `og:type` — `website`
- `og:site_name` — `ECHL Stats`

### 3. Edge Middleware

A single edge function handles OG tag injection for social media crawlers. It runs on every HTML page request.

**File location:** `middleware.ts` at project root (Vercel middleware convention)

**Logic:**

1. Parse the incoming URL path
2. Match against known route patterns:
   - `/game/:gameId` → fetch `/data/boxscores/:gameId.json`, extract teams/scores/date
   - `/matchup/:v/:h/:date` → fetch `/data/standings.json`, look up team records by ID
   - `/team/:teamId` → resolve team name from a hardcoded team config map (no fetch needed)
   - `/`, `/standings`, `/leaders`, `/attendance` → use static defaults
3. Build title and description strings from the fetched data
4. Read the `index.html` response
5. Replace `<title>ECHL Dashboard</title>` with the dynamic title
6. Insert OG meta tags into `<head>` (before `</head>`)
7. Return the modified response

**Fallback:** If the route doesn't match or the JSON fetch fails, serve `index.html` unchanged with default meta tags.

**Team config in edge function:** A minimal map of `{ teamId: { name, abbr, city } }` is hardcoded in the edge function. This avoids a fetch for team page titles. The map mirrors the data in `client/src/config/teamConfig.js`.

### 4. Sitemap

A Node script (`scripts/generate-sitemap.js`) runs as a post-build step.

**Included routes:**
- Static pages: `/`, `/standings`, `/leaders`, `/attendance`
- Team pages: `/team/:teamId` for all 28 teams (from teamConfig)
- Box score pages: `/game/:gameId` — enumerated by listing files in `client/public/data/boxscores/`

**Excluded:**
- Matchup pages (`/matchup/...`) — future games that change daily

**Output:** `client/dist/sitemap.xml`

**robots.txt:** Add `Sitemap: https://echlhq.com/sitemap.xml` (or the actual domain) to `client/public/robots.txt`.

## Files Changed

| File | Change |
|---|---|
| `client/src/main.jsx` | Wrap app in `<HelmetProvider>` |
| `client/src/App.jsx` | Add `/game/:gameId` and `/matchup/:v/:h/:date` routes |
| `client/src/pages/Dashboard.jsx` | Read URL params, open modal from URL, navigate on close |
| `client/src/components/BoxScoreModal.jsx` | Add `<Helmet>` with dynamic title/OG tags |
| `client/src/components/MatchupModal.jsx` | Add `<Helmet>` with dynamic title/OG tags |
| `client/src/pages/StandingsPage.jsx` | Add `<Helmet>` |
| `client/src/pages/LeadersPage.jsx` | Add `<Helmet>` |
| `client/src/pages/AttendancePage.jsx` | Add `<Helmet>` |
| `client/src/pages/TeamPage.jsx` | Add `<Helmet>` with team-specific title |
| `client/index.html` | Update default `<title>` and add fallback OG tags |
| `middleware.ts` | New: Vercel middleware for OG injection |
| `scripts/generate-sitemap.js` | New: sitemap generator |
| `client/public/robots.txt` | New: points to sitemap |
| `package.json` | Add `react-helmet-async` dependency, add postbuild script |

## Implementation Notes

- **Hosting target**: Vercel (middleware runs at the edge before static file serving)
- **Team config duplication**: The middleware hardcodes a minimal team map. A build script can extract this from `teamConfig.js` to prevent drift — but manual sync is acceptable for 28 static teams.
- **SPA routing**: A `vercel.json` with rewrites (`{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`) is required so that `/game/:gameId` and `/matchup/...` don't 404 on direct navigation. The middleware runs before rewrites.

## Out of Scope

- Dynamic OG images (generated PNGs per game/team)
- Server-side rendering
- Puppeteer-based pre-rendering
- Structured data / schema.org markup (can be added later)
