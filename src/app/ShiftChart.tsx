/* Bar-per-frequency chart of the threshold shift from baseline. Down = worse. 10 and 20 dB
   lines mark the ASHA concern levels; no-response frequencies are marked NR. */
import { EHF_FROM, freqLabel, type EarCompare } from "./ototox";

export function ShiftChart({ r, ear }: { r: EarCompare; ear: "R" | "L" }) {
  const W = 640, H = 180, L = 34, T = 14, B = 26;
  const n = r.shifts.length;
  const X = (i: number) => L + i * ((W - L - 10) / (n - 1));
  const Y = (v: number) => T + (Math.max(-20, Math.min(50, v)) + 20) * ((H - T - B) / 70);
  const col = ear === "R" ? "var(--color-right)" : "var(--color-left)";
  const label = r.shifts.map(s => `${freqLabel(s.f)} ${s.lost ? "no response" : s.shift == null ? "not compared" : s.shift >= 0 ? "+" + s.shift : s.shift}`).join(", ");
  return (
    <figure className="m-0 mt-2">
      <figcaption className="text-[0.85rem] font-bold" style={{ color: col }}>{ear === "R" ? "Right ear" : "Left ear"}: shift from baseline (dB, down = worse)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={`Threshold shift by frequency, ${ear === "R" ? "right" : "left"} ear: ${label}`}>
        {[-20, -10, 0, 10, 20, 30, 40, 50].map(v => (
          <g key={v}>
            <line x1={L} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke={v === 10 || v === 20 ? "var(--color-mid)" : "var(--color-line)"} strokeWidth={v === 0 ? 1.4 : 0.7} strokeDasharray={v === 10 || v === 20 ? "4 3" : undefined} />
            <text x={L - 5} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{v}</text>
          </g>
        ))}
        {r.shifts.map((s, i) => (
          <g key={s.f}>
            <text x={X(i)} y={H - 6} textAnchor="middle" fontSize={11} fill={s.f >= EHF_FROM ? "var(--color-accent)" : "var(--color-muted)"}>{freqLabel(s.f)}</text>
            {s.tested && s.lost && <text x={X(i)} y={Y(45)} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-high)">NR</text>}
            {s.tested && s.shift != null && <line x1={X(i)} x2={X(i)} y1={Y(0)} y2={Y(s.shift)} stroke={s.shift >= 20 ? "var(--color-high)" : s.shift >= 10 ? "var(--color-mid)" : "var(--color-ok)"} strokeWidth={10} />}
          </g>
        ))}
      </svg>
    </figure>
  );
}
