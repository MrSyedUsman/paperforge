/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { money, initials } from "@/features/account/format";
export function ProfileExperience(p: any) {
  const [draft, setDraft] = useState({ ...p.profile }),
    [error, setError] = useState("");
  const history = p.history,
    win = history.filter((h: any) => h.pnl > 0).length,
    best = [...history].sort((a: any, b: any) => b.pnl - a.pnl)[0],
    worst = [...history].sort((a: any, b: any) => a.pnl - b.pnl)[0],
    counts = history.reduce((a: any, h: any) => {
      const k = h.pair || `${h.symbol}USDT`;
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {}),
    most =
      Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] ||
      "—",
    faucets = p.activity.filter((a: any) => a.type === "faucet").length;
  function save() {
    const name = draft.name.trim(),
      username = draft.username.trim().toLowerCase(),
      bio = draft.bio.trim();
    if (name.length < 2 || name.length > 40)
      return setError("Display name must be between 2 and 40 characters.");
    if (!/^[a-z0-9_]{3,20}$/.test(username))
      return setError(
        "Username must be 3–20 lowercase letters, numbers or underscores.",
      );
    if (bio.length > 160)
      return setError("Bio must be 160 characters or fewer.");
    if (draft.country.trim().length > 50)
      return setError("Country is too long.");
    setError("");
    p.save({
      ...draft,
      name,
      username,
      bio,
      avatar: draft.avatar || initials(name),
    });
  }
  return (
    <div className="page p3-profile">
      <section className="p3-profile-hero">
        <div className="p3-big-avatar" aria-label={`${p.profile.name} avatar`}>
          {p.profile.avatar || initials(p.profile.name)}
          <i />
        </div>
        <div>
          <span className="eyebrow">LOCAL TRADER PROFILE</span>
          <h1>{p.profile.name}</h1>
          <b>@{p.profile.username}</b>
          <p>{p.profile.bio}</p>
          <div>
            <span>Paper trader</span>
            <span>Simulation active</span>
            <span>
              Started {new Date(p.profile.joined).toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>
      <section className="p3-profile-layout">
        <article className="p3-edit-profile">
          <div className="p3-section-title">
            <div>
              <span className="eyebrow">PROFILE SETTINGS</span>
              <h2>Edit profile</h2>
            </div>
            <small>Stored in this browser only</small>
          </div>
          <div className="p3-avatar-picker">
            <div>{draft.avatar || initials(draft.name)}</div>
            <span>
              <b>Choose avatar initials</b>
              <small>
                Small generated avatars avoid localStorage image limits.
              </small>
              <div>
                {[...new Set([initials(draft.name), "PF", "⚡", "▲", "◎"])].map((x) => (
                  <button
                    className={draft.avatar === x ? "active" : ""}
                    key={x}
                    onClick={() => setDraft({ ...draft, avatar: x })}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </span>
            <button
              onClick={() =>
                setDraft({ ...draft, avatar: initials(draft.name) })
              }
            >
              Reset
            </button>
          </div>
          <div className="p3-form-grid">
            <label>
              Display name
              <input
                maxLength={40}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <small>{draft.name.length}/40</small>
            </label>
            <label>
              Username
              <div className="p3-username">
                <span>@</span>
                <input
                  maxLength={20}
                  value={draft.username}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      username: e.target.value.replace(/\s/g, ""),
                    })
                  }
                />
              </div>
              <small>Lowercase letters, numbers and underscores</small>
            </label>
            <label>
              Country
              <input
                maxLength={50}
                value={draft.country}
                onChange={(e) =>
                  setDraft({ ...draft, country: e.target.value })
                }
              />
            </label>
            <label>
              Timezone
              <select
                value={draft.timezone}
                onChange={(e) =>
                  setDraft({ ...draft, timezone: e.target.value })
                }
              >
                <option>Asia/Karachi</option>
                <option>UTC</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>Asia/Dubai</option>
              </select>
            </label>
            <label>
              Display currency
              <select
                value={draft.currency}
                onChange={(e) =>
                  setDraft({ ...draft, currency: e.target.value })
                }
              >
                <option>USD</option>
                <option>PKR</option>
                <option>EUR</option>
              </select>
            </label>
            <label className="wide">
              Short bio
              <textarea
                maxLength={160}
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
              <small>{draft.bio.length}/160</small>
            </label>
          </div>
          <div className="p3-privacy">
            <div>
              <b>Privacy preview</b>
              <small>
                These preferences are visual only until production accounts
                exist.
              </small>
            </div>
            <label>
              <input
                type="checkbox"
                checked={draft.publicProfile}
                onChange={(e) =>
                  setDraft({ ...draft, publicProfile: e.target.checked })
                }
              />{" "}
              Public profile <em>Preview</em>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.showStats}
                onChange={(e) =>
                  setDraft({ ...draft, showStats: e.target.checked })
                }
              />{" "}
              Show trading statistics <em>Local</em>
            </label>
          </div>
          {error && (
            <div className="p3-form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" onClick={save}>
            Save browser profile
          </button>
        </article>
        <aside className="p3-profile-side">
          <section>
            <span className="eyebrow">LOCAL TRADING STATS</span>
            <h2>Your paper record</h2>
            <div className="p3-stat-list">
              {[
                ["Completed trades", history.length],
                ["Profitable trades", win],
                ["Losing trades", history.filter((h: any) => h.pnl < 0).length],
                [
                  "Win rate",
                  history.length
                    ? `${Math.round((win / history.length) * 100)}%`
                    : "—",
                ],
                ["Realized PnL", money(p.account.realizedPnl)],
                ["Unrealized PnL", money(p.account.totalPnl)],
                ["Best trade", best ? money(best.pnl) : "—"],
                ["Worst trade", worst ? money(worst.pnl) : "—"],
                ["Most traded market", most],
                ["Faucet claims", faucets],
              ].map((x) => (
                <span key={x[0]}>
                  <small>{x[0]}</small>
                  <b>{x[1]}</b>
                </span>
              ))}
            </div>
          </section>
          <section className="p3-competition-stats">
            <div>
              <span className="eyebrow">COMPETITION STATS</span>
              <em>COMING SOON</em>
            </div>
            <h2>Multiplayer record</h2>
            {[
              "Competitions entered",
              "Wins",
              "Podium finishes",
              "Win rate",
              "Best finish",
              "Global rank",
            ].map((x) => (
              <span key={x}>
                <small>{x}</small>
                <b>—</b>
              </span>
            ))}
            <button onClick={p.competitions}>Preview competitions →</button>
            <p>
              No fictional wins or ranks are recorded. This section unlocks
              after the production multiplayer system exists.
            </p>
          </section>
        </aside>
      </section>
      <div className="p3-local-notice">
        Profile fields and privacy switches are local preferences, not a secured
        public profile. Server-enforced privacy requires production
        authentication and storage.
      </div>
    </div>
  );
}
