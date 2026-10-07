export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type ApiUser = {
  username: string;
  displayName: string;
};

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(response.status === 401 ? "Invalid username or password" : body?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  me: (token: string) => request<ApiUser>("/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
};
