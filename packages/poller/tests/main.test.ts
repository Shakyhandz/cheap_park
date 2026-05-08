import { describe, expect, it, vi } from "vitest";
import { runPoll } from "../src/main.js";
import sample from "./fixtures/api-toll-sample.json";

describe("runPoll", () => {
  it("writes parkings.json with normalized data on success", async () => {
    const writes = new Map<string, string>();
    const result = await runPoll({
      appId: "test",
      readPrevious: async () => ({ parkings: [] }),
      writeJson: async (path, data) => {
        writes.set(path, JSON.stringify(data));
      },
      fetcher: async () => ({ toll: sample as never, time: [] }),
    });
    expect(result.committed).toBe(true);
    expect(writes.has("apps/web/public/data/parkings.json")).toBe(true);
    expect(writes.has("apps/web/public/data/tariffs.json")).toBe(true);
  });

  it("aborts without writing when sanity check fails", async () => {
    const writes = new Map<string, string>();
    const result = await runPoll({
      appId: "test",
      readPrevious: async () => ({ parkings: new Array(100).fill({ id: "x" }) }),
      writeJson: async (path, data) => {
        writes.set(path, JSON.stringify(data));
      },
      fetcher: async () => ({ toll: sample as never, time: [] }),
    });
    expect(result.committed).toBe(false);
    expect(writes.size).toBe(0);
    if (!result.committed) expect(result.reason).toMatch(/dropped/);
  });

  it("propagates fetcher errors", async () => {
    await expect(
      runPoll({
        appId: "test",
        readPrevious: async () => ({ parkings: [] }),
        writeJson: async () => {},
        fetcher: async () => {
          throw new Error("network down");
        },
      }),
    ).rejects.toThrow("network down");
  });
});
