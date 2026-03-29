# Live Scoreboard — Design Spec

## Overview

Add live game scores with LIVE badges, period/clock display, and auto-polling to the Dashboard and Team pages. Pure frontend feature — the `/api/scorebar` endpoint and `api.scorebar()` client function already exist.

## Data Layer

### New hook: `useScorebar()`

Location: `client/src/hooks/useECHL.js`

Calls `api.scorebar()` via React Query with adaptive polling:

| Condition | `refetchInterval` |
|-----------|-------------------|
| Any game is live (has period, not final) | 30s |
| No live games, but pre-game/upcoming games exist | 5min (300,000ms) |
| All games final, or no games at all | `false` (stop polling) |

Returns the scorebar data plus a convenience `isLive` boolean derived from the response.

### Live detection

A game is considered "live" when it has a `period` value and its `status` is not `"Final"`. The scorebar API provides `status`, `period`, `clock`, and `intermission` fields.

### Scorebar API response shape (per game)

```json
{
  "gameId": "12345",
  "homeTeamId": 13, "homeTeam": "Orlando Solar Bears", "homeCode": "ORL", "homeGoals": 3,
  "visitingTeamId": 50, "visitingTeam": "South Carolina Stingrays", "visitingCode": "SC", "visitingGoals": 2,
  "period": "2nd", "clock": "12:45", "status": "In Progress", "intermission": false,
  "date": "2026-03-29", "gameTime": "7:00 PM", "timezone": "ET"
}
```

Team IDs are already mapped to internal IDs by the API route.

## Dashboard Integration

### Scores strip merge

`Dashboard.jsx` calls `useScorebar()` alongside existing `useScores()`. Live and pre-game games from the scorebar are merged into the horizontal scores strip with this sort order:

1. **Live games** (sorted by period progress — later periods first)
2. **Pre-game / upcoming** (sorted by start time)
3. **Recent finals** (from existing `useScores()`, sorted by date descending)

### ScoreChip enhancement

The existing inline `ScoreChip` component in `Dashboard.jsx` is enhanced to handle both final scores (from `useScores()`) and live/pre-game games (from `useScorebar()`). A `live` or `type` prop distinguishes the rendering path.

**Live game chip:**
- Subtle red border (`rgba(239, 68, 68, 0.3)`)
- Red pulsing LIVE badge (CSS `@keyframes pulse`)
- Period + clock text (e.g., `2nd · 12:45`)

**Pre-game chip:**
- No scores displayed (or `0 - 0`)
- Start time shown (e.g., `7:00 PM ET`)

### Status display mapping

| Game state | Status line |
|------------|-------------|
| In-progress | `LIVE · 2nd · 12:45` |
| Intermission | `LIVE · 2nd INT` |
| Overtime | `LIVE · OT · 3:22` |
| Pre-game | `7:00 PM ET` |
| Final | `Final` |
| Final OT | `Final (OT)` |
| Final SO | `Final (SO)` |

## Team Page Integration

### Recent Games section

`TeamPage.jsx` calls `useScorebar()` and filters the response to games involving the current team (match on `homeTeamId` or `visitingTeamId`).

If a live game exists for this team, it appears as the **first item** in the Recent Games list with the same LIVE badge treatment as the Dashboard. Same `ScoreChip` component, same visual style — no new components.

## Polling Behavior

- React Query's `refetchInterval` is set as a function that inspects the last response
- Polling only runs while the component is mounted and the browser tab is focused (React Query default)
- The 2-minute CDN cache on `/api/scorebar` means most 30s polls hit the edge — no origin cost
- When all games finish, polling stops completely until next page load

## Visual Design

- **LIVE badge:** `background: #ef4444`, white text, 9px bold, `letter-spacing: 0.5px`, 3px border-radius, pulsing animation (opacity 1→0.6→1 over 2s)
- **Live chip border:** `border: 1px solid rgba(239, 68, 68, 0.3)`
- **Period/clock text:** 11px, `color: #ccc`, separated by `·`
- **Pre-game time:** 11px, `color: #888`

## Files Changed

| File | Change |
|------|--------|
| `client/src/hooks/useECHL.js` | Add `useScorebar()` hook with adaptive polling |
| `client/src/pages/Dashboard.jsx` | Wire hook, merge live games into scores strip, enhance `ScoreChip` |
| `client/src/pages/TeamPage.jsx` | Wire hook, show live/pre-game game in Recent Games |

No new files. No backend changes. No new dependencies.
