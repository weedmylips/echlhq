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
