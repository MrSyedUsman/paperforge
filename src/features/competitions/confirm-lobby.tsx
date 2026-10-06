/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { money, defaults } from "./constants";
export function Confirm({ settings: s, error, cancel, start }: any) {
  return (
    <div className="bc page">
      <section className="bc-confirm">
        <span>READY CHECK</span>
        <h1>Review your bot lobby</h1>
        <p>Once started, the competition timer begins immediately.</p>
        <div>
          {[
            ["Lobby", s.name.trim() || defaults.name],
            ["Duration", `${s.duration} minutes`],
            ["Participants", `${s.spots} total · ${s.spots - 1} bots`],
            ["Difficulty", s.difficulty],
            ["Allocation", `${money(s.allocation)} virtual USDT each`],
            ["Maximum leverage", `${s.maxLeverage}×`],
            [
              "Markets",
              s.marketMode === "custom"
                ? `${s.custom.length} custom pairs`
                : s.marketMode === "majors"
                  ? "Major perpetuals"
                  : "All eligible perpetuals",
            ],
            ["Early elimination", s.elimination ? "Enabled" : "Disabled"],
          ].map((x) => (
            <span key={x[0]}>
              <small>{x[0]}</small>
              <b>{x[1]}</b>
            </span>
          ))}
        </div>
        <aside>
          <b>Browser-local simulation</b>
          <p>
            This temporary competition wallet is separate from your PaperForge
            portfolio. Results are unverified, locally editable and involve no
            real money.
          </p>
        </aside>
        {error && <div className="bc-error">{error}</div>}
        <footer>
          <button className="secondary" onClick={cancel}>
            Back
          </button>
          <button className="primary" onClick={start}>
            Start Bot Competition →
          </button>
        </footer>
      </section>
    </div>
  );
}
