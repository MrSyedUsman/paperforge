export type SharedBotKind =
  | "trend"
  | "momentum"
  | "breakout"
  | "reversion"
  | "conservative"
  | "adaptive"
  | "volatility";
export type BotDescription = {
  name: string;
  style: string;
  kind: SharedBotKind;
  avatar: string;
  speciality: string;
  looksFor: string;
  exits: string;
  risk: string;
  accent: string;
};
export const BOT_CATALOG: BotDescription[];

export const BOT_REASON_CODES: Record<string, string>;

export const BOT_REASON_KINDS: Record<string, SharedBotKind[]>;
