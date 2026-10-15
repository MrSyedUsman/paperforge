/** Presentation geometry only; financial values always come from validated facts. */
export function progressWidth(used: number, required: number): number | null {
  return Number.isFinite(used) && Number.isFinite(required) && used >= 0 && required > 0
    ? Math.min(100, used / required * 100) : null;
}
export function signedWidth(value: number | null, maximum: number): number {
  return value !== null && Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0
    ? Math.min(50, Math.abs(value) / maximum * 50) : 0;
}
export function feeWidth(gross: number | null, fees: number | null): number | null {
  return gross !== null && fees !== null && Number.isFinite(gross) && Number.isFinite(fees) && gross > 0 && fees >= 0
    ? Math.min(100, fees / gross * 100) : null;
}
