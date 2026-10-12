/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
export function Faucet({ clock, canClaim, claim }: any) {
  return (
    <section
      className={`p3-faucet ${canClaim ? "ready" : "cooldown"}`}
      aria-live="polite"
    >
      <div className="p3-faucet-icon">✦</div>
      <div>
        <span className="eyebrow">VIRTUAL FUNDS FAUCET</span>
        <h3>$50 paper balance every six hours</h3>
        <p>Non-withdrawable practice funds stored only in this browser.</p>
      </div>
      <div className="p3-faucet-status">
        <small>{canClaim ? "Available now" : "Next claim"}</small>
        <b>{clock}</b>
        <button onClick={claim} disabled={!canClaim}>
          {canClaim ? "Claim $50 virtual" : "Cooldown active"}
        </button>
      </div>
    </section>
  );
}

