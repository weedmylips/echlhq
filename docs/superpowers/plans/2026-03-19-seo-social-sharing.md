# SEO & Social Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all pages shareable with rich social previews and indexable by Google — add per-page titles/OG tags, URL-based modals, Vercel middleware for social crawlers, and a sitemap.

**Architecture:** Install `react-helmet-async` for client-side meta tags. Add `/game/:gameId` and `/matchup/:v/:h/:date` routes that open modals over the Dashboard. A Vercel middleware (`client/middleware.js`) intercepts requests, fetches static JSON data, and injects OG tags into the HTML `<head>` before it reaches social media crawlers. A build script generates `sitemap.xml`.

**Tech Stack:** React 18, React Router v6, react-helmet-async, Vercel Middleware (Edge Runtime), Vite

**Spec:** `docs/superpowers/specs/2026-03-19-seo-social-sharing-design.md`

**Note:** This project has no tests or linting configured. Steps focus on implementation and manual verification.

---

## File Structure

| File | Responsibility |
|---|---|
| `client/src/main.jsx` | Wrap app in `<HelmetProvider>` |
| `client/src/App.jsx` | Add `/game/:gameId` and `/matchup/:v/:h/:date` routes |
| `client/src/pages/Dashboard.jsx` | Read URL params for modal state, navigate on modal close |
| `client/src/components/BoxScoreModal.jsx` | Add `<Helmet>` with game-specific title/OG |
| `client/src/components/MatchupModal.jsx` | Add `<Helmet>` with matchup-specific title/OG |
| `client/src/pages/StandingsPage.jsx` | Add `<Helmet>` |
| `client/src/pages/LeadersPage.jsx` | Add `<Helmet>` |
| `client/src/pages/AttendancePage.jsx` | Add `<Helmet>` |
| `client/src/pages/TeamPage.jsx` | Add `<Helmet>` with team name |
| `client/index.html` | Update default `<title>`, add fallback OG tags |
| `client/middleware.js` | New: Vercel middleware for OG tag injection |
| `scripts/generate-sitemap.js` | New: post-build sitemap generator |
| `client/public/robots.txt` | New: points to sitemap |
| `client/vercel.json` | Add middleware config if needed |
| `client/package.json` | Add `react-helmet-async`, add postbuild script |

---

### Task 1: Install react-helmet-async and set up HelmetProvider

**Files:**
- Modify: `client/package.json`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Install react-helmet-async**

Run from project root:
```bash
cd client && npm install react-helmet-async
```

- [ ] **Step 2: Wrap app in HelmetProvider in main.jsx**

In `client/src/main.jsx`, add the import and wrap the app:

```jsx
import { HelmetProvider } from "react-helmet-async";
```

Wrap the entire render tree inside `<HelmetProvider>`:

```jsx
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Update index.html with fallback OG tags**

In `client/index.html`, replace the `<title>` and add OG tags inside `<head>`:

```html
<title>ECHL Stats</title>
<meta name="description" content="ECHL hockey stats, scores, standings, and league leaders" />
<meta property="og:title" content="ECHL Stats" />
<meta property="og:description" content="ECHL hockey stats, scores, standings, and league leaders" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ECHL Stats" />
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd client && npm run dev
```

Open http://localhost:5173 and confirm the page loads with the new title "ECHL Stats" in the browser tab.

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json client/src/main.jsx client/index.html
git commit -m "feat: install react-helmet-async and add fallback OG tags"
```

---

### Task 2: Add Helmet to static pages

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`
- Modify: `client/src/pages/StandingsPage.jsx`
- Modify: `client/src/pages/LeadersPage.jsx`
- Modify: `client/src/pages/AttendancePage.jsx`

- [ ] **Step 1: Add Helmet to Dashboard**

In `client/src/pages/Dashboard.jsx`, add the import:

```jsx
import { Helmet } from "react-helmet-async";
```

Add as the first child inside the `<div className="dashboard">`:

```jsx
<Helmet>
  <title>ECHL Stats — Dashboard</title>
  <meta name="description" content="Scores, upcoming games, and league leaders" />
  <meta property="og:title" content="ECHL Stats — Dashboard" />
  <meta property="og:description" content="Scores, upcoming games, and league leaders" />
</Helmet>
```

- [ ] **Step 2: Add Helmet to StandingsPage**

In `client/src/pages/StandingsPage.jsx`, add the import and insert `<Helmet>` at the top of the returned JSX (inside the outermost container element):

```jsx
import { Helmet } from "react-helmet-async";
```

```jsx
<Helmet>
  <title>ECHL Standings 2025–26</title>
  <meta name="description" content="Full ECHL standings with playoff picture" />
  <meta property="og:title" content="ECHL Standings 2025–26" />
  <meta property="og:description" content="Full ECHL standings with playoff picture" />
</Helmet>
```

- [ ] **Step 3: Add Helmet to LeadersPage**

In `client/src/pages/LeadersPage.jsx`, same pattern:

```jsx
import { Helmet } from "react-helmet-async";
```

```jsx
<Helmet>
  <title>ECHL Leaders 2025–26</title>
  <meta name="description" content="Points, goals, assists, and goalie leaders" />
  <meta property="og:title" content="ECHL Leaders 2025–26" />
  <meta property="og:description" content="Points, goals, assists, and goalie leaders" />
</Helmet>
```

- [ ] **Step 4: Add Helmet to AttendancePage**

In `client/src/pages/AttendancePage.jsx`, same pattern:

```jsx
import { Helmet } from "react-helmet-async";
```

```jsx
<Helmet>
  <title>ECHL Attendance 2025–26</title>
  <meta name="description" content="Game-by-game attendance figures" />
  <meta property="og:title" content="ECHL Attendance 2025–26" />
  <meta property="og:description" content="Game-by-game attendance figures" />
</Helmet>
```

- [ ] **Step 5: Verify titles change per page**

Run dev server, navigate between `/`, `/standings`, `/leaders`, `/attendance`. Confirm browser tab title changes for each page.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Dashboard.jsx client/src/pages/StandingsPage.jsx client/src/pages/LeadersPage.jsx client/src/pages/AttendancePage.jsx
git commit -m "feat: add Helmet meta tags to static pages"
```

---

### Task 3: Add Helmet to TeamPage

**Files:**
- Modify: `client/src/pages/TeamPage.jsx`

- [ ] **Step 1: Add Helmet with dynamic team name**

In `client/src/pages/TeamPage.jsx`, add the import:

```jsx
import { Helmet } from "react-helmet-async";
```

The page already uses `useParams` to get `teamId` and looks up `TEAMS[teamId]`. Find where the team config is resolved (e.g., `const config = TEAMS[teamId]`) and add `<Helmet>` at the top of the returned JSX:

```jsx
<Helmet>
  <title>{config?.name || "Team"} — ECHL Stats</title>
  <meta name="description" content={`Roster, stats, and recent results for ${config?.name || "team"}`} />
  <meta property="og:title" content={`${config?.name || "Team"} — ECHL Stats`} />
  <meta property="og:description" content={`Roster, stats, and recent results for ${config?.name || "team"}`} />
</Helmet>
```

- [ ] **Step 2: Verify**

Navigate to a team page (e.g., `/team/70`). Confirm browser tab shows "Toledo Walleye — ECHL Stats".

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/TeamPage.jsx
git commit -m "feat: add Helmet meta tags to team page"
```

---

### Task 4: Add URL-based modal routes

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Dashboard.jsx`

This is the most involved task. The Dashboard currently manages modal state with `useState`. We need to convert it to URL-driven state.

- [ ] **Step 1: Add modal routes in App.jsx**

In `client/src/App.jsx`, add two new routes that point to the same `Dashboard` component. The Dashboard will read URL params to decide which modal to open:

```jsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Dashboard />} />
    <Route path="standings" element={<StandingsPage />} />
    <Route path="leaders" element={<LeadersPage />} />
    <Route path="attendance" element={<AttendancePage />} />
    <Route path="team/:teamId" element={<TeamPage />} />
    <Route path="game/:gameId" element={<Dashboard />} />
    <Route path="matchup/:visitingTeamId/:homeTeamId/:date" element={<Dashboard />} />
  </Route>
</Routes>
```

- [ ] **Step 2: Refactor Dashboard to use URL-driven modal state**

In `client/src/pages/Dashboard.jsx`:

Replace the `useState` imports with URL-aware hooks:

```jsx
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
```

Inside the `Dashboard` function, replace the state variables:

```jsx
// Replace these:
// const [selectedGameId, setSelectedGameId] = useState(null);
// const [selectedMatchup, setSelectedMatchup] = useState(null);

// With URL-driven state:
const { gameId, visitingTeamId, homeTeamId, date } = useParams();
const navigate = useNavigate();

const selectedGameId = gameId || null;
const selectedMatchup = (visitingTeamId && homeTeamId && date)
  ? { visitingTeamId: Number(visitingTeamId), homeTeamId: Number(homeTeamId), date }
  : null;
```

- [ ] **Step 3: Update ScoreChip click to navigate**

In the scores strip JSX, change the ScoreChip onClick:

```jsx
// Before:
<ScoreChip key={i} game={g} onClick={() => g.gameId && setSelectedGameId(g.gameId)} />

// After:
<ScoreChip key={i} game={g} onClick={() => g.gameId && navigate(`/game/${g.gameId}`)} />
```

- [ ] **Step 4: Update upcoming game click to navigate**

In the upcoming games JSX, change the onClick:

```jsx
// Before:
onClick={() => g.visitingTeamId && g.homeTeamId && setSelectedMatchup(g)}

// After:
onClick={() => g.visitingTeamId && g.homeTeamId && navigate(`/matchup/${g.visitingTeamId}/${g.homeTeamId}/${encodeURIComponent(g.date)}`)}
```

- [ ] **Step 5: Update modal onClose to navigate back**

Update the BoxScoreModal rendering:

```jsx
{selectedGameId && (
  <BoxScoreModal gameId={selectedGameId} onClose={() => navigate("/")} />
)}
```

Update the MatchupModal rendering. Since `selectedMatchup` no longer has `time` from the URL, we need to find it from the upcoming data:

```jsx
{selectedMatchup && (() => {
  const upcomingGame = upcomingGames.find(
    (g) => g.visitingTeamId === selectedMatchup.visitingTeamId
      && g.homeTeamId === selectedMatchup.homeTeamId
      && g.date === selectedMatchup.date
  );
  return (
    <MatchupModal
      visitingTeamId={selectedMatchup.visitingTeamId}
      homeTeamId={selectedMatchup.homeTeamId}
      date={selectedMatchup.date}
      time={upcomingGame?.time || ""}
      onClose={() => navigate("/")}
    />
  );
})()}
```

- [ ] **Step 6: Verify modal URL behavior**

1. Navigate to `/`. Click a score chip → URL should change to `/game/XXXXX` and modal opens.
2. Press back → URL returns to `/`, modal closes.
3. Copy the URL `/game/XXXXX` and paste in a new tab → Dashboard loads with modal open.
4. Click an upcoming game → URL changes to `/matchup/XX/XX/YYYY-MM-DD` and matchup modal opens.
5. Close the modal → URL returns to `/`.

- [ ] **Step 7: Commit**

```bash
git add client/src/App.jsx client/src/pages/Dashboard.jsx
git commit -m "feat: add URL-based modal routes for box scores and matchups"
```

---

### Task 5: Add Helmet to BoxScoreModal

**Files:**
- Modify: `client/src/components/BoxScoreModal.jsx`

- [ ] **Step 1: Add Helmet with dynamic game data**

In `client/src/components/BoxScoreModal.jsx`, add the import:

```jsx
import { Helmet } from "react-helmet-async";
```

Inside the `BoxScoreModal` component, after `data` is available, add a `<Helmet>` inside the modal (before the modal-header div). Build the title from `data.gameInfo`:

```jsx
{data && (
  <Helmet>
    <title>
      {data.gameInfo.visitingTeam} {data.gameInfo.finalScore?.visiting ?? ""}, {data.gameInfo.homeTeam} {data.gameInfo.finalScore?.home ?? ""} — Box Score{data.gameInfo.date ? ` · ${data.gameInfo.date}` : ""}
    </title>
    <meta name="description" content={`Period scoring, skater stats, goalie stats — ${data.gameInfo.visitingTeam} vs ${data.gameInfo.homeTeam}`} />
    <meta property="og:title" content={`${data.gameInfo.visitingTeam} ${data.gameInfo.finalScore?.visiting ?? ""}, ${data.gameInfo.homeTeam} ${data.gameInfo.finalScore?.home ?? ""} — Box Score`} />
    <meta property="og:description" content={`Period scoring, skater stats, goalie stats — ${data.gameInfo.visitingTeam} vs ${data.gameInfo.homeTeam}`} />
  </Helmet>
)}
```

Place this just inside the `<div className="modal">` element, before `<div className="modal-header">`.

- [ ] **Step 2: Verify**

Navigate to `/game/24471`. Confirm browser tab shows something like "Bloomington 3, Iowa 2 — Box Score".

- [ ] **Step 3: Commit**

```bash
git add client/src/components/BoxScoreModal.jsx
git commit -m "feat: add Helmet meta tags to box score modal"
```

---

### Task 6: Add Helmet to MatchupModal

**Files:**
- Modify: `client/src/components/MatchupModal.jsx`

- [ ] **Step 1: Add Helmet with dynamic matchup data**

In `client/src/components/MatchupModal.jsx`, add the import:

```jsx
import { Helmet } from "react-helmet-async";
```

The component already has `visitingConfig` and `homeConfig` (from `TEAMS`). Add `<Helmet>` inside the `<div className="modal matchup-modal">`, before the modal-header:

```jsx
<Helmet>
  <title>{visitingConfig?.city || "Away"} vs {homeConfig?.city || "Home"} Matchup Preview{date ? ` · ${date}` : ""}</title>
  <meta name="description" content={`${visitingConfig?.name || "Away"} (${visiting?.w ?? 0}-${visiting?.l ?? 0}-${visiting?.otl ?? 0}) vs ${homeConfig?.name || "Home"} (${home?.w ?? 0}-${home?.l ?? 0}-${home?.otl ?? 0}) — H2H record, special teams, players to watch`} />
  <meta property="og:title" content={`${visitingConfig?.city || "Away"} vs ${homeConfig?.city || "Home"} Matchup Preview`} />
  <meta property="og:description" content={`${visitingConfig?.name || "Away"} vs ${homeConfig?.name || "Home"} — H2H record, special teams, players to watch`} />
</Helmet>
```

- [ ] **Step 2: Verify**

Navigate to a matchup URL. Confirm browser tab shows something like "Toledo vs Kalamazoo Matchup Preview · Mar 21".

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MatchupModal.jsx
git commit -m "feat: add Helmet meta tags to matchup modal"
```

---

### Task 7: Create Vercel middleware for OG tag injection

**Files:**
- Create: `client/middleware.js`

This is the middleware that injects OG tags into the raw HTML for social media crawlers and link previews. It runs on every page request before the SPA loads.

- [ ] **Step 1: Create the team config map**

The middleware needs a minimal team config map. Extract the data from `client/src/config/teamConfig.js`. The map should be `{ [teamId]: { name, city, abbr } }`.

- [ ] **Step 2: Write the middleware**

Create `client/middleware.js`:

**Important:** Vercel middleware for non-Next.js projects uses the `@vercel/edge` package. The middleware must fetch `/index.html` explicitly (not `fetch(request)`, which would cause an infinite loop). Install the helper:

```bash
cd client && npm install @vercel/edge
```

```js
const TEAMS = {
  74: { name: "Adirondack Thunder", city: "Adirondack", abbr: "ADK" },
  66: { name: "Allen Americans", city: "Allen", abbr: "ALN" },
  10: { name: "Atlanta Gladiators", city: "Atlanta", abbr: "ATL" },
  107: { name: "Bloomington Bison", city: "Bloomington", abbr: "BLM" },
  5: { name: "Cincinnati Cyclones", city: "Cincinnati", abbr: "CIN" },
  8: { name: "Florida Everblades", city: "Florida", abbr: "FLA" },
  60: { name: "Fort Wayne Komets", city: "Fort Wayne", abbr: "FW" },
  108: { name: "Greensboro Gargoyles", city: "Greensboro", abbr: "GSO" },
  52: { name: "Greenville Swamp Rabbits", city: "Greenville", abbr: "GVL" },
  11: { name: "Idaho Steelheads", city: "Idaho", abbr: "IDH" },
  65: { name: "Indy Fuel", city: "Indy", abbr: "IND" },
  98: { name: "Iowa Heartlanders", city: "Iowa", abbr: "IA" },
  79: { name: "Jacksonville Icemen", city: "Jacksonville", abbr: "JAX" },
  53: { name: "Kalamazoo Wings", city: "Kalamazoo", abbr: "KAL" },
  56: { name: "Kansas City Mavericks", city: "Kansas City", abbr: "KC" },
  101: { name: "Maine Mariners", city: "Maine", abbr: "MNE" },
  63: { name: "Norfolk Admirals", city: "Norfolk", abbr: "NOR" },
  13: { name: "Orlando Solar Bears", city: "Orlando", abbr: "ORL" },
  85: { name: "Rapid City Rush", city: "Rapid City", abbr: "RC" },
  55: { name: "Reading Royals", city: "Reading", abbr: "REA" },
  97: { name: "Savannah Ghost Pirates", city: "Savannah", abbr: "SAV" },
  50: { name: "South Carolina Stingrays", city: "South Carolina", abbr: "SC" },
  109: { name: "Tahoe Knight Monsters", city: "Tahoe", abbr: "TAH" },
  70: { name: "Toledo Walleye", city: "Toledo", abbr: "TOL" },
  103: { name: "Trois-Rivières Lions", city: "Trois-Rivières", abbr: "TR" },
  72: { name: "Tulsa Oilers", city: "Tulsa", abbr: "TUL" },
  106: { name: "Utah Grizzlies", city: "Utah", abbr: "UTA" },
  61: { name: "Wheeling Nailers", city: "Wheeling", abbr: "WHL" },
  96: { name: "Wichita Thunder", city: "Wichita", abbr: "WIC" },
  104: { name: "Worcester Railers", city: "Worcester", abbr: "WOR" },
};

const STATIC_META = {
  "/": { title: "ECHL Stats — Dashboard", desc: "Scores, upcoming games, and league leaders" },
  "/standings": { title: "ECHL Standings 2025–26", desc: "Full ECHL standings with playoff picture" },
  "/leaders": { title: "ECHL Leaders 2025–26", desc: "Points, goals, assists, and goalie leaders" },
  "/attendance": { title: "ECHL Attendance 2025–26", desc: "Game-by-game attendance figures" },
};

function buildOgTags(title, desc, url) {
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="ECHL Stats" />`,
  ].join("\n    ");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const config = {
  matcher: [
    "/",
    "/standings",
    "/leaders",
    "/attendance",
    "/team/:path*",
    "/game/:path*",
    "/matchup/:path*",
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip non-page requests (static files, data, etc.)
  if (pathname.match(/\.(js|css|png|jpg|svg|ico|json|webmanifest|txt|xml)$/)) {
    return;
  }

  let title = null;
  let desc = null;

  // Static pages
  if (STATIC_META[pathname]) {
    title = STATIC_META[pathname].title;
    desc = STATIC_META[pathname].desc;
  }

  // Team page: /team/:teamId
  const teamMatch = pathname.match(/^\/team\/(\d+)$/);
  if (teamMatch) {
    const team = TEAMS[teamMatch[1]];
    if (team) {
      title = escapeHtml(`${team.name} — ECHL Stats`);
      desc = escapeHtml(`Roster, stats, and recent results for ${team.name}`);
    }
  }

  // Box score: /game/:gameId
  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch) {
    try {
      const dataUrl = new URL(`/data/boxscores/${gameMatch[1]}.json`, request.url);
      const res = await fetch(dataUrl);
      if (res.ok) {
        const data = await res.json();
        const gi = data.gameInfo;
        const vScore = gi.finalScore?.visiting ?? "";
        const hScore = gi.finalScore?.home ?? "";
        title = escapeHtml(`${gi.visitingTeam} ${vScore}, ${gi.homeTeam} ${hScore} — Box Score`);
        desc = escapeHtml(`Period scoring, skater stats, goalie stats — ${gi.visitingTeam} vs ${gi.homeTeam}`);
      }
    } catch {
      // Fall through to default
    }
  }

  // Matchup: /matchup/:visitingTeamId/:homeTeamId/:date
  const matchupMatch = pathname.match(/^\/matchup\/(\d+)\/(\d+)\/(.+)$/);
  if (matchupMatch) {
    const vTeam = TEAMS[matchupMatch[1]];
    const hTeam = TEAMS[matchupMatch[2]];
    const date = decodeURIComponent(matchupMatch[3]);
    if (vTeam && hTeam) {
      title = escapeHtml(`${vTeam.city} vs ${hTeam.city} Matchup Preview · ${date}`);
      desc = escapeHtml(`${vTeam.name} vs ${hTeam.name} — H2H record, special teams, players to watch`);
    }
  }

  // If no meta found, let the request pass through unchanged
  if (!title) return;

  // Fetch index.html explicitly (NOT fetch(request) — that causes infinite loops)
  const indexUrl = new URL("/index.html", request.url);
  const response = await fetch(indexUrl);
  const html = await response.text();

  const ogTags = buildOgTags(title, desc, url.href);

  // Replace existing title and inject OG tags
  const modifiedHtml = html
    .replace(/<title>[^<]*<\/title>/, "")
    .replace("</head>", `    ${ogTags}\n  </head>`);

  return new Response(modifiedHtml, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
```

**Note:** The fetch to `/data/boxscores/:gameId.json` works because it's fetching a static file by absolute URL — it does not re-trigger the middleware (the matcher only matches page routes, not `.json` files). The fetch to `/index.html` also does not re-trigger the middleware because the matcher doesn't include `/index.html`.

- [ ] **Step 3: Verify middleware locally (optional)**

Vercel middleware can be tested with `vercel dev` if the Vercel CLI is installed:

```bash
cd client && npx vercel dev
```

Or deploy to a preview branch and test with `curl`:

```bash
curl -s https://your-preview-url.vercel.app/game/24471 | head -20
```

Look for the OG tags in the `<head>`.

- [ ] **Step 4: Commit**

```bash
git add client/middleware.js
git commit -m "feat: add Vercel middleware for OG tag injection"
```

---

### Task 8: Create sitemap generator and robots.txt

**Files:**
- Create: `scripts/generate-sitemap.js`
- Create: `client/public/robots.txt`
- Modify: `client/package.json` (add postbuild script)

- [ ] **Step 1: Create robots.txt**

Create `client/public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://echlhq.com/sitemap.xml
```

Note: Replace `echlhq.com` with the actual production domain.

- [ ] **Step 2: Create the sitemap generator script**

Create `scripts/generate-sitemap.js`:

```js
import { readdir } from "fs/promises";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://echlhq.com"; // Update with actual domain

const TEAM_IDS = [
  74, 66, 10, 107, 5, 8, 60, 108, 52, 11, 65, 98, 79, 53, 56,
  101, 63, 13, 85, 55, 97, 50, 109, 70, 103, 72, 106, 61, 96, 104,
];

async function generateSitemap() {
  const urls = [];
  const today = new Date().toISOString().split("T")[0];

  // Static pages
  for (const path of ["/", "/standings", "/leaders", "/attendance"]) {
    urls.push({ loc: `${SITE_URL}${path}`, changefreq: "daily", priority: path === "/" ? "1.0" : "0.8" });
  }

  // Team pages
  for (const id of TEAM_IDS) {
    urls.push({ loc: `${SITE_URL}/team/${id}`, changefreq: "daily", priority: "0.7" });
  }

  // Box score pages
  const boxscoreDir = join(__dirname, "..", "client", "public", "data", "boxscores");
  try {
    const files = await readdir(boxscoreDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const gameId = file.replace(".json", "");
        urls.push({ loc: `${SITE_URL}/game/${gameId}`, changefreq: "never", priority: "0.5" });
      }
    }
  } catch {
    console.warn("No boxscores directory found, skipping game URLs");
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  const outPath = join(__dirname, "..", "client", "dist", "sitemap.xml");
  await writeFile(outPath, xml, "utf-8");
  console.log(`Sitemap written to ${outPath} (${urls.length} URLs)`);
}

generateSitemap().catch(console.error);
```

- [ ] **Step 3: Add postbuild script to client/package.json**

In `client/package.json`, update the scripts section:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build && node ../scripts/generate-sitemap.js",
  "preview": "vite preview"
}
```

- [ ] **Step 4: Verify sitemap generation**

```bash
cd client && npm run build
```

Then check the output:
```bash
cat client/dist/sitemap.xml | head -20
```

Confirm it lists static pages, team pages, and game pages.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-sitemap.js client/public/robots.txt client/package.json
git commit -m "feat: add sitemap generator and robots.txt"
```

---

### Task 9: Final verification and cleanup

- [ ] **Step 1: Run full build**

```bash
cd client && npm run build
```

Confirm no errors.

- [ ] **Step 2: Test with preview server**

```bash
cd client && npm run preview
```

Navigate to:
- `/` — title: "ECHL Stats — Dashboard"
- `/standings` — title: "ECHL Standings 2025–26"
- `/team/70` — title: "Toledo Walleye — ECHL Stats"
- `/game/24471` — title should show game score
- Click a score chip — URL should change to `/game/XXXXX`
- Close modal — URL returns to `/`
- Paste a `/game/XXXXX` URL directly — modal opens over dashboard

- [ ] **Step 3: Check sitemap and robots.txt**

Visit `http://localhost:4173/robots.txt` and `http://localhost:4173/sitemap.xml` — both should be served correctly.
