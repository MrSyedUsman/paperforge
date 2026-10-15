import { API_URL } from "@/features/auth/api-client";
import {
  validateRadarFacts,
  validateRadarResult,
  type RadarRequest,
} from "./arena-radar-contract";
export class RadarError extends Error {
  constructor(
    message: string,
    readonly cooldownUntil = 0,
  ) {
    super(message);
  }
}
async function post(
  path: string,
  input: RadarRequest,
  token: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${API_URL}/arena-radar${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal,
      cache: "no-store",
    }),
    data = await response.json().catch(() => null);
  if (!response.ok) {
    const until =
      typeof data?.cooldownUntil === "number"
        ? data.cooldownUntil
        : typeof data?.retryAfterSeconds === "number"
          ? Date.now() + data.retryAfterSeconds * 1000
          : 0;
    throw new RadarError(
      response.status === 401
        ? "Your session expired. Sign in again."
        : response.status === 413
          ? "This arena snapshot is too large for Radar."
          : typeof data?.message === "string"
            ? data.message
            : "Arena Radar is unavailable. Please try again later.",
      until,
    );
  }
  return data;
}
export async function fetchRadarFacts(
  input: RadarRequest,
  token: string,
  signal: AbortSignal,
) {
  return validateRadarFacts(await post("/facts", input, token, signal), input);
}
export async function fetchRadar(
  input: RadarRequest,
  token: string,
  signal: AbortSignal,
) {
  return validateRadarResult(await post("", input, token, signal), input);
}
