import { describe, expect, it } from "vitest";
import { sanityCheck } from "../src/sanity.js";

describe("sanityCheck", () => {
  it("passes when count is equal", () => {
    expect(sanityCheck({ newCount: 100, lastCount: 100 })).toEqual({ ok: true });
  });

  it("passes when count grows", () => {
    expect(sanityCheck({ newCount: 110, lastCount: 100 })).toEqual({ ok: true });
  });

  it("passes when drop is exactly 10%", () => {
    expect(sanityCheck({ newCount: 90, lastCount: 100 })).toEqual({ ok: true });
  });

  it("fails when drop exceeds 10%", () => {
    const result = sanityCheck({ newCount: 89, lastCount: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/dropped/i);
  });

  it("passes any value when lastCount is 0 (first run)", () => {
    expect(sanityCheck({ newCount: 5000, lastCount: 0 })).toEqual({ ok: true });
  });

  it("fails when newCount is 0 and lastCount is non-zero", () => {
    const result = sanityCheck({ newCount: 0, lastCount: 100 });
    expect(result.ok).toBe(false);
  });
});
