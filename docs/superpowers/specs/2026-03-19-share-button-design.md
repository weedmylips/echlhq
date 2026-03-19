# Share Button Feature — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add a reusable ShareButton component to make it easy to share box scores, matchups, team pages, and standings. Uses the Web Share API on supported platforms (mobile), falls back to copy-to-clipboard on desktop.

**Out of scope:** Leaders page and Attendance page — these can be added later if desired.

## ShareButton Component

**Location:** `client/src/components/ShareButton.jsx` + `ShareButton.css`

**Props:**
- `title` (string) — text for Web Share API's `title` and `text` params

**URL handling:** Always use `window.location.href` — no manual URL construction needed. React Router already puts the correct shareable URL in the address bar for all four placements (modals navigate to `/game/:id` and `/matchup/...`, pages are at `/team/:id` and `/standings`).

**Behavior:**
1. On click, check `navigator.share` availability
2. If available → `navigator.share({ url: window.location.href, title, text: title })`
3. If not → copy URL to clipboard via `navigator.clipboard.writeText()`, with fallback to `document.execCommand('copy')` + temporary textarea if clipboard API is unavailable
4. On clipboard copy, show "Copied!" state (checkmark icon) for 1.5 seconds
5. If clipboard copy fails, show brief "Failed" error state
6. Clean up the 1.5s timeout on component unmount

**Accessibility:**
- `aria-label="Share"` on the button (updates to "Link copied" during Copied state)
- Use `aria-live="polite"` region for the state change announcement

**Visual style:**
- 28×28px icon button matching existing modal close button style
- Background: `rgba(255,255,255,0.06)`, same hover states as close button
- Inline SVG share icon (no icon library)
- "Copied!" state swaps to a checkmark SVG

## Placement

### Box Score Modal (`BoxScoreModal.jsx`)
- In the modal header, to the left of the close (×) button
- Title: e.g., "Thunder 4, Royals 2 — Box Score" (from `data.gameInfo.visitingTeam`, `homeTeam`, `finalScore`)
- Show button always (URL works from route params); use generic "ECHL Box Score" title until data loads

### Matchup Modal (`MatchupModal.jsx`)
- In the modal header, to the left of the close (×) button
- Title: e.g., "Thunder vs. Royals — Matchup Preview" (from team config lookups on the route params)
- Show button always; use generic "ECHL Matchup Preview" title until data loads

### Team Page (`TeamPage.jsx`)
- In the team header area, near the team name
- Title: e.g., "Adirondack Thunder — ECHL Stats"

### Standings Page (`StandingsPage.jsx`)
- In the page header
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

**No routing, hook, or data changes required.** OG tags are already handled by Helmet + Vercel middleware.
