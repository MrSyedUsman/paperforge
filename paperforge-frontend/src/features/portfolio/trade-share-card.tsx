/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";

const cash = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(Number(value) || 0).toFixed(2)}`;
const signed = (value: number, suffix = "") => `${value >= 0 ? "+" : "−"}${Math.abs(Number(value) || 0).toFixed(2)}${suffix}`;
const duration = (opened: unknown, closed: unknown) => {
  const start = new Date(String(opened)).getTime(), end = new Date(String(closed)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Recorded trade";
  const seconds = Math.max(1, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export function TradeShareCard({ trade, close }: { trade: any; close: () => void }) {
  const [imageUrl, setImageUrl] = useState(""), [message, setMessage] = useState("");
  const pair = trade.pair || `${trade.symbol}USDT`, liquidated = trade.reason === "Liquidation";
  const paint = () => {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) return "";
    canvas.width = 1200; canvas.height = 675;
    const positive = Number(trade.pnl) >= 0, accent = liquidated ? "#ff6478" : positive ? "#3bdba4" : "#f3b652";
    const bg = ctx.createLinearGradient(0, 0, 1200, 675);
    bg.addColorStop(0, "#071018"); bg.addColorStop(.62, "#0b1821"); bg.addColorStop(1, liquidated ? "#261017" : "#10251f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 675);
    ctx.save(); ctx.globalAlpha = .1; ctx.strokeStyle = "#77a8b7";
    for (let x = 0; x <= 1200; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 675); ctx.stroke(); }
    for (let y = 0; y <= 675; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
    ctx.restore();
    const glow = ctx.createRadialGradient(1050, 85, 0, 1050, 85, 430);
    glow.addColorStop(0, liquidated ? "rgba(255,100,120,.25)" : "rgba(59,219,164,.22)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.fillRect(610, 0, 590, 520);
    ctx.fillStyle = "#3bdba4"; ctx.beginPath(); ctx.roundRect(58, 48, 58, 58, 15); ctx.fill();
    ctx.fillStyle = "#06130f"; ctx.font = "800 34px Arial"; ctx.fillText("P", 76, 88);
    ctx.fillStyle = "#f4f8fb"; ctx.font = "700 30px Arial"; ctx.fillText("Paper", 136, 86);
    ctx.fillStyle = "#3bdba4"; ctx.fillText("Forge", 223, 86);
    ctx.fillStyle = "#82a4b3"; ctx.font = "600 15px Arial"; ctx.fillText("VIRTUAL TRADE RESULT", 60, 145);
    ctx.textAlign = "right"; ctx.fillStyle = "#7f9ead"; ctx.font = "600 14px Arial"; ctx.fillText("BROWSER-LOCAL · UNVERIFIED", 1140, 82); ctx.textAlign = "left";
    ctx.fillStyle = "#f4f8fb"; ctx.font = "800 58px Arial"; ctx.fillText(pair, 60, 235);
    ctx.fillStyle = trade.side === "Long" ? "#3bdba4" : "#ff6478"; ctx.font = "700 22px Arial"; ctx.fillText(`${trade.side.toUpperCase()} · ${trade.lev}× LEVERAGE`, 62, 277);
    ctx.fillStyle = accent; ctx.font = "800 54px Arial"; ctx.fillText(cash(trade.pnl).replace("−", "-"), 60, 357);
    ctx.fillStyle = "#8ca8b5"; ctx.font = "600 16px Arial"; ctx.fillText("TRUE NET PNL", 62, 389);
    ctx.fillStyle = accent; ctx.font = "750 28px Arial"; ctx.fillText(signed(Number(trade.roi) || 0, "%"), 310, 353);
    ctx.fillStyle = "#8ca8b5"; ctx.font = "600 14px Arial"; ctx.fillText("RETURN ON MARGIN", 312, 383);
    ctx.fillStyle = liquidated ? "rgba(255,100,120,.14)" : positive ? "rgba(59,219,164,.12)" : "rgba(243,182,82,.12)";
    ctx.strokeStyle = accent; ctx.beginPath(); ctx.roundRect(60, 425, liquidated ? 330 : 270, 48, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.font = "700 14px Arial"; ctx.fillText(liquidated ? "!  LIQUIDATED · MARGIN EXHAUSTED" : positive ? "✓  PROFITABLE CLOSE" : "◆  CLOSED AT A LOSS", 82, 455);
    const facts = [
      ["ENTRY PRICE", cash(trade.entry)], ["EXIT PRICE", cash(trade.exit || trade.entry)],
      ["ISOLATED MARGIN", cash(trade.margin)], ["POSITION SIZE", cash(trade.size)],
      ["TOTAL FEES", cash(trade.totalFees || trade.openFee || 0)], ["TRADE DURATION", duration(trade.opened, trade.closed)],
    ];
    facts.forEach(([label, value], index) => {
      const col = index % 2, row = Math.floor(index / 2), x = 610 + col * 270, y = 145 + row * 132;
      ctx.fillStyle = "rgba(7,18,25,.72)"; ctx.strokeStyle = "rgba(112,151,165,.28)"; ctx.beginPath(); ctx.roundRect(x, y, 248, 108, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7897a4"; ctx.font = "600 13px Arial"; ctx.fillText(label, x + 19, y + 29);
      ctx.fillStyle = "#eef6f8"; ctx.font = `700 ${String(value).length > 18 ? 18 : 24}px Arial`; ctx.fillText(String(value).replace("−", "-"), x + 19, y + 70);
    });
    ctx.fillStyle = "#718f9d"; ctx.font = "500 14px Arial";
    ctx.fillText(liquidated ? `${cash(trade.marginLost || trade.margin).replace("−", "-")} isolated margin exhausted · ${cash(trade.liquidationFee || 0).replace("−", "-")} liquidation fee` : `Closed by ${trade.reason || "Manual close"}`, 60, 555);
    ctx.fillStyle = "#5f808e"; ctx.font = "500 13px Arial"; ctx.fillText("SIMULATED RESULT · NO REAL FUNDS · NOT FINANCIAL ADVICE", 60, 622);
    ctx.textAlign = "right"; ctx.fillText(String(trade.closed || "Completed trade"), 1140, 622); ctx.textAlign = "left";
    return canvas.toDataURL("image/png", 1);
  };
  useEffect(() => { const timer = setTimeout(() => { const url = paint(); if (url) setImageUrl(url); }, 0); return () => clearTimeout(timer); }, [trade]);
  useEffect(() => { const key = (event: KeyboardEvent) => event.key === "Escape" && close(); addEventListener("keydown", key); return () => removeEventListener("keydown", key); }, [close]);
  const download = () => { const url = imageUrl || paint(); if (!url) return; const link = document.createElement("a"); link.href = url; link.download = `paperforge-${pair.toLowerCase()}-trade-card.png`; link.click(); setImageUrl(url); setMessage("Trade card downloaded."); };
  const share = async () => { const url = imageUrl || paint(); if (!url) return; try { const blob = await (await fetch(url)).blob(), file = new File([blob], "paperforge-trade.png", { type: "image/png" }); if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `My ${pair} paper trade` }); setMessage("Share sheet opened."); } else download(); } catch { setMessage("Sharing was unavailable. Download the PNG instead."); } };
  return <div className="trade-card-backdrop" role="dialog" aria-modal="true" aria-labelledby="trade-card-title" onMouseDown={event=>event.target===event.currentTarget&&close()}><section className="trade-card-dialog"><button className="trade-card-close" onClick={close} aria-label="Close trade card">×</button><div className="trade-card-copy"><span>SHAREABLE TRADE RESULT</span><h2 id="trade-card-title">{pair} · {trade.reason || "Closed trade"}</h2><p>A privacy-safe image of this simulated trade. It excludes your name, email and account identifiers.</p><div><button className="primary" onClick={download}>Download PNG</button><button className="secondary" onClick={share}>Share image</button></div><small aria-live="polite">{message}</small></div><div className={`trade-card-preview ${liquidated ? "liquidated" : ""}`}>{imageUrl ? <img src={imageUrl} alt={`${pair} simulated trade result card`} /> : <span>Generating card…</span>}</div></section></div>;
}
