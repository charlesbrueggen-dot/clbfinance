// stock-price.js
export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  const sym = encodeURIComponent(symbol.trim().toUpperCase());

  try {
    // ── Primary: Yahoo Finance v10 quoteSummary ─────────────
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=price,assetProfile`;

    const summaryRes = await fetch(summaryUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (summaryRes.ok) {
      const json = await summaryRes.json();
      const result = json?.quoteSummary?.result?.[0];
      const price = result?.price;
      const profile = result?.assetProfile;

      if (price) {
        return res.status(200).json({
          price: price.regularMarketPrice?.raw ?? null,
          name: price.longName || price.shortName ?? "",
          sector: profile?.sector ?? "",
          industry: profile?.industry ?? "",
          exchange: price.exchangeName ?? "",
          currency: price.currency ?? "USD",
          change: price.regularMarketChange?.raw ?? null,
          changePct: price.regularMarketChangePercent?.raw ?? null,
        });
      }
    }

    // ── Fallback: Yahoo Finance v8 chart ─────────────
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    if (chartRes.ok) {
      const cjson = await chartRes.json();
      const meta = cjson?.chart?.result?.[0]?.meta;

      if (meta) {
        return res.status(200).json({
          price: meta.regularMarketPrice ?? null,
          name: meta.longName || meta.shortName ?? "",
          sector: "",
          industry: "",
          exchange: meta.exchangeName ?? "",
          currency: meta.currency ?? "USD",
          change: null,
          changePct: null,
        });
      }
    }

    return res.status(404).json({ error: "Symbol not found or market closed" });
  } catch (err) {
    console.error("Stock Proxy Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch price", details: err.message });
  }
}
