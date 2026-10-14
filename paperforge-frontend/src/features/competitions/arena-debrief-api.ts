import { API_URL } from "@/features/auth/api-client";
import {
  validateArenaFacts,
  validateArenaDebrief,
  type ArenaPayload,
} from "./arena-debrief-contract";
async function post(
  path: string,
  snapshot: ArenaPayload,
  token: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${API_URL}/arena-debriefs${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(snapshot),
    signal,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Your session expired. Sign in again to request a debrief.",
      );
    if (response.status === 429)
      throw new Error(
        "Please wait before requesting another new AI review or debrief.",
      );
    if (response.status === 413)
      throw new Error(
        "This arena is too large to debrief. Its results have not been changed.",
      );
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Arena Debrief is unavailable. Please try again.",
    );
  }
  return data;
}
export async function fetchArenaFacts(
  snapshot: ArenaPayload,
  token: string,
  signal: AbortSignal,
) {
  return validateArenaFacts(
    await post("/facts", snapshot, token, signal),
    snapshot,
  );
}
export async function fetchArenaDebrief(
  snapshot: ArenaPayload,
  token: string,
  signal: AbortSignal,
) {
  return validateArenaDebrief(
    await post("", snapshot, token, signal),
    snapshot,
  );
}
