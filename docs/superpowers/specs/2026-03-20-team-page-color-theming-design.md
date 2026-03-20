# Team Page Color Theming — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Improve the ECHL team pages to more prominently feature each team's official colors. The current implementation applies `primaryColor` inconsistently and barely uses `secondaryColor`. This spec defines a "moderate" color treatment that adds clear team identity without overwhelming the dark-themed UI.

## Color Data

All 30 team colors have been corrected in `client/src/config/teamConfig.js`. **Already done — no code changes needed.**

## CSS Variables

The inline style that currently sets `--team-primary` and `--team-secondary` on `.team-header` in JSX is **moved to the root `.team-page` div** instead, so all descendant cards can inherit them. Two new derived variables are added at the same time:

```jsx
// On the .team-page root div:
style={{
  "--team-primary": team.primaryColor || "#1a6aff",
  "--team-secondary": team.secondaryColor || "#ff8c00",
  "--team-primary-light": `color-mix(in srgb, ${team.primaryColor || "#1a6aff"} 60%, #ffffff)`,
  "--team-secondary-light": `color-mix(in srgb, ${team.secondaryColor || "#ff8c00"} 60%, #ffffff)`,
}}
```

Fallbacks use visible colors (`#1a6aff`, `#ff8c00`) so the light-derived variables remain readable on dark backgrounds if data is missing. `color-mix(in srgb, ...)` is supported in all targeted browsers (Chrome 111+, Firefox 113+, Safari 16.2+) — no fallback needed.

**Remove** the existing inline `style` prop entirely from `.team-header` (it currently sets `--team-primary`, `--team-secondary`, and `borderColor: team.primaryColor` which overrides all four border sides). Only the top border should be team-colored — the current all-sides override is a bug this spec corrects. The top border will be handled via CSS using `var(--team-primary)`; the other three sides revert to `var(--border)` from the existing `.team-header` rule.

**Side effect check:** Charts pass `team.primaryColor` as a direct prop value (not a CSS variable), so moving the variable to `.team-page` does not affect them. The active-tab `borderBottomColor` inline style in JSX also uses `team.primaryColor` directly — leave it as-is (out of scope).

## Header

**Top border stripe** (`.team-header` in CSS): change `border-top: 3px solid` → `4px solid var(--team-primary)`.

**Background gradient** — update the inline `background` on `.team-header-accent` (the absolute-positioned overlay element):
```js
background: `linear-gradient(135deg, color-mix(in srgb, ${team.primaryColor} 28%, transparent) 0%, color-mix(in srgb, ${team.secondaryColor} 8%, transparent) 50%, transparent 100%)`
```
`transparent` here produces `rgba(0,0,0,0)` — this is intentional; the gradient fades into the dark card background.

**Division badge** (`.division-badge` in JSX): currently has inline `style={{ borderColor: team.primaryColor, color: "var(--text)" }}`. **Remove this inline style entirely.** Replace with CSS rules targeting `.division-badge`:
```css
.division-badge {
  border-color: color-mix(in srgb, var(--team-secondary) 55%, transparent);
  background: color-mix(in srgb, var(--team-secondary) 18%, transparent);
  color: var(--team-secondary-light);
}
```

**Streak badge** (`StreakBadge` component): the streak badge in the header shows the current win/loss streak (e.g. "W3", "L2"). Apply secondary color treatment regardless of win/loss direction — this is a brand accent, not a semantic indicator (unlike win/loss game result badges elsewhere on the page).

Override the existing semantic colors using the `.team-header` ancestor as a scope so no other uses are affected. Add to CSS:
```css
.team-header .streak-badge {
  background: color-mix(in srgb, var(--team-secondary) 20%, transparent);
  color: var(--team-secondary-light);
  border: 1px solid color-mix(in srgb, var(--team-secondary) 40%, transparent);
}
```
`StreakBadge` is only rendered in the header so this override has no other call sites. Game result badges (`.badge-w`, `.badge-l`, `.badge-otw`, `.badge-otl`) are unrelated and remain semantic.

**Standings pills** (`.header-standing-item`): no change — keep `rgba(255,255,255,0.15)` background.

## Navigation Tabs

Active tab `border-bottom-color: team.primaryColor` — no change, already correct.

## Section Cards

**Target:** `.card-header` elements (the header row of each card on the team page, containing a `.section-label` and optionally a `.see-all-link`).

**CSS changes to `TeamPage.css`:**

```css
/* Card header tint */
.team-page .card-header {
  background: color-mix(in srgb, var(--team-primary) 14%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--team-primary) 22%, transparent);
}

/* Section label text uses lightened primary */
.team-page .card-header .section-label {
  color: var(--team-primary-light);
}

/* "See all" link uses secondary */
.team-page .card-header .see-all-link {
  color: var(--team-secondary-light);
}
```

**Rank badges:** Target only the `SpecialTeamsCard` — the PP rank and PK rank labels (e.g. "Div: 3rd · League: 5th"). Currently these are rendered as a prose string inside a single element. Restructure them into individual `<span className="rank-badge">` elements for each ordinal value. All other cards (offensive/defensive efficiency, home ice, etc.) are out of scope for rank badge styling in this change.

Add to CSS:
```css
.team-page .rank-badge {
  background: color-mix(in srgb, var(--team-primary) 25%, transparent);
  color: var(--team-primary-light);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}
```
**Explicitly excluded:** `.rank-num` (standings table circles), playoff rank ordinals, `.league-rank-pill` in Team Leaders sidebar.

## Progress / Stat Bars

**No changes.** Bars stay semantic:
- Good: `#16a34a`
- Bad: `#dc2626`
- Mid: `#d97706`

## Files to Change

1. **`client/src/pages/TeamPage.jsx`**
   - Move `--team-primary`/`--team-secondary` inline style from `.team-header` to `.team-page` root; add `--team-primary-light`/`--team-secondary-light` to same inline style
   - Remove inline `style` prop from `.team-header` (was setting `--team-primary`, `--team-secondary`, `borderColor`)
   - Update `.team-header-accent` inline `background` to the two-color gradient string
   - Remove inline `style` from `.division-badge` (was setting `borderColor` + `color`)
   - Update `StreakBadge` to use secondary color variables
   - Add `rank-badge` className to inline rank indicator spans in card bodies

2. **`client/src/pages/TeamPage.css`**
   - `.team-header`: change `border-top` from `3px` to `4px solid var(--team-primary)`
   - Add `.team-page .card-header` background + border-bottom rules
   - Add `.team-page .card-header .section-label` color rule
   - Add `.team-page .card-header .see-all-link` color rule
   - Add `.team-page .rank-badge` rule

## What Does NOT Change

- Overall dark theme and card backgrounds
- Game result badge colors (`.badge-w`, `.badge-l`, `.badge-otw`, `.badge-otl`) — semantic green/red
- Progress bar colors — semantic green/red/amber
- Chart colors — already use `team.primaryColor` inline, no change needed
- Active tab `borderBottomColor` — already correct, leave as-is
- Standings pills — intentionally neutral white tint
- Layout, spacing, typography
