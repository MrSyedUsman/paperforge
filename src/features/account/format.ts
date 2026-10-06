export const money = (n: number) =>
  `${n >= 0 ? "" : "-"}$${Math.abs(n || 0).toFixed(2)}`;
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "PF";

