 
"use client";
import { useEffect, useRef, useState } from "react";
import { money } from "./constants";
export function LiveMetric({ value, format = money, arrow = false, tone = "" }: { value: number; format?: (value: number) => string; arrow?: boolean; tone?: string }) {
  const previous = useRef(value);
  const [tick, setTick] = useState<{ direction: "up" | "down" | ""; id: number }>({ direction: "", id: 0 });
  useEffect(() => {
    if (!Number.isFinite(value) || value === previous.current) return;
    const direction = value > previous.current ? "up" : "down";
    previous.current = value;
    setTick((current) => ({ direction, id: current.id + 1 }));
    const timer = setTimeout(() => setTick((current) => ({ ...current, direction: "" })), 720);
    return () => clearTimeout(timer);
  }, [value]);
  return <span key={tick.id} className={`bc-live-metric ${tone} ${tick.direction ? `tick-${tick.direction}` : ""}`} aria-label={format(value)}>{arrow && tick.direction && <i aria-hidden="true">{tick.direction === "up" ? "▲" : "▼"}</i>}{format(value)}</span>;
}

