import { describe, expect, it } from "vitest";
import { money, parseMoney, split } from "../../src/split";

describe("split", () => {
  it("splits 100 with 20% tip between 4 as 30.00 each", () => {
    expect(split(10000, 20, 4)).toEqual({
      billCents: 10000,
      tipCents: 2000,
      totalCents: 12000,
      shareCents: 3000,
    });
  });
  it("rounds each share up to the cent, never down", () => {
    const r = split(5000, 18, 3)!;
    expect(r.totalCents).toBe(5900);
    expect(money(r.shareCents)).toBe("19.67");
    expect(r.shareCents * 3).toBeGreaterThanOrEqual(r.totalCents);
  });
  it("accepts a custom percentage including 0", () => {
    expect(split(2000, 0, 1)!.shareCents).toBe(2000);
    expect(split(2000, 12.5, 1)!.tipCents).toBe(250);
  });
  it("returns null without a bill, a tip or at least 1 person", () => {
    expect(split(0, 18, 2)).toBeNull();
    expect(split(1000, -1, 2)).toBeNull();
    expect(split(1000, 18, 0)).toBeNull();
    expect(split(1000, 18, 1.5)).toBeNull();
    expect(split(Number.NaN, 18, 2)).toBeNull();
  });
});

describe("parseMoney", () => {
  it("reads dots and commas", () => {
    expect(parseMoney("50")).toBe(5000);
    expect(parseMoney("50.5")).toBe(5050);
    expect(parseMoney("50,25")).toBe(5025);
  });
  it("rejects empty, text and negatives", () => {
    for (const t of ["", " ", ".", "abc", "-5", "1.2.3"]) expect(parseMoney(t)).toBeNull();
  });
});
