# Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable ShareButton component (Web Share API + clipboard fallback) to box score modal, matchup modal, team page, and standings page.

**Architecture:** Single `ShareButton` component using `window.location.href` for URL. On click: try `navigator.share`, fall back to `navigator.clipboard.writeText`, fall back to `document.execCommand('copy')`. Visual feedback via "Copied!" checkmark state.

**Tech Stack:** React 18, browser APIs only (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-19-share-button-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `client/src/components/ShareButton.jsx` | Create | Reusable share button component |
| `client/src/components/ShareButton.css` | Create | Share button styles |
| `client/src/components/BoxScoreModal.jsx` | Modify | Add ShareButton to modal header |
| `client/src/components/MatchupModal.jsx` | Modify | Add ShareButton to modal header |
| `client/src/pages/TeamPage.jsx` | Modify | Add ShareButton to team header |
| `client/src/pages/StandingsPage.jsx` | Modify | Add ShareButton to page header |

---

### Task 1: Create ShareButton Component

**Files:**
- Create: `client/src/components/ShareButton.jsx`
- Create: `client/src/components/ShareButton.css`

- [ ] **Step 1: Create `ShareButton.jsx`**

```jsx
import { useState, useEffect, useCallback } from "react";
import "./ShareButton.css";

export default function ShareButton({ title }) {
  // "idle" | "copied" | "failed"
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(id);
  }, [state]);

  const handleClick = useCallback(async () => {
    const url = window.location.href;

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard
        if (err.name === "AbortError") return;
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // Tertiary fallback: execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setState("copied");
      } catch {
        setState("failed");
      }
    }
  }, [title]);

  const label = state === "copied" ? "Link copied" : state === "failed" ? "Failed to copy" : "Share";

  return (
    <button
      className={`share-btn${state === "failed" ? " share-btn-failed" : ""}`}
      onClick={handleClick}
      aria-label={label}
    >
      {state === "copied" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : state === "failed" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
      <span className="sr-only" aria-live="polite">{state !== "idle" ? label : ""}</span>
    </button>
  );
}
```

- [ ] **Step 2: Create `ShareButton.css`**

```css
.share-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}
.share-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text);
}
.share-btn-failed {
  color: var(--red);
}

/* Screen-reader-only text for aria-live announcements */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

- [ ] **Step 3: Verify visually**

Run: `cd client && npm run dev`
Navigate to any page — the component isn't placed yet, but confirm no build errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ShareButton.jsx client/src/components/ShareButton.css
git commit -m "feat: add ShareButton component with Web Share + clipboard fallback"
```

---

### Task 2: Add ShareButton to Box Score Modal

**Files:**
- Modify: `client/src/components/BoxScoreModal.jsx`

The modal header is at line 29-32:
```jsx
<div className="modal-header">
  <span className="modal-title">Box Score</span>
  <button className="modal-close" onClick={onClose}>✕</button>
</div>
```

- [ ] **Step 1: Add import at top of file**

After the existing imports (line 4), add:
```jsx
import ShareButton from "./ShareButton.jsx";
```

- [ ] **Step 2: Add ShareButton to modal header**

Replace the modal header block (lines 29-32) with:
```jsx
<div className="modal-header">
  <span className="modal-title">Box Score</span>
  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
    <ShareButton
      title={
        data
          ? `${data.gameInfo.visitingTeam} ${data.gameInfo.finalScore?.visiting ?? ""}, ${data.gameInfo.homeTeam} ${data.gameInfo.finalScore?.home ?? ""} — Box Score`
          : "ECHL Box Score"
      }
    />
    <button className="modal-close" onClick={onClose}>✕</button>
  </div>
</div>
```

- [ ] **Step 3: Verify visually**

Open a box score modal in the dev server. Confirm:
- Share icon appears to the left of the × close button
- Clicking it copies the URL (on desktop) and shows checkmark
- Button matches the close button styling

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BoxScoreModal.jsx
git commit -m "feat: add share button to box score modal"
```

---

### Task 3: Add ShareButton to Matchup Modal

**Files:**
- Modify: `client/src/components/MatchupModal.jsx`

The modal header is at lines 253-256:
```jsx
<div className="modal-header">
  <span className="modal-title">Matchup Preview</span>
  <button className="modal-close" onClick={onClose}>&#10005;</button>
</div>
```

- [ ] **Step 1: Add import at top of file**

After the existing imports (line 4), add:
```jsx
import ShareButton from "./ShareButton.jsx";
```

- [ ] **Step 2: Add ShareButton to modal header**

Replace the modal header block (lines 253-256) with:
```jsx
<div className="modal-header">
  <span className="modal-title">Matchup Preview</span>
  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
    <ShareButton
      title={`${visitingConfig?.city || "Away"} vs ${homeConfig?.city || "Home"} — Matchup Preview`}
    />
    <button className="modal-close" onClick={onClose}>&#10005;</button>
  </div>
</div>
```

- [ ] **Step 3: Verify visually**

Open a matchup modal in the dev server. Confirm share button appears and works.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/MatchupModal.jsx
git commit -m "feat: add share button to matchup modal"
```

---

### Task 4: Add ShareButton to Team Page

**Files:**
- Modify: `client/src/pages/TeamPage.jsx`

The team header info section is at lines 157-158:
```jsx
<div className="team-header-info">
  <h1 className="team-header-name">{team.name}</h1>
```

- [ ] **Step 1: Add import at top of file**

After the existing component imports (around line 11), add:
```jsx
import ShareButton from "../components/ShareButton.jsx";
```

- [ ] **Step 2: Add ShareButton next to team name**

Replace line 158:
```jsx
<h1 className="team-header-name">{team.name}</h1>
```
with:
```jsx
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  <h1 className="team-header-name">{team.name}</h1>
  <ShareButton title={`${team.name} — ECHL Stats`} />
</div>
```

- [ ] **Step 3: Verify visually**

Navigate to a team page. Confirm share button appears next to the team name and works.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/TeamPage.jsx
git commit -m "feat: add share button to team page header"
```

---

### Task 5: Add ShareButton to Standings Page

**Files:**
- Modify: `client/src/pages/StandingsPage.jsx`

The page header is at lines 67-69:
```jsx
<div className="standings-page-header">
  <h1 className="page-title">Standings</h1>
</div>
```

- [ ] **Step 1: Add import at top of file**

After the existing imports (line 4), add:
```jsx
import ShareButton from "../components/ShareButton.jsx";
```

- [ ] **Step 2: Add ShareButton to page header**

Replace lines 67-69:
```jsx
<div className="standings-page-header">
  <h1 className="page-title">Standings</h1>
</div>
```
with:
The existing `.standings-page-header` CSS already has `display: flex; align-items: center; justify-content: space-between`, so no inline style is needed — the ShareButton will naturally sit to the right of the title.

```jsx
<div className="standings-page-header">
  <h1 className="page-title">Standings</h1>
  <ShareButton title="ECHL Standings" />
</div>
```

- [ ] **Step 3: Verify visually**

Navigate to `/standings`. Confirm share button appears next to the title and works.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/StandingsPage.jsx
git commit -m "feat: add share button to standings page"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Test all four placements**

Run dev server and verify:
1. Box score modal — share button in header, copies URL
2. Matchup modal — share button in header, copies URL
3. Team page — share button next to team name, copies URL
4. Standings page — share button next to title, copies URL

- [ ] **Step 2: Test mobile behavior (optional)**

If testing on mobile or via browser dev tools mobile mode, verify `navigator.share` opens the native share sheet.

- [ ] **Step 3: Commit any final adjustments**

If any visual tweaks are needed, make them and commit.
