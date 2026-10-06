const BINANCE_FUTURES = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com"];
const ALLOWED_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  let path = "";

  if (resource === "exchangeInfo") path = "/fapi/v1/exchangeInfo";
  if (resource === "ticker24hr") path = "/fapi/v1/ticker/24hr";
  if (resource === "premiumIndex") path = "/fapi/v1/premiumIndex";
  if (resource === "klines") {
    const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
    const interval = url.searchParams.get("interval") ?? "1h";
    if (!/^[A-Z0-9]{3,24}USDT$/.test(symbol) || !ALLOWED_INTERVALS.has(interval)) {
      return Response.json({ error: "Invalid market or interval" }, { status: 400 });
    }
    const requestedLimit = Number(url.searchParams.get("limit") ?? 120);
    const limit = Number.isInteger(requestedLimit) ? Math.min(500, Math.max(30, requestedLimit)) : 120;
    path = `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  }

  if (!path) return Response.json({ error: "Unsupported resource" }, { status: 400 });

  for (const origin of BINANCE_FUTURES) {
    try {
      const response = await fetch(`${origin}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: resource === "exchangeInfo" ? 300 : 3 },
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data) && resource !== "exchangeInfo") continue;
      return Response.json(data, {
        headers: {
          "Cache-Control": resource === "exchangeInfo"
            ? "public, max-age=60, s-maxage=300"
            : "public, max-age=2, s-maxage=3",
        },
      });
    } catch {}
  }
  return Response.json({ error: "Binance Futures market data is temporarily unavailable" }, { status: 503 });
}
