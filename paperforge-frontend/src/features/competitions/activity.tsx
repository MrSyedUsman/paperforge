/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import type { Event } from "./types";
export function Activity({ events, visible }: any) {
  return (
    <section className="bc-panel bc-activity">
      <div className="bc-panel-title">
        <span>
          <small>LIVE FEED</small>
          <h2>Lobby activity</h2>
        </span>
      </div>
      {visible ? (
        <div>
          {events.slice(0, 18).map((e: Event) => (
            <p key={e.id} className={e.tone}>
              <i />{" "}
              <span>
                {e.text}
                <small>{new Date(e.at).toLocaleTimeString()}</small>
              </span>
            </p>
          ))}
        </div>
      ) : (
        <div className="bc-hidden">
          Bot activity is hidden by lobby settings.
        </div>
      )}
    </section>
  );
}
