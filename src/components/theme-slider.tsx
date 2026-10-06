"use client";

import type { CSSProperties, InputHTMLAttributes } from "react";

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "max" | "value"> & {
  min: number;
  max: number;
  value: number;
};

export function ThemeSlider({ min, max, value, className = "", style, ...props }: SliderProps) {
  const progress = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return <input {...props} type="range" min={min} max={max} value={value}
    className={`pf-range ${className}`.trim()}
    style={{ ...style, "--range-progress": `${progress}%` } as CSSProperties} />;
}
