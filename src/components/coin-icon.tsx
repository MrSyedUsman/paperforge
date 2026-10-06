/* eslint-disable @next/next/no-img-element -- Bundled SVG logos are intentionally served directly. */
"use client";
import { memo, useState } from "react";
// Local assets: no metadata API requests or dependencies on quote updates.
const ICONS: Record<string, string> = {
  "AAVE": "/coin-icons/aave.svg",
  "ADA": "/coin-icons/ada.svg",
  "ALGO": "/coin-icons/algo.svg",
  "ATOM": "/coin-icons/atom.svg",
  "AVAX": "/coin-icons/avax.svg",
  "BCH": "/coin-icons/bch.svg",
  "BNB": "/coin-icons/bnb.svg",
  "BTC": "/coin-icons/btc.svg",
  "COMP": "/coin-icons/comp.svg",
  "CRV": "/coin-icons/crv.svg",
  "DASH": "/coin-icons/dash.svg",
  "DOGE": "/coin-icons/doge.svg",
  "DOT": "/coin-icons/dot.svg",
  "EOS": "/coin-icons/eos.svg",
  "ETC": "/coin-icons/etc.svg",
  "ETH": "/coin-icons/eth.svg",
  "FIL": "/coin-icons/fil.svg",
  "ICP": "/coin-icons/icp.svg",
  "LINK": "/coin-icons/link.svg",
  "LTC": "/coin-icons/ltc.svg",
  "MANA": "/coin-icons/mana.svg",
  "MKR": "/coin-icons/mkr.svg",
  "SAND": "/coin-icons/sand.svg",
  "SNX": "/coin-icons/snx.svg",
  "SOL": "/coin-icons/sol.svg",
  "THETA": "/coin-icons/theta.svg",
  "TRX": "/coin-icons/trx.svg",
  "UNI": "/coin-icons/uni.svg",
  "VET": "/coin-icons/vet.svg",
  "XLM": "/coin-icons/xlm.svg",
  "XRP": "/coin-icons/xrp.svg",
  "XTZ": "/coin-icons/xtz.svg",
  "ZEC": "/coin-icons/zec.svg",
  "ZIL": "/coin-icons/zil.svg"
};
const ALIASES: Record<string, string> = { "1000SHIB": "SHIB" };
type Props = { symbol: string; color: string; className?: string };
export const CoinIcon = memo(function CoinIcon({ symbol, color, className = "" }: Props) {
  const asset = ICONS[ALIASES[symbol] || symbol];
  const [failedAsset, setFailedAsset] = useState<string>();
  return <i className={`coin-icon ${className}`} style={{ background: color }} aria-hidden="true">
    {asset && failedAsset !== asset ? <img src={asset} alt="" loading="lazy" decoding="async" width="32" height="32" onError={() => setFailedAsset(asset)} /> : symbol[0]}
  </i>;
});
