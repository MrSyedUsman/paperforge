/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect } from "react";
export function FinalMinuteDialog({ close }: any) {
  useEffect(() => {
    const timer = setTimeout(close, 5000),
      key = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
    addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      removeEventListener("keydown", key);
    };
  }, [close]);
  return (
    <section className="bc-final-toast" role="alert" aria-live="assertive">
      <button onClick={close} aria-label="Dismiss final-minute warning">
        ×
      </button>
      <span>FINAL MINUTE</span>
      <h2>60 seconds remaining</h2>
      <p>
        At 00:00, open positions auto-close using the final mark and normal
        closing fees.
      </p>
      <div>
        <i /> This notice closes automatically in 5 seconds.
      </div>
    </section>
  );
}
