import { describe, expect, it } from "vitest";
import { sanityCheckCity, sanityCheckAll } from "../src/sanity.js";

describe("sanityCheckCity", () => {
  it("ok when previous is 0 (bootstrap)", () => {
    expect(sanityCheckCity({ city: "stockholm", newCount: 5, lastCount: 0 }).ok).toBe(true);
  });
  it("ok at exactly 80% retained", () => {
    expect(sanityCheckCity({ city: "goteborg", newCount: 80, lastCount: 100 }).ok).toBe(true);
  });
  it("fails when more than 20% dropped", () => {
    const r = sanityCheckCity({ city: "goteborg", newCount: 79, lastCount: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/goteborg/);
  });
  it("fails when a city goes to zero", () => {
    expect(sanityCheckCity({ city: "stockholm", newCount: 0, lastCount: 100 }).ok).toBe(false);
  });
});

describe("sanityCheckAll", () => {
  it("ok only when every city passes", () => {
    const r = sanityCheckAll(
      { goteborg: 100, stockholm: 200 },
      { goteborg: 95, stockholm: 50 },
    );
    expect(r.ok).toBe(false); // stockholm dropped 75%
  });
  it("ok when all within threshold", () => {
    const r = sanityCheckAll(
      { goteborg: 100, stockholm: 200 },
      { goteborg: 95, stockholm: 190 },
    );
    expect(r.ok).toBe(true);
  });
});
