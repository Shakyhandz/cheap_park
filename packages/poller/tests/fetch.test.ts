import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllParkings } from "../src/fetch.js";
import sample from "./fixtures/api-toll-sample.json";

describe("fetchAllParkings", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("PublicTollParkings")) {
        return new Response(JSON.stringify(sample), { status: 200 });
      }
      if (u.includes("PublicTimeParkings")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error(`unexpected url: ${u}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns combined toll + time parkings", async () => {
    const result = await fetchAllParkings("test-appid");
    expect(result.toll.length).toBe(2);
    expect(result.time.length).toBe(0);
  });

  it("includes APPID in the request URL", async () => {
    await fetchAllParkings("MY-APPID");
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const urls = calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("MY-APPID"))).toBe(true);
  });

  it("throws on non-200 response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("error", { status: 500 }),
    ) as typeof fetch;
    await expect(fetchAllParkings("test")).rejects.toThrow();
  });
});
