/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect } from "react";
export function QuitDialog({ opponents, cancel, confirm }: any) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [cancel]);
  return (
    <div
      className="bc-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quit-title"
      onMouseDown={(e) => e.currentTarget === e.target && cancel()}
    >
      <section className="bc-quit-dialog">
        <button onClick={cancel} aria-label="Close quit confirmation">
          ×
        </button>
        <span>ABANDON COMPETITION</span>
        <h2 id="quit-title">Quit this competition?</h2>
        <p>
          Your open positions will be settled, you will be placed last, and the
          highest-ranked remaining opponent will win immediately. This cannot be
          resumed.
        </p>
        <div>
          <b>
            {opponents} opponent{opponents === 1 ? "" : "s"}
          </b>
          <small>will remain and receive the win</small>
        </div>
        <footer>
          <button className="secondary" onClick={cancel}>
            Keep playing
          </button>
          <button className="bc-danger" onClick={confirm}>
            Quit and concede
          </button>
        </footer>
      </section>
    </div>
  );
}
