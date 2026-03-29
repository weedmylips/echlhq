# Live Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live game scores with LIVE badges, period/clock display, and adaptive auto-polling to the Dashboard scores strip and Team Page recent games.

**Architecture:** New `useScorebar()` hook with adaptive polling (30s live / 5min pre-game / stopped when all final). Dashboard merges scorebar games into existing scores strip sorted live-first. Team Page shows live game as first item in Recent Games. Existing `ScoreChip` component enhanced with live/pre-game rendering paths.

**Tech Stack:** React 18, TanStack React Query, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-29-live-scoreboard-design.md`

---

### Task 1: Add `useScorebar()` hook

**Files:**
- Modify: `client/src/hooks/useECHL.js:1-6` (imports + constants area) and append new hook after line 351

- [ ] **Step 1: Add the `useScorebar` hook to useECHL.js**

Add after the `useUpcoming` function (after line 351):

```javascript
export function useScorebar() {
  const query = useQuery({
    queryKey: ["scorebar"],
    queryFn: api.scorebar,
    staleTime: 20 * 1000,
    refetchInterval: (query) => {
      const games = query.state.data?.games;
      if (!games?.length) return false;
      const hasLive = games.some(
        (g) => g.period && !/^Final/.test(g.status)
      );
      if (hasLive) return 30 * 1000;
      const hasUpcoming = games.some(
        (g) => !g.period && !/^Final/.test(g.status)
      );
      if (hasUpcoming) return 5 * 60 * 1000;
      return false;
    },
    refetchOnWindowFocus: true,
  });

  const games = query.data?.games || [];
  const isLive = games.some((g) => g.period && !/^Final/.test(g.status));

  return { ...query, isLive };
}
```

Key decisions:
- `staleTime: 20s` — slightly under the 30s poll interval so data is considered fresh between polls
- `refetchInterval` receives the query object and inspects `query.state.data.games`
- A game is "live" if it has a `period` value AND `status` does not start with "Final"
- A game is "upcoming" if it has no `period` AND `status` does not start with "Final"
- Returns `isLive` convenience boolean alongside standard React Query fields

- [ ] **Step 2: Verify the hook exports correctly**

Run the dev server and check the browser console for import errors:

```bash
cd client && npm run dev
```

Open `http://localhost:5173` — no errors in console means the export is wired correctly (the hook isn't called yet, just exported).

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useECHL.js
git commit -m "feat: add useScorebar hook with adaptive polling"
```

---

### Task 2: Add LIVE badge CSS styles

**Files:**
- Modify: `client/src/pages/Dashboard.css:160-170` (after `.chip-status` block)

- [ ] **Step 1: Add live chip styles to Dashboard.css**

Insert after the `.chip-status` block (after line 170):

```css
/* ── Live game chip ── */
.score-chip.chip-live {
  border-color: rgba(239, 68, 68, 0.3);
}

.score-chip.chip-live:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.5);
}

.chip-status-live {
  display: flex;
  align-items: center;
  gap: 6px;
}

.live-badge {
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
  animation: live-pulse 2s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.chip-period {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary, #ccc);
}

.chip-pregame-time {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Dashboard.css
git commit -m "feat: add live scorechip CSS styles and pulse animation"
```

---

### Task 3: Enhance ScoreChip for live and pre-game games

**Files:**
- Modify: `client/src/pages/Dashboard.jsx:178-216` (ScoreChip component)

- [ ] **Step 1: Add a helper function to classify game status**

Insert above the `ScoreChip` function (before line 178):

```javascript
function getGameType(game) {
  if (game.period && !/^Final/.test(game.status)) return "live";
  if (!game.period && !/^Final/.test(game.status)) return "pregame";
  return "final";
}

function formatLiveStatus(game) {
  if (game.intermission) {
    return `${game.period} INT`;
  }
  if (game.clock) {
    return `${game.period} · ${game.clock}`;
  }
  return game.period;
}
```

- [ ] **Step 2: Update ScoreChip to handle all three game types**

Replace the entire `ScoreChip` function (lines 178-216) with:

```javascript
function ScoreChip({ game, onClick }) {
  const awayTeam = findTeamByName(game.visitingTeam);
  const homeTeam = findTeamByName(game.homeTeam);
  const gameType = getGameType(game);
  const isLive = gameType === "live";
  const isPregame = gameType === "pregame";

  // Scorebar uses visitingGoals/homeGoals; scores use visitingScore/homeScore
  const awayScore = game.visitingScore ?? game.visitingGoals;
  const homeScore = game.homeScore ?? game.homeGoals;

  return (
    <button
      className={`score-chip${isLive ? " chip-live" : ""}`}
      onClick={onClick}
      disabled={!game.gameId}
    >
      <div className="chip-content">
        <div className="chip-team chip-away">
          {awayTeam?.logoUrl ? (
            <img src={awayTeam.logoUrl} alt="" className="chip-logo" />
          ) : (
            <div className="chip-logo-placeholder">{game.visitingTeam[0]}</div>
          )}
          <div className="chip-score-box">
            <span className="chip-score">
              {isPregame ? "–" : awayScore}
            </span>
            <span className="chip-abbr">
              {awayTeam?.abbr || game.visitingCode || game.visitingTeam}
            </span>
          </div>
        </div>

        <div className="chip-vs">vs</div>

        <div className="chip-team chip-home">
          {homeTeam?.logoUrl ? (
            <img src={homeTeam.logoUrl} alt="" className="chip-logo" />
          ) : (
            <div className="chip-logo-placeholder">{game.homeTeam[0]}</div>
          )}
          <div className="chip-score-box">
            <span className="chip-score">
              {isPregame ? "–" : homeScore}
            </span>
            <span className="chip-abbr">
              {homeTeam?.abbr || game.homeCode || game.homeTeam}
            </span>
          </div>
        </div>
      </div>

      {isLive ? (
        <div className="chip-status chip-status-live">
          <span className="live-badge">LIVE</span>
          <span className="chip-period">{formatLiveStatus(game)}</span>
        </div>
      ) : isPregame ? (
        <div className="chip-status">
          <span className="chip-pregame-time">
            {game.gameTime || game.time || "TBD"}{game.timezone ? ` ${game.timezone}` : ""}
          </span>
        </div>
      ) : (
        <div className="chip-status">
          Final{game.overtime ? ` (${game.overtime})` : ""}
        </div>
      )}
    </button>
  );
}
```

Key changes from original:
- Reads `visitingGoals`/`homeGoals` (scorebar shape) OR `visitingScore`/`homeScore` (scores shape) via `??`
- Uses `visitingCode`/`homeCode` as fallback abbr (scorebar provides these)
- Pre-game shows `–` instead of scores
- Live shows pulsing LIVE badge + period/clock
- Final rendering unchanged

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat: enhance ScoreChip for live and pre-game game states"
```

---

### Task 4: Wire scorebar into Dashboard scores strip

**Files:**
- Modify: `client/src/pages/Dashboard.jsx:1-64` (imports, hook calls, scores section)

- [ ] **Step 1: Add useScorebar import**

Update the import on line 4:

```javascript
import { useScores, useUpcoming, useLeaders, useScorebar } from "../hooks/useECHL.js";
```

- [ ] **Step 2: Call useScorebar and merge games**

After line 24 (`const leaders = leadersData?.leaders || {};`), add:

```javascript
const { data: scorebarData } = useScorebar();
const scorebarGames = scorebarData?.games || [];

// Merge: live games first, then pre-game, then recent finals
// De-dupe: if a scorebar game has the same gameId as a score, prefer scorebar (fresher)
const scorebarIds = new Set(scorebarGames.map((g) => g.gameId));
const dedupedScores = scores.filter((g) => !scorebarIds.has(g.gameId));
const mergedGames = [
  ...scorebarGames.filter((g) => getGameType(g) === "live"),
  ...scorebarGames.filter((g) => getGameType(g) === "pregame"),
  ...scorebarGames.filter((g) => getGameType(g) === "final"),
  ...dedupedScores,
];
```

- [ ] **Step 3: Update the scores strip to use mergedGames**

Replace the scores strip section (lines 46-64) — change `scores.map` to `mergedGames.map`, and update the section label and empty check:

```jsx
{/* ── Scores Strip ── */}
<section className="scores-section">
  <div className="section-label">Scores</div>
  {scoresLoading ? (
    <div className="loading-spinner">Loading...</div>
  ) : mergedGames.length === 0 ? (
    <p className="empty-msg">No recent scores.</p>
  ) : (
    <div className="scores-strip-wrap">
      <button className="scroll-btn scroll-btn-left" onClick={() => scroll(-1)}>&#8249;</button>
      <div className="scores-strip" ref={stripRef}>
        {mergedGames.map((g, i) => (
          <ScoreChip key={g.gameId || i} game={g} onClick={() => g.gameId && navigate(`/game/${g.gameId}`)} />
        ))}
      </div>
      <button className="scroll-btn scroll-btn-right" onClick={() => scroll(1)}>&#8250;</button>
    </div>
  )}
</section>
```

Changes from original:
- Section label changed from "Recent Scores" to "Scores" (now includes live + pre-game)
- Uses `mergedGames` instead of `scores`
- Key uses `g.gameId || i` for stable keys

- [ ] **Step 4: Verify in browser**

```bash
cd client && npm run dev
```

Open `http://localhost:5173`. The scores strip should now show scorebar games (live/pre-game first, then finals). If no games are currently live, pre-game games should appear at the front with start times. If the scorebar API returns an error, the strip gracefully falls back to only showing finals from `useScores()`.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat: wire scorebar into dashboard scores strip with live-first sorting"
```

---

### Task 5: Wire scorebar into Team Page recent games

**Files:**
- Modify: `client/src/pages/TeamPage.jsx:8` (imports) and `client/src/pages/TeamPage.jsx:69-84` (hook calls + data) and `client/src/pages/TeamPage.jsx:319-355` (recent games section)

- [ ] **Step 1: Add useScorebar to imports**

Update the import on line 8:

```javascript
import { useTeam, useStandings, useRoster, useTeamMoves, useTeamStats, useTeamPlayers, useLeaders, useUpcoming, useGameAttendance, useFightingMajors, useScorebar } from "../hooks/useECHL.js";
```

- [ ] **Step 2: Call useScorebar and filter to current team**

After line 78 (`const { data: fightingMajorsData } = useFightingMajors();`), add:

```javascript
const { data: scorebarData } = useScorebar();
```

After line 84 (`const { team, standing, recentScores } = data;`), add the live game extraction:

```javascript
const teamCity = team.city.toLowerCase();
const liveGames = (scorebarData?.games || []).filter((g) => {
  const isHome = (g.homeTeam || "").toLowerCase().includes(teamCity);
  const isAway = (g.visitingTeam || "").toLowerCase().includes(teamCity);
  if (!isHome && !isAway) return false;
  return g.period && !/^Final/.test(g.status);
});
```

- [ ] **Step 3: Inject live games at top of Recent Games list**

Replace the recent games rendering block (lines 324-354) with:

```jsx
{(liveGames.length > 0 || recentScores?.length > 0) ? (
  <div className="recent-games-list">
    {liveGames.map((game, i) => {
      const isHome = (game.homeTeam || "").toLowerCase().includes(teamCity);
      const opp = isHome ? game.visitingTeam : game.homeTeam;
      const myScore = isHome ? game.homeGoals : game.visitingGoals;
      const oppScore = isHome ? game.visitingGoals : game.homeGoals;
      const intermission = game.intermission;
      const periodDisplay = intermission
        ? `${game.period} INT`
        : game.clock
          ? `${game.period} · ${game.clock}`
          : game.period;
      return (
        <div
          key={`live-${i}`}
          className="recent-game-row"
          onClick={() => game.gameId && setSelectedGameId(game.gameId)}
          style={{ cursor: game.gameId ? "pointer" : "default" }}
        >
          <span className="live-badge" style={{
            background: "#ef4444",
            color: "#fff",
            fontSize: "9px",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "3px",
            letterSpacing: "0.5px",
            animation: "live-pulse 2s ease-in-out infinite",
          }}>LIVE</span>
          <span className="rg-loc">{isHome ? "vs" : "@"}</span>
          <span className="rg-opp">{opp}</span>
          <span className="rg-score">{myScore}–{oppScore}</span>
          <span className="rg-date" style={{ color: "var(--text-secondary, #ccc)" }}>{periodDisplay}</span>
          {game.gameId && <span className="rg-link">Box Score →</span>}
        </div>
      );
    })}
    {recentScores.map((game, i) => {
      const result  = getResult(game, team.city);
      const isHome  = (game.homeTeam || "").toLowerCase().includes(team.city.toLowerCase());
      const opp     = isHome ? game.visitingTeam : game.homeTeam;
      const myScore = isHome ? game.homeScore : game.visitingScore;
      const oppScore = isHome ? game.visitingScore : game.homeScore;
      return (
        <div
          key={i}
          className="recent-game-row"
          onClick={() => game.gameId && setSelectedGameId(game.gameId)}
          style={{ cursor: game.gameId ? "pointer" : "default" }}
        >
          <ResultBadge result={result} />
          <span className="rg-loc">{isHome ? "vs" : "@"}</span>
          <span className="rg-opp">{opp}</span>
          <span className="rg-score">
            {myScore !== undefined ? `${myScore}–${oppScore}` : "—"}
            {game.overtime ? ` (${game.overtime})` : ""}
          </span>
          <span className="rg-date">{game.date || "—"}</span>
          {game.gameId && <span className="rg-link">Box Score →</span>}
        </div>
      );
    })}
  </div>
) : (
  <p className="empty-msg" style={{ padding: "16px" }}>No recent games available.</p>
)}
```

Key decisions:
- Live games use inline styles for the LIVE badge (reuses the `@keyframes live-pulse` from Dashboard.css which is global)
- Uses `homeGoals`/`visitingGoals` (scorebar field names) not `homeScore`/`visitingScore`
- Period display replaces the date column for live games
- Final games rendering is identical to the original

- [ ] **Step 4: Add the live-pulse keyframes to TeamPage.css**

The `@keyframes live-pulse` is defined in Dashboard.css which won't be loaded on TeamPage. Add to `client/src/pages/TeamPage.css`:

```css
/* ── Live game badge animation ── */
@keyframes live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 5: Verify in browser**

```bash
cd client && npm run dev
```

Navigate to a team page (`http://localhost:5173/team/13` for Orlando). If that team has a live game, it should appear at the top of Recent Games with the LIVE badge. If no live games, the list should look identical to before.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/TeamPage.jsx client/src/pages/TeamPage.css
git commit -m "feat: show live games in team page recent games section"
```

---

### Task 6: Add static fallback for scorebar

**Files:**
- Modify: `client/src/lib/api.js:37` (scorebar entry)

- [ ] **Step 1: Change scorebar from live-only to live-with-fallback**

Currently on line 37:
```javascript
scorebar:  () => dataFetch("/api/scorebar"),
```

Change to:
```javascript
scorebar:  () => liveOrStatic("/api/scorebar", "/data/scores-live.json"),
```

This uses the existing `scores-live.json` static file as fallback, consistent with all other live endpoints. If the API is down, users still see the last snapshot instead of the scores strip breaking.

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api.js
git commit -m "feat: add static fallback for scorebar API"
```
