export async function fetchFirst(urls: string[]) {
  let last: unknown;
  for (const url of urls) {
    // Allow the server to try its three upstreams (five seconds each).
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 16000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      last = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error("Market data unavailable");
}
