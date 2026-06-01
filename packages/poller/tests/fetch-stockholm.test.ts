import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchStockholm } from "../src/fetch-stockholm.js";

describe("fetchStockholm", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("calls ptillaten/all with the api key and json format", async () => {
    const urls: string[] = [];
    globalThis.fetch = vi.fn(async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 });
    }) as typeof fetch;

    await fetchStockholm("KEY123");
    expect(urls[0]).toContain("/LTF-Tolken/v1/ptillaten/all");
    expect(urls[0]).toContain("outputFormat=json");
    expect(urls[0]).toContain("apiKey=KEY123");
  });

  it("throws on non-ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as typeof fetch;
    await expect(fetchStockholm("X")).rejects.toThrow(/403/);
  });

  it("returns the parsed feature collection", async () => {
    const fc = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [18, 59] }, properties: {} }] };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(fc), { status: 200 })) as typeof fetch;
    const out = await fetchStockholm("X");
    expect(out.features).toHaveLength(1);
  });
});
