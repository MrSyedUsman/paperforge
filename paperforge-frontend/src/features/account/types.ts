export type Pos = {
  id: number;
  symbol: string;
  pair?: string;
  side: "Long" | "Short";
  margin: number;
  size: number;
  quantity?: number;
  entry: number;
  lev: number;
  liquidation?: number;
  maintenanceMarginRate?: number;
  liquidationFeeRate?: number;
  openFee?: number;
  opened: string;
};
export type ClosedPos = Pos & {
  pnl: number;
  exit?: number;
  closeFee?: number;
  totalFees?: number;
  roi?: number;
  closed: string;
  reason?: string;
  marginLost?: number;
  liquidationFee?: number;
};
export type Profile = {
  name: string;
  email: string;
  country: string;
  currency: string;
  bio: string;
  username: string;
  timezone: string;
  avatar: string;
  publicProfile: boolean;
  showStats: boolean;
  joined: string;
};
export type Activity = {
  id: number;
  type: "faucet" | "trade";
  label: string;
  amount: number;
  at: string;
};
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Feed = "connecting" | "live" | "reconnecting" | "delayed" | "offline";
export type SortKey = "volume" | "change" | "price" | "symbol";
