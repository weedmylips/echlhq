# Share Button Feature — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add a reusable ShareButton component to make it easy to share box scores, matchups, team pages, and standings. Uses the Web Share API on supported platforms (mobile), falls back to copy-to-clipboard on desktop.

## ShareButton Component

**Location:** `client/src/components/ShareButton.jsx` + `ShareButton.css`

**Props:**
- `url` (string) — full URL to share; defaults to `window.location.href`
- `title` (string) — text for Web Share API's `title` param

**Behavior:**
1. On click, check `navigator.share` availability
2. If available → `navigator.share({ url, title })`
3. If not → `navigator.clipboard.writeText(url)`
4. On clipboard copy, show "Copied!" state (checkmark icon) for 1.5 seconds

**Visual style:**
- 28×28px icon button matching existing modal close button style
- Background: `rgba(255,255,255,0.06)`, same hover states as close button
- Inline SVG share icon (no icon library)
- "Copied!" state swaps to a checkmark SVG

## Placement

### Box Score Modal (`BoxScoreModal.jsx`)
- In the modal header, to the left of the close (×) button
- URL: `window.location.origin + /game/${gameId}`
- Title: e.g., "Thunder 4, Royals 2 — Box Score"

### Matchup Modal (`MatchupModal.jsx`)
- In the modal header, to the left of the close (×) button
- URL: `window.location.origin + /matchup/${visitingTeamId}/${homeTeamId}/${encodeURIComponent(date)}`
- Title: e.g., "Thunder vs. Royals — Matchup Preview"

### Team Page (`TeamPage.jsx`)
- In the team header area, near the team name
- URL: `window.location.origin + /team/${teamId}`
- Title: e.g., "Adirondack Thunder — ECHL Stats"

### Standings Page (`StandingsPage.jsx`)
- In the page header
- URL: `window.location.origin + /standings`
- Title: "ECHL Standings"

## Technical Details

**No new dependencies.** Browser APIs only (`navigator.share`, `navigator.clipboard`).

**Files to create:**
- `client/src/components/ShareButton.jsx`
- `client/src/components/ShareButton.css`

**Files to modify:**
- `client/src/components/BoxScoreModal.jsx` — add ShareButton to modal header
- `client/src/components/MatchupModal.jsx` — add ShareButton to modal header
- `client/src/pages/TeamPage.jsx` — add ShareButton to team header
- `client/src/pages/StandingsPage.jsx` — add ShareButton to page header

**URL construction:** `window.location.origin + path` — no hardcoded domain.

**No routing, hook, or data changes required.** OG tags are already handled by Helmet + Vercel middleware.
