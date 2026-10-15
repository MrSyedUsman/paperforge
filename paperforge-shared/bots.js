const descriptions = {
  trend: {
    speciality: "Follow the established move",
    looksFor: "Aligned fast and slow averages; favours a recovering pullback.",
    exits:
      "The trend weakens, profit retreats, or a risk or holding limit is reached.",
    risk: "Moderate exposure, with a cooldown after exits.",
    accent: "#65deb6",
  },
  momentum: {
    speciality: "Catch recent directional strength",
    looksFor:
      "Recent returns agree with broader momentum without excessive extension.",
    exits:
      "Momentum fades or reverses, a net-profit target is reached, or risk limits intervene.",
    risk: "Moderate exposure; can hold more positions than selective bots.",
    accent: "#83bdf3",
  },
  breakout: {
    speciality: "Wait for a confirmed range break",
    looksFor:
      "Two sampled prices confirm a buffered move beyond the previous range.",
    exits:
      "Price returns inside the range, profit retreats, or a risk or holding limit is reached.",
    risk: "Selective entries and cooldowns after exits.",
    accent: "#e2bd7d",
  },
  reversion: {
    speciality: "Look for a return toward the mean",
    looksFor:
      "An extended price deviation starts recovering while the reference mean has a weak slope.",
    exits:
      "Price reaches the entry mean after fees, or deviation, trend or risk invalidates the entry.",
    risk: "Restrained leverage; waits for a measured reversal.",
    accent: "#bea6ed",
  },
  conservative: {
    speciality: "Stay selective and limit exposure",
    looksFor:
      "Stronger trend and momentum agreement, low volatility and room beyond fees.",
    exits:
      "A modest net-profit target, weakening trend or risk limit calls for an exit.",
    risk: "Lowest base exposure, one position, and smaller sizing after drawdown.",
    accent: "#afd3a3",
  },
  adaptive: {
    speciality: "Match the rules to the market",
    looksFor:
      "A persistent trend, range or breakout regime before selecting its rule set.",
    exits:
      "Original entry rules fail, a confirmed regime changes, or risk limits intervene.",
    risk: "Waits when conditions are unclear; avoids rapid strategy switching.",
    accent: "#83d5de",
  },
  volatility: {
    speciality: "Respond to expanding volatility",
    looksFor:
      "Realized volatility expands and a separate signal confirms direction.",
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
