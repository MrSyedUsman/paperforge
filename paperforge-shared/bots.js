const descriptions = {
  trend: {
    speciality: "Follow established and developing trends",
    looksFor:
      "Prefers aligned trends and pullbacks; accepts a smaller developing directional setup.",
    exits:
      "The trend weakens, profit retreats, or a risk or holding limit is reached.",
    risk: "Moderate exposure, with a cooldown after exits.",
    accent: "#65deb6",
  },
  momentum: {
    speciality: "Catch recent directional strength",
    looksFor:
      "Prefers strong recent momentum; also considers modest directional continuation.",
    exits:
      "Momentum fades or reverses, a net-profit target is reached, or risk limits intervene.",
    risk: "Moderate exposure; can hold more positions than selective bots.",
    accent: "#83bdf3",
  },
  breakout: {
    speciality: "Explore developing and confirmed range breaks",
    looksFor:
      "Prefers confirmed range breaks; can enter smaller near-boundary directional moves before confirmation.",
    exits:
      "Price returns inside the range, profit retreats, or a risk or holding limit is reached.",
    risk: "Smaller anticipatory entries, with cooldowns and re-entry checks.",
    accent: "#e2bd7d",
  },
  reversion: {
    speciality: "Look for a return toward the mean",
    looksFor:
      "Looks for recovery toward a recent mean, including smaller deviations with reduced exposure.",
    exits:
      "Price reaches the entry mean after fees, or deviation, trend or risk invalidates the entry.",
    risk: "Restrained leverage; waits for a measured reversal.",
    accent: "#bea6ed",
  },
  conservative: {
    speciality: "Stay selective and limit exposure",
    looksFor:
      "Accepts basic directional agreement while keeping leverage, exposure and concurrent positions low.",
    exits:
      "A modest net-profit target, weakening trend or risk limit calls for an exit.",
    risk: "Lowest base exposure, one position, and smaller sizing after drawdown.",
    accent: "#afd3a3",
  },
  adaptive: {
    speciality: "Match the rules to the market",
    looksFor:
      "Prefers a persistent regime; can make a smaller provisional trend or recovery entry while it develops.",
    exits:
      "Original entry rules fail, a confirmed regime changes, or risk limits intervene.",
    risk: "Uses reduced exposure for provisional evidence and confirms regimes before larger commitments.",
    accent: "#83d5de",
  },
  volatility: {
    speciality: "Respond to expanding volatility",
    looksFor:
      "Prefers expanding volatility; can explore moderate measured variation with directional support.",
    exits:
      "Expansion or direction fades, a net-profit target is reached, or risk limits intervene.",
    risk: "Reduces sizing and leverage as volatility rises; avoids extreme volatility.",
    accent: "#e8a9bc",
  },
};

const names = [
  "TrendFox",
  "NovaQuant",
  "CandleByte",
  "RiskRaven",
  "MomentumX",
  "DeltaBot",
  "AtlasAlgo",
];
const styles = [
  "Trend follower",
  "Momentum trader",
  "Breakout trader",
  "Mean-reversion trader",
  "Conservative trader",
  "Adaptive trader",
  "Volatility trader",
];
const kinds = [
  "trend",
  "momentum",
  "breakout",
  "reversion",
  "conservative",
  "adaptive",
  "volatility",
];
export const BOT_CATALOG = names.map((name, index) => ({
  name,
  style: styles[index],
  kind: kinds[index],
  avatar: name.slice(0, 2).toUpperCase(),
  ...descriptions[kinds[index]],
}));

export const BOT_REASON_CODES = {
  trend_pullback: "Trend-aligned recovery after a sampled-price pullback",
  trend_confirmed:
    "Fast and slow averages confirm an established, unextended trend",
  momentum_confirmed:
    "Recent return agrees with broader momentum without excessive extension",
  breakout_confirmed:
    "Two sampled prices confirm a buffered break beyond the prior range",
  reversion_confirmed:
    "An extended deviation is turning back toward the mean in a weak trend",
  conservative_confirmed:
    "Low-volatility trend and momentum agree with room beyond estimated fees",
  volatility_confirmed:
    "Realized volatility expanded with independent directional confirmation",
};

BOT_REASON_CODES.trend_developing =
  "A developing observed trend supports a smaller trend-following entry";
BOT_REASON_CODES.trend_exploratory =
  "Small exploratory entry: a developing observed trend supports a smaller trend-following entry";
BOT_REASON_CODES.momentum_developing =
  "Modest recent directional continuation supports a smaller momentum entry";
BOT_REASON_CODES.momentum_exploratory =
  "Small exploratory entry: modest recent directional continuation supports a smaller momentum entry";
BOT_REASON_CODES.breakout_developing =
  "Directional movement near a recent boundary supports an anticipatory range entry";
BOT_REASON_CODES.breakout_exploratory =
  "Small exploratory entry: directional movement near a recent boundary supports an anticipatory range entry";
BOT_REASON_CODES.reversion_developing =
  "A smaller observed deviation is recovering toward the recent reference mean";
BOT_REASON_CODES.reversion_exploratory =
  "Small exploratory entry: a smaller observed deviation is recovering toward the recent reference mean";
BOT_REASON_CODES.conservative_developing =
  "Basic directional agreement supports a lower-exposure conservative entry";
BOT_REASON_CODES.conservative_exploratory =
  "Small exploratory entry: basic directional agreement supports a lower-exposure conservative entry";
BOT_REASON_CODES.adaptive_developing =
  "Available trend or recovery evidence supports a provisional adaptive entry";
BOT_REASON_CODES.adaptive_exploratory =
  "Small exploratory entry: available trend or recovery evidence supports a provisional adaptive entry";
BOT_REASON_CODES.volatility_developing =
  "Moderate measured price variation has directional support";
BOT_REASON_CODES.volatility_exploratory =
  "Small exploratory entry: moderate measured price variation has directional support";

/** Used by evidence validation; historical reason identifiers remain accepted. */
export const BOT_REASON_KINDS = Object.fromEntries(
  Object.keys(BOT_REASON_CODES).map((code) => [
    code,
    code.startsWith("trend_")
      ? ["trend", "adaptive"]
      : code.startsWith("breakout_")
        ? ["breakout", "adaptive"]
        : code.startsWith("reversion_")
          ? ["reversion", "adaptive"]
          : [code.split("_")[0]],
  ]),
);
