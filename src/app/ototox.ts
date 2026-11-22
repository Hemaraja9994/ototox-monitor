/* Serial pure-tone monitoring for ototoxicity, using the ASHA (1994) criteria for a
   significant threshold shift from baseline:
     A) ≥ 20 dB at any one frequency;
     B) ≥ 10 dB at two adjacent frequencies;
     C) loss of response (no response) at three consecutive frequencies previously tested.
   Includes the extended high frequencies (9–16 kHz), which change earliest with ototoxic drugs. */

export const FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000, 9000, 10000, 11200, 12500, 14000, 16000];
export const EHF_FROM = 9000;
export const freqLabel = (f: number): string => f >= 1000 ? `${f / 1000}k` : String(f);

export type Threshold = number | "NR";
export type EarMap = Record<string, Threshold>;
export interface Test { id: string; date: string; baseline: boolean; retest: boolean; note: string; R: EarMap; L: EarMap }
export interface Patient { id: string; code: string; drug: string; start: string | null; tests: Test[] }

/** Parse a typed cell: a number (−10..130), "NR", blank (null), or invalid (undefined). */
export function parseCell(v: unknown): Threshold | null | undefined {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "NR" || s === "N") return "NR";
  const n = Number(s);
  return Number.isFinite(n) && n >= -10 && n <= 130 ? n : undefined;
}

export interface Shift { f: number; tested: boolean; shift?: number | null; lost?: boolean; note?: string }
export interface EarCompare { shifts: Shift[]; a: number[]; b: number[][]; c: number[][]; met: boolean }

export function compareEar(base: EarMap | undefined, now: EarMap | undefined): EarCompare {
  const shifts: Shift[] = FREQS.map(f => {
    const b = base?.[f], c = now?.[f];
    if (b == null || c == null) return { f, tested: false };
    if (b === "NR") return { f, tested: true, shift: null, note: "baseline NR" };
    if (c === "NR") return { f, tested: true, shift: null, lost: true };
    return { f, tested: true, shift: (c as number) - (b as number) };
  });
  const tested = shifts.filter(s => s.tested);
  const a = tested.filter(s => s.shift != null && s.shift >= 20).map(s => s.f);
  const b: number[][] = [];
  for (let i = 0; i < tested.length - 1; i++) {
    const x = tested[i], y = tested[i + 1];
    if (x.shift != null && y.shift != null && x.shift >= 10 && y.shift >= 10) b.push([x.f, y.f]);
  }
  const c: number[][] = [];
  for (let i = 0; i < tested.length - 2; i++) {
    if (tested[i].lost && tested[i + 1].lost && tested[i + 2].lost) c.push([tested[i].f, tested[i + 1].f, tested[i + 2].f]);
  }
  return { shifts, a, b, c, met: a.length > 0 || b.length > 0 || c.length > 0 };
}

export const baselineOf = (p: Patient): Test | null =>
  [...p.tests].sort((x, y) => x.date.localeCompare(y.date)).find(t => t.baseline) ?? null;

export function criteriaText(r: EarCompare): string[] {
  const out: string[] = [];
  if (r.a.length) out.push(`A: ≥ 20 dB at ${r.a.map(freqLabel).join(", ")} Hz`);
  if (r.b.length) out.push(`B: ≥ 10 dB at ${r.b.map(p => p.map(freqLabel).join("+")).join("; ")} Hz`);
  if (r.c.length) out.push(`C: no response at ${r.c.map(p => p.map(freqLabel).join("+")).join("; ")} Hz`);
  return out;
}
