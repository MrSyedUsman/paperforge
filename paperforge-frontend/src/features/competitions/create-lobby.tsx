/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { ThemeSlider } from "@/components/theme-slider";
import type { Market } from "@/lib/market-data/markets";
import type { Difficulty } from "./types";
import { NAMES, defaults, difficultyInfo } from "./constants";
export function Create({
  settings: s,
  setSettings: set,
  markets,
  search,
  setSearch,
  cancel,
  next,
}: any) {
  const filtered = markets
    .filter((m: Market) =>
      `${m.pair} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 16);
  return (
    <div className="bc page">
      <div className="bc-form-head">
        <button onClick={cancel}>← Competitions</button>
        <span>STEP 1 OF 2</span>
        <h1>Create a bot competition</h1>
        <p>
          Short, isolated paper-trading practice. Your normal portfolio is never
          changed.
        </p>
      </div>
      <div className="bc-create-grid">
        <section className="bc-form">
          <label>
            Lobby name
            <input
              maxLength={40}
              value={s.name}
              onChange={(e) => set({ ...s, name: e.target.value })}
            />
            <small>{s.name.length}/40 · optional</small>
          </label>
          <fieldset>
            <legend>Duration</legend>
            <p>
              Bot lobbies are quick practice sessions, limited to one hour. The
              1-minute option is temporary for developer testing.
            </p>
            <div className="bc-options seven">
              {[1, 10, 15, 20, 30, 45, 60].map((n) => (
                <button
                  className={`${s.duration === n ? "active" : ""} ${n === 1 ? "dev-duration" : ""}`}
                  onClick={() => set({ ...s, duration: n })}
                  key={n}
                >
                  {n === 1 ? "1 min · DEV" : `${n} min`}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Total participants</legend>
            <p>
              You + {s.spots - 1} bot opponent{s.spots > 2 ? "s" : ""}
            </p>
            <ThemeSlider
              aria-label="Total competition participants"
              min={2}
              max={8}
              value={s.spots}
              onChange={(e) => set({ ...s, spots: +e.target.value })}
            />
            <div className="bc-range-label">
              <span>2</span>
              <b>{s.spots} spots</b>
              <span>8</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Difficulty</legend>
            <div className="bc-difficulties">
              {(["Easy", "Medium", "Hard", "Expert"] as Difficulty[]).map(
                (d) => (
                  <button
                    className={s.difficulty === d ? "active" : ""}
                    onClick={() => set({ ...s, difficulty: d })}
                    key={d}
                  >
                    <b>{d}</b>
                    <small>{difficultyInfo[d]}</small>
                  </button>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>Starting virtual allocation</legend>
            <div className="bc-options">
              {[1000, 5000, 10000, 25000].map((n) => (
                <button
                  className={s.allocation === n ? "active" : ""}
                  onClick={() => set({ ...s, allocation: n })}
                  key={n}
                >
                  ${n.toLocaleString()}
                </button>
              ))}
            </div>
            <label className="inline">
              Custom USDT
              <input
                type="number"
                min="500"
                max="100000"
                value={s.allocation}
                onChange={(e) => set({ ...s, allocation: +e.target.value })}
              />
            </label>
            <small>Temporary competition wallet · $500–$100,000</small>
          </fieldset>
          <fieldset>
            <legend>Maximum leverage</legend>
            <div className="bc-options">
              {[5, 10, 20, 30, 50].map((n) => (
                <button
                  className={s.maxLeverage === n ? "active" : ""}
                  onClick={() => set({ ...s, maxLeverage: n })}
                  key={n}
                >
                  {n}×
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Allowed markets</legend>
            <div className="bc-options three">
              {[
                ["all", "All eligible"],
                ["majors", "Majors only"],
                ["custom", "Custom"],
              ].map((x) => (
                <button
                  className={s.marketMode === x[0] ? "active" : ""}
                  onClick={() => set({ ...s, marketMode: x[0] })}
                  key={x[0]}
                >
                  {x[1]}
                </button>
              ))}
            </div>
            {s.marketMode === "custom" && (
              <div className="bc-market-picker">
                <input
                  placeholder="Search perpetual markets"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {filtered.map((m: Market) => (
                  <label key={m.pair}>
                    <input
                      type="checkbox"
                      checked={s.custom.includes(m.pair)}
                      onChange={() =>
                        set({
                          ...s,
                          custom: s.custom.includes(m.pair)
                            ? s.custom.filter((x: string) => x !== m.pair)
                            : [...s.custom, m.pair],
                        })
                      }
                    />
                    <b>{m.pair}</b>
                    <small>{m.name}</small>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <details>
            <summary>Advanced settings</summary>
            <div className="bc-advanced">
              <label>
                <input
                  type="checkbox"
                  checked={s.showPositions}
                  onChange={(e) =>
                    set({ ...s, showPositions: e.target.checked })
                  }
                />{" "}
                Show bot open positions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.showActivity}
                  onChange={(e) =>
                    set({ ...s, showActivity: e.target.checked })
                  }
                />{" "}
                Show bot activity
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.repeats}
                  onChange={(e) => set({ ...s, repeats: e.target.checked })}
                />{" "}
                Allow repeated market entries
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.elimination}
                  onChange={(e) => set({ ...s, elimination: e.target.checked })}
                />{" "}
                Eliminate at zero usable equity
              </label>
              <label>
                Maximum open positions
                <select
                  value={s.maxPositions}
                  onChange={(e) => set({ ...s, maxPositions: +e.target.value })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <div className="bc-form-actions">
            <button className="secondary" onClick={cancel}>
              Cancel
            </button>
            <button className="primary" onClick={next}>
              Review Lobby →
            </button>
          </div>
        </section>
        <aside className="bc-summary">
          <span>LOBBY PREVIEW</span>
          <h2>{s.name.trim() || defaults.name}</h2>
          <b>{s.duration}:00</b>
          <p>
            {s.spots - 1} {s.difficulty} bots · $
            {Number(s.allocation).toLocaleString()} each · {s.maxLeverage}× max
          </p>
          <div>
            {Array.from({ length: s.spots }, (_, i) => (
              <i key={i}>
                {i ? NAMES[i - 1].slice(0, 2).toUpperCase() : "YOU"}
              </i>
            ))}
          </div>
          <small>All balances are isolated and virtual.</small>
        </aside>
      </div>
    </div>
  );
}
