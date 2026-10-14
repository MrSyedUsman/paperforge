import "@/styles/coin-icon.css";
import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/readability.css";
import "@/styles/markets.css";
import "@/styles/trading.css";
import "@/styles/experience.css";
import "@/styles/ux-polish.css";
import "@/styles/advanced-chart.css";
import "@/styles/home.css";
import "@/styles/theme-slider.css";
import "@/styles/table-theme.css";
import "@/styles/bot-competition.css";
import "@/styles/bot-guide.css";
import "@/styles/leaderboards.css";
import "@/styles/auth.css";
import "@/styles/header.css";
import "@/styles/trade-review.css";
import "@/styles/trade-risk.css";
export const metadata: Metadata = {
  title: "PaperForge Futures",
  description: "Practise crypto futures trading with virtual funds, live market data, and bot competitions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
