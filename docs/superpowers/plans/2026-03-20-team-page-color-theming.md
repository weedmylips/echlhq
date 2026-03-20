# Team Page Color Theming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply team-branded color theming to the team page — tinted card headers, secondary-colored header accents, corrected color data.

**Architecture:** CSS custom properties (`--team-primary`, `--team-secondary`, plus two derived `-light` variants) are set on `.team-page` root and consumed via `color-mix()` throughout. All styling uses CSS where possible; inline styles removed from JSX.

**Tech Stack:** React 18, Vite, CSS (no preprocessor), `color-mix(in srgb, ...)` for opacity blending.

**Spec:** `docs/superpowers/specs/2026-03-20-team-page-color-theming-design.md`

---

### Task 1: Move CSS variables to `.team-page` root and remove `.team-header` inline style

**Files:**
- Modify: `client/src/pages/TeamPage.jsx:134` (`.team-page` root div)
- Modify: `client/src/pages/TeamPage.jsx:142-148` (`.team-header` div — remove inline style)

- [ ] **Step 1: Add CSS variables as inline style on `.team-page` root div**

At line 134, change:
```jsx
<div className="team-page">
```
to:
```jsx
<div className="team-page" style={{
  "--team-primary": team.primaryColor || "#1a6aff",
  "--team-secondary": team.secondaryColor || "#ff8c00",
  "--team-primary-light": `color-mix(in srgb, ${team.primaryColor || "#1a6aff"} 60%, #ffffff)`,
  "--team-secondary-light": `color-mix(in srgb, ${team.secondaryColor || "#ff8c00"} 60%, #ffffff)`,
}}>
```

- [ ] **Step 2: Remove inline style from `.team-header`**

At lines 142-148, change:
```jsx
<div
  className="team-header"
  style={{
    "--team-primary": team.primaryColor || "#333",
    "--team-secondary": team.secondaryColor || "#555",
    borderColor: team.primaryColor || "#333",
  }}
>
```
to:
```jsx
<div className="team-header">
```

- [ ] **Step 3: Update `.team-header` CSS for border-top**

In `client/src/pages/TeamPage.css` line 12, change:
```css
border-top: 3px solid var(--team-primary, #3b82f6);
```
to:
```css
border-top: 4px solid var(--team-primary, #3b82f6);
```

- [ ] **Step 4: Visually verify**

Run: `cd client && npm run dev`

Open any team page (e.g. `/team/74`). Confirm:
- The 4px top border uses the team's primary color
- The rest of the header border is the default `var(--border)` gray (not team-colored on all sides)
- No visual regressions elsewhere on the page

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TeamPage.jsx client/src/pages/TeamPage.css
git commit -m "refactor: move team color CSS variables to .team-page root"
```

---

### Task 2: Update header gradient to use both primary and secondary colors

**Files:**
- Modify: `client/src/pages/TeamPage.jsx:150-153` (`.team-header-accent` inline style)

- [ ] **Step 1: Update the gradient inline style**

At lines 150-153, change:
```jsx
<div
  className="team-header-accent"
  style={{ background: `linear-gradient(135deg, ${team.primaryColor}55 0%, transparent 60%)` }}
/>
```
to:
```jsx
<div
  className="team-header-accent"
  style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${team.primaryColor} 28%, transparent) 0%, color-mix(in srgb, ${team.secondaryColor} 8%, transparent) 50%, transparent 100%)` }}
/>
```

- [ ] **Step 2: Visually verify**

Check a few team pages with contrasting color combos:
- Orlando Solar Bears (`/team/13`) — purple + orange
- Norfolk Admirals (`/team/63`) — navy + gold
- Fort Wayne Komets (`/team/60`) — orange + black

Confirm the gradient shows a subtle two-tone blend fading to transparent.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/TeamPage.jsx
git commit -m "feat: update header gradient to blend primary and secondary team colors"
```

---

### Task 3: Style division badge and streak badge with secondary color

**Files:**
- Modify: `client/src/pages/TeamPage.jsx:170-175` (`.division-badge` — remove inline style)
- Modify: `client/src/pages/TeamPage.css:66-75` (`.division-badge` — add secondary color rules)
- Modify: `client/src/pages/TeamPage.css:578-581` (add `.team-header .streak-badge` override)

- [ ] **Step 1: Remove inline style from division badge in JSX**

At lines 170-175, change:
```jsx
<span
  className="division-badge"
  style={{ borderColor: team.primaryColor, color: "var(--text)" }}
>
  {team.division || "—"}
</span>
```
to:
```jsx
<span className="division-badge">
  {team.division || "—"}
</span>
```

- [ ] **Step 2: Add secondary color rules to `.division-badge` in CSS**

In `client/src/pages/TeamPage.css`, after the existing `.division-badge` block (line 75), add:

```css
.team-page .division-badge {
  border-color: color-mix(in srgb, var(--team-secondary) 55%, transparent);
  background: color-mix(in srgb, var(--team-secondary) 18%, transparent);
  color: var(--team-secondary-light);
}
```

- [ ] **Step 3: Add streak badge override scoped to `.team-header`**

In `client/src/pages/TeamPage.css`, after line 581 (the `.streak-badge.streak-ot` rule), add:

```css
.team-header .streak-badge {
  background: color-mix(in srgb, var(--team-secondary) 20%, transparent);
  color: var(--team-secondary-light);
  border: 1px solid color-mix(in srgb, var(--team-secondary) 40%, transparent);
}
```

- [ ] **Step 4: Visually verify**

Check several team pages. Confirm:
- Division badge shows secondary color (border, background tint, text)
- Streak badge (W3, L2, etc.) uses secondary color — no longer green/red
- Game result badges elsewhere on the page still use green/red semantic colors

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TeamPage.jsx client/src/pages/TeamPage.css
git commit -m "feat: style division and streak badges with team secondary color"
```

---

### Task 4: Theme card headers with primary color tint

**Files:**
- Modify: `client/src/pages/TeamPage.css:240-246` (`.card-header` — add background + border)
- Modify: `client/src/pages/TeamPage.css:236-238` (`.section-label` color)
- Modify: `client/src/pages/TeamPage.css:248-254` (`.see-all-link` color)

- [ ] **Step 1: Add primary color tint to `.card-header`**

In `client/src/pages/TeamPage.css`, replace the existing `.card-header` block (lines 240-246):
```css
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3a3a3a;
}
```
with:
```css
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3a3a3a;
}

.team-page .card-header {
  background: color-mix(in srgb, var(--team-primary) 14%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--team-primary) 22%, transparent);
}
```

- [ ] **Step 2: Update section label color**

Replace the existing `.section-card .section-label` block (lines 236-238):
```css
.section-card .section-label {
  color: var(--text-secondary);
}
```
with:
```css
.section-card .section-label {
  color: var(--text-secondary);
}

.team-page .card-header .section-label {
  color: var(--team-primary-light);
}
```

- [ ] **Step 3: Update "see all" link color**

Replace the existing `.team-page .see-all-link` block (lines 248-254):
```css
.team-page .see-all-link {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
}
.team-page .see-all-link:hover { color: var(--text-secondary); }
```
with:
```css
.team-page .see-all-link {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
}
.team-page .card-header .see-all-link {
  color: var(--team-secondary-light);
}
.team-page .see-all-link:hover { color: var(--text-secondary); }
```

- [ ] **Step 4: Visually verify**

Check team pages. Confirm:
- All card headers (Recent Games, Special Teams, Upcoming, etc.) have a subtle primary-color tinted background
- Section label text (card header titles) is lightened primary color
- "See all →" links in card headers use the secondary color
- Cards outside the team page (e.g., dashboard) are NOT affected

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TeamPage.css
git commit -m "feat: theme card headers with team primary color tint"
```

---

### Task 5: Add rank badges to SpecialTeamsCard

**Files:**
- Modify: `client/src/pages/TeamPage.jsx:804-806` (PP rank line)
- Modify: `client/src/pages/TeamPage.jsx:836-838` (PK rank line)
- Modify: `client/src/pages/TeamPage.css` (add `.rank-badge` rule near `.st-ranks`)

- [ ] **Step 1: Restructure PP rank line into span elements**

At lines 804-806, change:
```jsx
<div className="st-ranks">
  Div: {ordinal(divPPRank)} · League: {ordinal(leaguePPRank)}
</div>
```
to:
```jsx
<div className="st-ranks">
  Div: <span className="rank-badge">{ordinal(divPPRank)}</span> · League: <span className="rank-badge">{ordinal(leaguePPRank)}</span>
</div>
```

- [ ] **Step 2: Restructure PK rank line into span elements**

At lines 836-838, change:
```jsx
<div className="st-ranks">
  Div: {ordinal(divPKRank)} · League: {ordinal(leaguePKRank)}
</div>
```
to:
```jsx
<div className="st-ranks">
  Div: <span className="rank-badge">{ordinal(divPKRank)}</span> · League: <span className="rank-badge">{ordinal(leaguePKRank)}</span>
</div>
```

- [ ] **Step 3: Add `.rank-badge` CSS rule**

In `client/src/pages/TeamPage.css`, after the `.st-ranks` block (around line 1231), add:

```css
.team-page .rank-badge {
  display: inline-block;
  background: color-mix(in srgb, var(--team-primary) 25%, transparent);
  color: var(--team-primary-light);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}
```

- [ ] **Step 4: Visually verify**

Check a team page with the Special Teams card visible. Confirm:
- PP and PK rank values (e.g., "3rd", "5th") appear as small pills with primary-color tint
- The "Div:" and "League:" text labels remain unchanged

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TeamPage.jsx client/src/pages/TeamPage.css
git commit -m "feat: add rank badge styling to special teams card"
```

---

### Task 6: Final cross-team visual verification

**Files:** None (verification only)

- [ ] **Step 1: Check diverse color palettes**

Run: `cd client && npm run dev`

Visit these team pages to verify colors look correct across different palettes:
- `/team/13` — Orlando Solar Bears (purple `#582C83` + orange `#FC4C02`)
- `/team/63` — Norfolk Admirals (navy `#00205B` + gold `#FFC72C`)
- `/team/97` — Savannah Ghost Pirates (green `#44D62C` + black `#010101`)
- `/team/98` — Iowa Heartlanders (yellow `#FFD100` + black `#010101`)
- `/team/107` — Bloomington Bison (light blue `#5BC2E7` + red `#C8102E`)
- `/team/109` — Tahoe Knight Monsters (teal `#006271` + gold `#B9975B`)

For each, confirm:
1. Header gradient blends both colors subtly
2. Division badge uses secondary color
3. Streak badge uses secondary color (not semantic green/red)
4. Card headers have a visible primary-color tint
5. Card label text is readable (lightened primary)
6. "See all" links use secondary color
7. Progress bars remain green/red/amber (NOT team-colored)
8. Charts still use primary color for lines/bars

- [ ] **Step 2: Check that non-team pages are unaffected**

Visit `/`, `/standings`, `/leaders`. Confirm no color leaks from the team-page CSS variables.

- [ ] **Step 3: Final commit if any polish needed**

If any small adjustments were required, commit them:
```bash
git add -A
git commit -m "fix: polish team color theming after cross-team review"
```
