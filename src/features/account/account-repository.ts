import type { Activity, ClosedPos, Pos, Profile } from "./types";
import { browserStorage } from "../../lib/storage/browser-storage.ts";
import {
  calculateLiquidationPrice,
  DEFAULT_LIQUIDATION_FEE_RATE,
  DEFAULT_MAINTENANCE_MARGIN_RATE,
  roundMoney,
} from "../../lib/simulation/trading.ts";

export const ACCOUNT_KEY = "paperforge-v2";
export const FAUCET_COOLDOWN_MS = 21_600_000;

export type AccountSnapshot = {
  version: number;
  balance: number;
  favorites: string[];
  recent: string[];
  positions: Pos[];
  history: ClosedPos[];
  activity: Activity[];
  profile: Profile;
  claimAt: number;
  selectedPair: string;
};

export function createDefaultProfile(now = Date.now()): Profile {
  return {
    name: "Syed Usman", email: "usman@example.com", country: "Pakistan",
    currency: "USD", bio: "Building discipline, one paper trade at a time.",
    username: "syedusman", timezone: "Asia/Karachi", avatar: "SU",
    publicProfile: false, showStats: true, joined: new Date(now).toISOString(),
  };
}

export function defaultAccount(profile = createDefaultProfile()): AccountSnapshot {
  return {
    version: 5, balance: 1000, favorites: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    recent: [], positions: [], history: [], activity: [], profile,
    claimAt: 0, selectedPair: "BTCUSDT",
  };
}

function restoreProfile(saved: unknown, defaults: Profile): Profile {
  const profile = { ...defaults };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return profile;
  for (const key of Object.keys(defaults) as Array<keyof Profile>) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === typeof defaults[key]) {
      Object.assign(profile, { [key]: value });
    }
  }
  return profile;
}

function isSavedPosition(value: unknown): value is Pos {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.symbol === "string" && typeof p.opened === "string" &&
    (p.side === "Long" || p.side === "Short") &&
    typeof p.id === "number" && Number.isFinite(p.id) &&
    ["entry", "lev", "margin", "size"].every(key =>
      typeof p[key] === "number" && Number.isFinite(p[key]) && p[key] > 0);
}

function isSavedTrade(value: unknown): value is ClosedPos {
  return isSavedPosition(value) && typeof (value as ClosedPos).closed === "string" &&
    typeof (value as ClosedPos).pnl === "number" && Number.isFinite((value as ClosedPos).pnl);
}

function isSavedActivity(value: unknown): value is Activity {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return typeof a.id === "number" && Number.isFinite(a.id) &&
    (a.type === "faucet" || a.type === "trade") && typeof a.label === "string" &&
    typeof a.at === "string" && typeof a.amount === "number" && Number.isFinite(a.amount);
}

/** Supports account schema v4 fee accounting and v5 liquidation values. */
export function parseAccount(raw: string | null, profile: Profile, now = Date.now()): AccountSnapshot {
  const defaults = defaultAccount(profile);
  if (!raw) return defaults;
  const s = JSON.parse(raw) as Partial<AccountSnapshot>;
  if (!s || typeof s !== "object") throw new Error("Invalid saved account");
  return {
    ...defaults,
    balance: Number.isFinite(s.balance) ? s.balance! : defaults.balance,
    favorites: Array.isArray(s.favorites) ? s.favorites.filter(x => typeof x === "string").map(x => x.endsWith("USDT") ? x : `${x}USDT`) : defaults.favorites,
    recent: Array.isArray(s.recent) ? s.recent.filter(x => typeof x === "string") : [],
    positions: Array.isArray(s.positions) ? s.positions.filter(isSavedPosition).map(p => ({
      ...p,
      maintenanceMarginRate: Number(p.maintenanceMarginRate) || DEFAULT_MAINTENANCE_MARGIN_RATE,
      liquidationFeeRate: Number(p.liquidationFeeRate) || DEFAULT_LIQUIDATION_FEE_RATE,
      liquidation: Number(s.version) >= 5 && Number(p.liquidation) ? Number(p.liquidation) : calculateLiquidationPrice({
        entry: Number(p.entry), side: p.side, leverage: Number(p.lev), margin: Number(p.margin), notional: Number(p.size),
      }),
    })) : [],
    history: Array.isArray(s.history) ? s.history.filter(isSavedTrade).map(h => Number(s.version) >= 4 ? h : ({
      ...h,
      pnl: roundMoney((Number(h.pnl) || 0) - (Number(h.openFee) || 0)),
      roi: h.margin ? roundMoney(((Number(h.pnl) || 0) - (Number(h.openFee) || 0)) / h.margin * 100) : 0,
    })) : [],
    activity: Array.isArray(s.activity) ? s.activity.filter(isSavedActivity) : [],
    profile: restoreProfile(s.profile, profile),
    claimAt: Number(s.claimAt) > now - FAUCET_COOLDOWN_MS ? Number(s.claimAt) : 0,
    selectedPair: typeof s.selectedPair === "string" ? (s.selectedPair.endsWith("USDT") ? s.selectedPair : `${s.selectedPair}USDT`) : defaults.selectedPair,
  };
}

export const accountRepository = {
  load(profile: Profile): AccountSnapshot {
    return parseAccount(browserStorage.getRaw(ACCOUNT_KEY), profile);
  },
  save(snapshot: AccountSnapshot): boolean {
    return browserStorage.write(ACCOUNT_KEY, { ...snapshot, version: 5 });
  },
};
