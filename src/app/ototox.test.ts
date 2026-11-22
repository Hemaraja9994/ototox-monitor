import { describe, expect, it } from "vitest";
import { FREQS, compareEar, parseCell, type EarMap } from "./ototox";

const flat = (v: number): EarMap => Object.fromEntries(FREQS.map(f => [f, v]));

describe("parseCell", () => {
  it("reads numbers, NR and blanks", () => {
    expect(parseCell("40")).toBe(40); expect(parseCell("nr")).toBe("NR"); expect(parseCell("N")).toBe("NR"); expect(parseCell("")).toBe(null);
  });
  it("rejects out-of-range", () => { expect(parseCell("200")).toBeUndefined(); expect(parseCell("-20")).toBeUndefined(); expect(parseCell("x")).toBeUndefined(); });
});

describe("ASHA 1994 criteria", () => {
  it("no shift when thresholds are unchanged", () => expect(compareEar(flat(20), flat(20)).met).toBe(false));
  it("criterion A: 20 dB at a single frequency", () => {
    const now = { ...flat(20), 4000: 40 };
    const r = compareEar(flat(20), now);
    expect(r.a).toEqual([4000]); expect(r.met).toBe(true);
  });
  it("a single 15 dB shift alone does not meet criteria", () => {
    const r = compareEar(flat(20), { ...flat(20), 4000: 35 });
    expect(r.met).toBe(false);
  });
  it("criterion B: 10 dB at two adjacent frequencies", () => {
    const now = { ...flat(20), 3000: 30, 4000: 32 };
    const r = compareEar(flat(20), now);
    expect(r.b).toEqual([[3000, 4000]]); expect(r.met).toBe(true);
  });
  it("10 dB at two non-adjacent frequencies does not meet B", () => {
    const now = { ...flat(20), 1000: 30, 4000: 30 };
    const r = compareEar(flat(20), now);
    expect(r.b.length).toBe(0); expect(r.met).toBe(false);
  });
  it("criterion C: no response at three consecutive tested frequencies", () => {
    const now: EarMap = { ...flat(20), 11200: "NR", 12500: "NR", 14000: "NR" };
    const r = compareEar(flat(20), now);
    expect(r.c.length).toBe(1); expect(r.met).toBe(true);
  });
  it("ignores frequencies not tested at both visits", () => {
    const base: EarMap = { 1000: 20, 2000: 20 };
    const now: EarMap = { 1000: 45 };
    const r = compareEar(base, now);
    expect(r.a).toEqual([1000]);
    expect(r.shifts.filter(s => s.tested).length).toBe(1);
  });
});
