/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { money } from "./constants";
import { finite, competitionCardMetrics } from "./engine";
export function CompetitionShareCard({ user, lobby, quotes }: any) {
  const [imageUrl, setImageUrl] = useState(""),
    [message, setMessage] = useState("");
  const metrics = competitionCardMetrics(user, lobby, quotes),
    positive = metrics.netReturn >= 0,
    best = metrics.best,
    subjectLabel = user.isUser ? "YOUR RESULT" : `${user.name} · ${user.strategy}`;
  const signed = (value: number, suffix = "") =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
  const bestRoi =
    best && finite(best.margin) > 0
      ? (finite(best.pnl) / finite(best.margin)) * 100
      : 0;
  const bestSummary = best
    ? `${best.pair} · ${best.side} ${best.lev}×`
    : "No completed trades";
  const rounded = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const paint = () => {
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx) return "";
    canvas.width = 1200;
    canvas.height = 675;
    const bg = ctx.createLinearGradient(0, 0, 1200, 675);
    bg.addColorStop(0, "#071017");
    bg.addColorStop(0.58, "#0b1720");
    bg.addColorStop(1, "#10241f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 675);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#65a5b6";
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 675);
      ctx.stroke();
    }
    for (let y = 0; y < 675; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(1030, 90, 0, 1030, 90, 430);
    glow.addColorStop(0, "rgba(55,212,154,.25)");
    glow.addColorStop(1, "rgba(55,212,154,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(600, 0, 600, 520);
    ctx.fillStyle = "#39d8a0";
    rounded(ctx, 58, 48, 58, 58, 15);
    ctx.fill();
    ctx.fillStyle = "#06130f";
    ctx.font = "800 34px Arial";
    ctx.fillText("P", 76, 88);
    ctx.fillStyle = "#f2f7fa";
    ctx.font = "700 30px Arial";
    ctx.fillText("Paper", 136, 86);
    ctx.fillStyle = "#39d8a0";
    ctx.fillText("Forge", 223, 86);
    ctx.fillStyle = "#82a6b4";
    ctx.font = "600 15px Arial";
    ctx.letterSpacing = "3px";
    ctx.fillText("VIRTUAL COMPETITION RESULT", 60, 145);
    ctx.textAlign = "right";
    ctx.fillStyle = user.isUser ? "#82a6b4" : "#39d8a0";
    ctx.font = "700 15px Arial";
    ctx.fillText(subjectLabel.toUpperCase(), 1140, 86);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";
    ctx.fillStyle = metrics.isWinner ? "#39d8a0" : "#f2f7fa";
    ctx.font = metrics.isWinner ? "800 64px Arial" : "700 74px Arial";
    ctx.fillText(
      metrics.isWinner ? "WINNER" : `#${metrics.equityRank}`,
      60,
      245,
    );
    ctx.font = "600 22px Arial";
    ctx.fillStyle = "#9bb5c0";
    ctx.fillText(
      metrics.rawLeaderNoAward
        ? `of ${lobby.players.length} · raw equity place`
        : metrics.promotedWinner
        ? `#1 eligible · #${metrics.equityRank} by raw equity`
        : metrics.isWinner
          ? "#1 eligible · competition winner"
          : `of ${lobby.players.length} competitors`,
      60,
      277,
    );
    ctx.fillStyle = positive ? "#39d8a0" : "#ff6277";
    ctx.font = "700 46px Arial";
    ctx.fillText(signed(metrics.netReturn, "%"), 60, 318);
    ctx.fillStyle = "#8ca8b5";
    ctx.font = "500 18px Arial";
    ctx.fillText("NET COMPETITION RETURN", 60, 351);
    ctx.strokeStyle = "rgba(113,151,165,.3)";
    ctx.beginPath();
    ctx.moveTo(60, 390);
    ctx.lineTo(530, 390);
    ctx.stroke();
    const eligibleLabel = metrics.rawLeaderNoAward
        ? "ELIGIBILITY NOT MET"
        : metrics.promotedWinner
        ? "WIN AWARDED · ELIGIBILITY REVIEW"
        : metrics.isWinner
          ? "COMPETITION WINNER"
          : metrics.eligible
            ? "WINNER ELIGIBLE"
            : "NOT WINNER ELIGIBLE",
      eligibleWidth = metrics.rawLeaderNoAward
        ? 220
        : metrics.promotedWinner
        ? 315
        : metrics.isWinner
          ? 215
          : metrics.eligible
            ? 190
            : 225;
    ctx.fillStyle = metrics.eligible
      ? "rgba(57,216,160,.13)"
      : "rgba(247,184,75,.12)";
    ctx.strokeStyle = metrics.eligible
      ? "rgba(57,216,160,.55)"
      : "rgba(247,184,75,.55)";
    rounded(ctx, 60, 404, eligibleWidth, 42, 21);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = metrics.eligible ? "#39d8a0" : "#f7b84b";
    ctx.beginPath();
    ctx.arc(82, 425, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#071017";
    ctx.textAlign = "center";
    ctx.font = "800 15px Arial";
    ctx.fillText(metrics.eligible ? "✓" : "!", 82, 431);
    ctx.textAlign = "left";
    ctx.fillStyle = metrics.eligible ? "#baf4df" : "#f9d79c";
    ctx.font = "700 14px Arial";
    ctx.fillText(eligibleLabel, 101, 430);
    if (metrics.rawLeaderNoAward) {
      ctx.fillStyle = "#6f909e";
      ctx.font = "600 11px Arial";
      ctx.fillText("OFFICIAL WINNER", 310, 415);
      ctx.fillStyle = metrics.awardedWinnerEquityRank ? "#39d8a0" : "#f7b84b";
      ctx.font = "700 17px Arial";
      ctx.fillText(
        metrics.awardedWinnerEquityRank
          ? `#${metrics.awardedWinnerEquityRank} ELIGIBLE`
          : "NO ELIGIBLE WINNER",
        310,
        439,
      );
    }
    if (!metrics.eligible) {
      ctx.fillStyle = "#d6b56f";
      ctx.font = "600 13px Arial";
      ctx.fillText(metrics.eligibility.reason, 60, 470);
    }
    if (metrics.promotedWinner) {
      ctx.fillStyle = "#6f909e";
      ctx.font = "500 13px Arial";
      ctx.fillText("Raw equity place", 60, 476);
      ctx.fillText("Awarded result", 250, 476);
      ctx.fillStyle = "#f2f7fa";
      ctx.font = "700 20px Arial";
      ctx.fillText(`#${metrics.equityRank} of ${lobby.players.length}`, 60, 502);
      ctx.fillStyle = "#39d8a0";
      ctx.fillText("WINNER · #1", 250, 502);
      ctx.strokeStyle = "rgba(113,151,165,.2)";
      ctx.beginPath();
      ctx.moveTo(60, 520);
      ctx.lineTo(530, 520);
      ctx.stroke();
    }
    const accountLabelY = metrics.promotedWinner
        ? 548
        : metrics.eligible
          ? 486
          : 518,
      accountValueY = metrics.promotedWinner
        ? 576
        : metrics.eligible
          ? 516
          : 548;
    ctx.fillStyle = "#6f909e";
    ctx.font = "500 13px Arial";
    ctx.fillText("Starting allocation", 60, accountLabelY);
    ctx.fillText("Final equity", 225, accountLabelY);
    ctx.fillText("Closed trades", 390, accountLabelY);
    ctx.fillStyle = "#f2f7fa";
    ctx.font = "700 20px Arial";
    ctx.fillText(
      money(lobby.settings.allocation).replace("−", "-"),
      60,
      accountValueY,
    );
    ctx.fillText(
      money(metrics.equity).replace("−", "-"),
      225,
      accountValueY,
    );
    ctx.fillText(String(user.trades.length), 390, accountValueY);
    const boxes = [
      ["MAX DRAWDOWN", `${metrics.maxDrawdown.toFixed(2)}%`],
      ["BEST CLOSED TRADE", bestSummary],
      ["FEES PAID", money(user.fees).replace("−", "-")],
      ["DIFFICULTY", lobby.settings.difficulty],
      ["DURATION", `${lobby.settings.duration} min`],
    ];
    boxes.forEach((item, i) => {
      const col = i % 2,
        row = Math.floor(i / 2),
        x = 610 + col * 260,
        y = 140 + row * 122,
        w = 238,
        h = 100;
      ctx.fillStyle = "rgba(7,18,25,.7)";
      ctx.strokeStyle = "rgba(110,151,165,.28)";
      rounded(ctx, x, y, w, h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7897a4";
      ctx.font = "600 13px Arial";
      ctx.fillText(item[0], x + 18, y + 27);
      ctx.fillStyle = "#eef6f8";
      if (i === 1 && best) {
        ctx.font = "700 17px Arial";
        ctx.fillText(bestSummary, x + 18, y + 52);
        ctx.fillStyle = best.pnl >= 0 ? "#39d8a0" : "#ff6277";
        ctx.font = "700 15px Arial";
        ctx.fillText(
          `${money(best.pnl).replace("−", "-")} net · ${signed(bestRoi, "%")} ROI`,
          x + 18,
          y + 75,
        );
        ctx.fillStyle = "#7897a4";
        ctx.font = "500 11px Arial";
        ctx.fillText(
          `${money(best.margin).replace("−", "-")} margin · ${money(best.size).replace("−", "-")} size`,
          x + 18,
          y + 92,
        );
      } else {
        ctx.font = `700 ${item[1].length > 18 ? 18 : 23}px Arial`;
        ctx.fillText(item[1], x + 18, y + 67);
      }
    });
    ctx.fillStyle = "rgba(7,18,25,.76)";
    ctx.strokeStyle = "rgba(57,216,160,.4)";
    rounded(ctx, 870, 384, 238, 222, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7f9eaa";
    ctx.font = "600 13px Arial";
    ctx.fillText("PAPERFORGE SKILL SCORE", 894, 419);
    ctx.fillStyle = "#f5fafb";
    ctx.font = "800 58px Arial";
    ctx.fillText(String(metrics.skillScore), 894, 492);
    ctx.fillStyle = "#7f9eaa";
    ctx.font = "700 18px Arial";
    ctx.fillText("/ 100", 970, 490);
    ctx.fillStyle = "rgba(76,112,124,.35)";
    rounded(ctx, 894, 523, 190, 14, 7);
    ctx.fill();
    ctx.fillStyle = "#39d8a0";
    rounded(ctx, 894, 523, 190 * (metrics.skillScore / 100), 14, 7);
    ctx.fill();
    ctx.fillStyle = "#7897a4";
    ctx.font = "500 12px Arial";
    ctx.fillText("Placement · return · risk · eligibility", 894, 570);
    ctx.fillStyle = "#678794";
    ctx.font = "500 14px Arial";
    ctx.fillText("Placement · return · drawdown · eligibility", 60, 625);
    ctx.textAlign = "right";
    ctx.fillText("BROWSER-SIMULATED · COMPETITION ONLY", 1140, 625);
    ctx.textAlign = "left";
    return canvas.toDataURL("image/png", 1);
  };
  const generate = () => {
    const url = paint();
    if (url) {
      setImageUrl(url);
      setMessage("Card generated and ready to save.");
    }
  };
  const download = () => {
    const url = imageUrl || paint();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `paperforge-${user.isUser ? "my" : user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-competition-card.png`;
    link.click();
    setImageUrl(url);
    setMessage("Competition card downloaded.");
  };
  const share = async () => {
    const url = imageUrl || paint();
    if (!url) return;
    setImageUrl(url);
    try {
      const blob = await (await fetch(url)).blob(),
        file = new File([blob], "paperforge-competition.png", {
          type: "image/png",
        });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My PaperForge competition result",
        });
        setMessage("Share sheet opened.");
      } else download();
    } catch {
      setMessage("Sharing was unavailable. You can download the PNG instead.");
    }
  };
  return (
    <section
      className="bc-share-card-section"
      aria-labelledby="share-card-title"
    >
      <div className="bc-share-card-copy">
        <small>{user.isUser ? "SHARE YOUR RESULT" : "PARTICIPANT RESULT CARD"}</small>
        <h2 id="share-card-title">{user.isUser ? "Turn this competition into a card" : `Generate ${user.name}'s stats card`}</h2>
        <p>
          {user.isUser ? "A privacy-safe image containing competition performance only. It never includes your name, email, profile information, or account identifiers." : `A themed export of ${user.name}'s bot competition performance, including placement, return, risk, fees and best trade.`}
        </p>
        <div>
          <button className="primary" onClick={generate}>
            {imageUrl ? "Regenerate card" : "Generate share card"}
          </button>
          {imageUrl && (
            <>
              <button className="secondary" onClick={download}>
                Download PNG
              </button>
              <button className="secondary" onClick={share}>
                Share image
              </button>
            </>
          )}
        </div>
        <span aria-live="polite">{message}</span>
      </div>
      <div
        className="bc-share-preview"
        aria-label="Competition result card preview"
      >
        <div className="bc-share-brand">
          <i>P</i>
          <b>
            Paper<em>Forge</em>
          </b>
          <small>VIRTUAL COMPETITION RESULT</small>
          {!user.isUser && <em className="bc-share-subject">{user.name}</em>}
        </div>
        <div className="bc-share-main">
        <div
          className={`bc-share-rank${metrics.promotedWinner ? " promoted" : ""}`}
        >
          <strong>
            {metrics.isWinner
                ? "Winner"
                : `#${metrics.equityRank}`}
          </strong>
          <span>
            {metrics.rawLeaderNoAward
              ? `of ${lobby.players.length}`
              : metrics.isWinner
              ? `#${metrics.awardedRank} eligible`
              : `of ${lobby.players.length}`}
            <small>
              {metrics.rawLeaderNoAward
                ? "RAW EQUITY PLACE"
                : metrics.isWinner
                  ? "AWARDED RESULT"
                  : "FINAL RANK"}
            </small>
          </span>
          {metrics.promotedWinner && (
            <em>Raw equity placement: #{metrics.equityRank} of {lobby.players.length}</em>
          )}
        </div>
        {!metrics.eligible && (
          <div className="bc-share-outcome-note">
            <span>
              <b>Eligibility not met</b>
              <small>{metrics.eligibility.reason}</small>
            </span>
            {metrics.rawLeaderNoAward && (
              <strong>
                {metrics.awardedWinnerEquityRank
                  ? `Win → #${metrics.awardedWinnerEquityRank} eligible`
                  : "No eligible winner"}
              </strong>
            )}
          </div>
        )}
        <div
          className={positive ? "bc-share-return up" : "bc-share-return down"}
        >
          {signed(metrics.netReturn, "%")}
          <small>NET RETURN</small>
        </div>
        <div className="bc-share-allocation">
          <span>
            <small>STARTED WITH</small>
            <b>{money(lobby.settings.allocation)}</b>
          </span>
          <span>
            <small>FINAL EQUITY</small>
            <b>{money(metrics.equity)}</b>
          </span>
          <span>
            <small>CLOSED TRADES</small>
            <b>{user.trades.length}</b>
          </span>
        </div>
        </div>
        <div className="bc-share-mini">
          <span>
            <small>MAX DRAWDOWN</small>
            <b>{metrics.maxDrawdown.toFixed(2)}%</b>
          </span>
          <span className="bc-share-trade">
            <small>BEST CLOSED TRADE</small>
            <b>{bestSummary}</b>
            {best && (
              <>
                <em>
                  {money(best.pnl)} net · {signed(bestRoi, "%")} ROI
                </em>
                <i>
                  {money(best.margin)} margin · {money(best.size)} size
                </i>
              </>
            )}
          </span>
          <span>
            <small>FEES PAID</small>
            <b>{money(user.fees)}</b>
          </span>
          <span>
            <small>DIFFICULTY</small>
            <b>{lobby.settings.difficulty}</b>
          </span>
          <span>
            <small>DURATION</small>
            <b>{lobby.settings.duration} min</b>
          </span>
          <span className="bc-share-score">
            <small>SKILL SCORE</small>
            <b>
              {metrics.skillScore}
              <em>/100</em>
            </b>
            <i style={{ "--score": `${metrics.skillScore}%` } as any} />
          </span>
        </div>
        <footer>
          <span className={metrics.eligible ? "eligible" : "ineligible"}>
            <i>{metrics.eligible ? "✓" : "!"}</i>
            {metrics.rawLeaderNoAward
              ? metrics.awardedWinnerEquityRank
                ? `WIN AWARDED TO #${metrics.awardedWinnerEquityRank} ELIGIBLE`
                : "NO ELIGIBLE WINNER"
              : metrics.promotedWinner
              ? "WIN AWARDED AFTER ELIGIBILITY REVIEW"
              : metrics.isWinner
                ? "COMPETITION WINNER"
                : metrics.eligible
                  ? "WINNER ELIGIBLE"
                  : "NOT WINNER ELIGIBLE"}
          </span>
          <small>COMPETITION ONLY · BROWSER-SIMULATED</small>
        </footer>
      </div>
    </section>
  );
}

