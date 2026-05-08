import { describe, expect, it, vi } from "vitest";
import { loadSnapshot, tariffFor } from "../lib/data.js";
import type { Parking, Tariff } from "@cheap-park/tariff";

const sampleParkings = {
  generatedAt: "2026-05-08T04:00:00Z",
  source: "test",
  parkings: [
    {
      id: "P-1",
      name: "Test 1",
      owner: "Test",
      lat: 57.7,
      lng: 11.97,
      spaces: 5,
      tariffId: "free-30min",
      maxParkingMinutes: 30,
      raw: {},
    },
    {
      id: "P-2",
      name: "Test 2",
      owner: "Test",
      lat: 57.71,
      lng: 11.98,
      spaces: 3,
      tariffId: null,
      maxParkingMinutes: null,
      raw: {},
    },
  ],
};

const sampleTariffs = {
  tariffs: [
    {
      id: "free-30min",
      name: "Avgiftsfri 30 min",
      rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
    },
  ],
};

describe("loadSnapshot", () => {
  it("fetches and combines parkings + tariffs", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("parkings.json")) {
        return new Response(JSON.stringify(sampleParkings));
      }
      if (url.endsWith("tariffs.json")) {
        return new Response(JSON.stringify(sampleTariffs));
      }
      throw new Error(`unexpected url ${url}`);
    });
    const snap = await loadSnapshot({ basePath: "/data", fetcher: fetcher as typeof fetch });
    expect(snap.parkings.length).toBe(2);
    expect(snap.tariffs.size).toBe(1);
    expect(snap.tariffs.get("free-30min")?.name).toBe("Avgiftsfri 30 min");
    expect(snap.generatedAt.toISOString()).toBe("2026-05-08T04:00:00.000Z");
  });

  it("propagates fetch error", async () => {
    const fetcher = vi.fn(async () => new Response("err", { status: 500 }));
    await expect(
      loadSnapshot({ basePath: "/data", fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow();
  });
});

describe("tariffFor", () => {
  const tariffs = new Map<string, Tariff>([
    [
      "free-30min",
      {
        id: "free-30min",
        name: "Free 30",
        rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
      },
    ],
  ]);

  it("returns tariff when parking has matching id", () => {
    const p = { tariffId: "free-30min" } as Parking;
    expect(tariffFor(p, tariffs)?.id).toBe("free-30min");
  });

  it("returns null when tariffId is null", () => {
    const p = { tariffId: null } as Parking;
    expect(tariffFor(p, tariffs)).toBeNull();
  });

  it("returns null when tariffId is unknown", () => {
    const p = { tariffId: "missing" } as Parking;
    expect(tariffFor(p, tariffs)).toBeNull();
  });
});
