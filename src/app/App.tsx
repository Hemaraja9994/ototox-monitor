/* Ototoxicity Monitor: keep serial audiograms per patient, compare each test with the baseline
   using the ASHA (1994) criteria, show the shift per frequency, and print a report. On-device. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilePlus2, Users } from "lucide-react";
import { AppShell, type Section } from "@/shell/AppShell";
import { Button, Callout, Empty, Field, Input, Panel, Pill, Select, cx } from "@/shell/ui";
import { References } from "@/shell/References";
import { ShiftChart } from "./ShiftChart";
import { usePersistent } from "@/shell/storage";
import { toast } from "@/shell/toast";
import { downloadCSV, esc, fmtDate, printHTML, todayISO, uid } from "@/shell/lib";
import { EHF_FROM, FREQS, baselineOf, compareEar, criteriaText, freqLabel, parseCell, type EarMap, type Patient, type Test } from "./ototox";
import refs from "./refs.json";

const DRUGS = ["Cisplatin", "Carboplatin", "Gentamicin", "Amikacin", "Streptomycin", "Kanamycin (MDR-TB)", "Vancomycin", "Other / combination"];
const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

export default function App() {
  const { t } = useTranslation();
  const [patients, setPatients] = usePersistent<Patient[]>("ototox-patients", []);
  const [view, setView] = useState("list");
  const [selId, setSelId] = useState<string | null>(null);
  const sel = patients.find(p => p.id === selId) ?? null;

  const [pForm, setPForm] = useState({ code: "", drug: DRUGS[0], start: "" });
  const [pErr, setPErr] = useState("");

  const sections: Section[] = [{ id: "list", label: "Patients", icon: Users }, { id: "add", label: "Add patient", icon: FilePlus2 }];
  const go = (id: string) => { setView(id); window.scrollTo({ top: 0 }); };
  const open = (id: string) => { setSelId(id); setView("detail"); window.scrollTo({ top: 0 }); };

  const addPatient = () => {
    const code = pForm.code.trim();
    if (!code) { setPErr("Enter a patient code."); return; }
    if (patients.some(p => p.code.toLowerCase() === code.toLowerCase())) { setPErr("That code already exists."); return; }
    setPErr(""); const id = uid();
    setPatients(ps => [...ps, { id, code, drug: pForm.drug, start: pForm.start || null, tests: [] }]);
    setPForm({ code: "", drug: DRUGS[0], start: "" }); open(id); toast("Patient added");
  };

  return (
    <AppShell title={t("appName")} subtitle={t("appSub")} sections={view === "detail" ? undefined : sections} active={view} onSection={go}
      footer={<><p className="m-0">{t("disclaimer")}</p><p className="m-0">Criteria: ASHA 1994. Thresholds in dB HL; NR = no response. Extended high frequencies (9–16 kHz) shown shaded.</p></>}>

      {view === "list" && (
        <div className="grid gap-5">
          <Panel title={`Patients (${patients.length})`} action={patients.length ? <Button size="sm" onClick={() => csvAll(patients)}>Download CSV</Button> : undefined}>
            {patients.length === 0 ? <Empty>No patients yet. Add one, then record the baseline audiogram first.</Empty> : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {patients.map(p => {
                  const base = baselineOf(p), last = [...p.tests].sort(byDate).at(-1);
                  let flag = <Pill tone="muted">No baseline</Pill>;
                  if (base && last && last.id !== base.id) flag = (compareEar(base.R, last.R).met || compareEar(base.L, last.L).met) ? <Pill tone="high">Shift</Pill> : <Pill tone="ok">Stable</Pill>;
                  else if (base) flag = <Pill tone="info">Baseline only</Pill>;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => open(p.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-left hover:bg-surface">
                        <span><b>{p.code}</b><br /><span className="text-[0.82rem] text-muted">{p.drug} · {p.tests.length} test{p.tests.length === 1 ? "" : "s"}</span></span>{flag}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <References refs={refs} contextQuery="ASHA 1994 criteria significant shift monitoring" contextLabel="How monitoring works" />
        </div>
      )}

      {view === "add" && (
        <Panel title="Add a patient">
          <Field label="Patient code" hint="Use a code, not a name.">{id => <Input id={id} value={pForm.code} onChange={e => setPForm(f => ({ ...f, code: e.target.value }))} maxLength={30} />}</Field>
          <Field label="Medicine">{id => <Select id={id} value={pForm.drug} onChange={e => setPForm(f => ({ ...f, drug: e.target.value }))}>{DRUGS.map(d => <option key={d}>{d}</option>)}</Select>}</Field>
          <Field label="Treatment start (optional)">{id => <Input id={id} type="date" value={pForm.start} max={todayISO()} onChange={e => setPForm(f => ({ ...f, start: e.target.value }))} />}</Field>
          {pErr && <p role="alert" className="m-0 mt-2 font-semibold text-high">{pErr}</p>}
          <div className="mt-4"><Button variant="primary" onClick={addPatient}>Add patient</Button></div>
        </Panel>
      )}

      {view === "detail" && sel && (
        <PatientDetail patient={sel} onBack={() => go("list")}
          onChange={updater => setPatients(ps => ps.map(p => p.id === sel.id ? updater(p) : p))}
          onDelete={() => { setPatients(ps => ps.filter(p => p.id !== sel.id)); setSelId(null); go("list"); toast("Patient deleted"); }} />
      )}
    </AppShell>
  );
}

function csvAll(patients: Patient[]) {
  const rows: (string | number)[][] = [["patient_code", "medicine", "test_date", "type", "ear", ...FREQS.map(f => f + "Hz"), "note"]];
  patients.forEach(p => p.tests.forEach(tst => (["R", "L"] as const).forEach(e =>
    rows.push([p.code, p.drug, tst.date, tst.baseline ? "baseline" : tst.retest ? "retest" : "monitor", e, ...FREQS.map(f => (tst[e][f] ?? "") as string | number), tst.note || ""]))));
  downloadCSV(rows, `ototox-monitoring-${todayISO()}.csv`);
}

function PatientDetail({ patient, onChange, onDelete, onBack }: { patient: Patient; onChange: (u: (p: Patient) => Patient) => void; onDelete: () => void; onBack: () => void }) {
  const tests = useMemo(() => [...patient.tests].sort(byDate), [patient.tests]);
  const base = baselineOf(patient);
  const last = tests.at(-1);
  const [kind, setKind] = useState<"monitor" | "baseline" | "retest">(base ? "monitor" : "baseline");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [cells, setCells] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [confirmPt, setConfirmPt] = useState(false);
  const [confirmTest, setConfirmTest] = useState<string | null>(null);

  const cmp = base && last && last.id !== base.id ? { r: compareEar(base.R, last.R), l: compareEar(base.L, last.L) } : null;

  const saveTest = () => {
    const R: EarMap = {}, L: EarMap = {}; let bad = false, any = false;
    const invalid = new Set<string>();
    for (const e of ["R", "L"] as const) for (const f of FREQS) {
      const v = parseCell(cells[`${e}-${f}`]);
      if (v === undefined) { invalid.add(`${e}-${f}`); bad = true; } else if (v !== null) { (e === "R" ? R : L)[f] = v; any = true; }
    }
    if (bad) { setErr("Use numbers from −10 to 130, or NR."); return; }
    if (!any) { setErr("Enter at least one threshold."); return; }
    setErr("");
    void invalid;
    const test: Test = { id: uid(), date: date || todayISO(), baseline: kind === "baseline", retest: kind === "retest", note: note.trim(), R, L };
    onChange(p => ({ ...p, tests: [...(kind === "baseline" ? p.tests.map(x => ({ ...x, baseline: false })) : p.tests), test] }));
    setCells({}); setNote(""); setKind("monitor"); toast("Test saved");
  };
  const delTest = (id: string) => { if (confirmTest !== id) { setConfirmTest(id); return; } onChange(p => ({ ...p, tests: p.tests.filter(x => x.id !== id) })); setConfirmTest(null); toast("Test deleted"); };

  const printReport = () => {
    const tbl = tests.map(tst => `<h3>${esc(fmtDate(tst.date))}${tst.baseline ? " (baseline)" : tst.retest ? " (retest)" : ""}${tst.note ? `: ${esc(tst.note)}` : ""}</h3>
      <table><tr><th>Ear</th>${FREQS.map(f => `<th>${freqLabel(f)}</th>`).join("")}</tr>
      ${(["R", "L"] as const).map(e => `<tr><td>${e}</td>${FREQS.map(f => { const v = tst[e][f]; let s = String(v ?? "");
        if (base && !tst.baseline && typeof v === "number" && typeof base[e][f] === "number") { const d = v - (base[e][f] as number); if (d >= 10) s += ` (+${d})`; }
        return `<td>${esc(s)}</td>`; }).join("")}</tr>`).join("")}</table>
      ${base && !tst.baseline ? (() => { const c = [...criteriaText(compareEar(base.R, tst.R)).map(x => "Right " + x), ...criteriaText(compareEar(base.L, tst.L)).map(x => "Left " + x)];
        return `<p><b>${c.length ? "Meets ASHA (1994) criteria: " + esc(c.join("; ")) : "No significant shift from baseline."}</b></p>`; })() : ""}`).join("");
    printHTML(`<h2>Ototoxicity monitoring report</h2><p>Patient code: <b>${esc(patient.code)}</b>. Medicine: ${esc(patient.drug)}. ${patient.start ? "Treatment start: " + esc(fmtDate(patient.start)) + "." : ""} Printed ${esc(fmtDate(new Date()))}.</p>
      <p>Thresholds in dB HL; NR = no response. Numbers in brackets are shifts of 10 dB or more from baseline.</p>${tbl}
      <div class="sig"><div>Audiologist (name, RCI number)</div><div>Date</div></div>`);
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="quiet" onClick={onBack}>← All patients</Button>
        <div className="flex gap-2"><Button size="sm" onClick={printReport} disabled={!tests.length}>Print report</Button>
          <Button size="sm" variant="danger" onClick={() => { if (!confirmPt) { setConfirmPt(true); return; } onDelete(); }}>{confirmPt ? "Confirm delete" : "Delete patient"}</Button></div>
      </div>

      <Panel title={patient.code} action={<span className="text-[0.85rem] text-muted">{patient.drug}{patient.start ? `, started ${fmtDate(patient.start)}` : ""}</span>}>
        {tests.length === 0 ? <Empty>No tests yet. Add the baseline below.</Empty> : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {tests.map(tst => {
              const isBase = base && tst.id === base.id;
              const cr = !isBase && base ? [...criteriaText(compareEar(base.R, tst.R)).map(x => "R " + x), ...criteriaText(compareEar(base.L, tst.L)).map(x => "L " + x)] : [];
              const met = !isBase && base && (compareEar(base.R, tst.R).met || compareEar(base.L, tst.L).met);
              return (
                <li key={tst.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line bg-paper p-3">
                  <div className="min-w-0">
                    <b className="tabular-nums">{fmtDate(tst.date)}</b> {tst.retest && <Pill tone="info">Retest</Pill>}{" "}
                    {isBase ? <Pill tone="info">Baseline</Pill> : !base ? <Pill tone="muted">No baseline</Pill> : met ? <Pill tone="high">Significant shift</Pill> : <Pill tone="ok">No significant shift</Pill>}
                    {cr.length > 0 && <div className="mt-1 text-[0.82rem] text-muted">{cr.join(" · ")}</div>}
                    {tst.note && <div className="text-[0.82rem] text-muted">{tst.note}</div>}
                  </div>
                  <Button size="sm" variant="danger" onClick={() => delTest(tst.id)}>{confirmTest === tst.id ? "Confirm" : "Delete"}</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {cmp && (
        <Panel title="Latest test compared with baseline">
          {cmp.r.met || cmp.l.met
            ? <Callout tone="high" title="Meets ASHA criteria">Confirm with a retest within 24 hours, then report to the treating team.</Callout>
            : <Callout tone="ok">No significant shift from baseline.</Callout>}
          <ShiftChart r={cmp.r} ear="R" /><ShiftChart r={cmp.l} ear="L" />
        </Panel>
      )}

      <Panel title="Add a test">
        <p className="m-0 text-[0.9rem] text-muted">Thresholds in dB HL. Type <b>NR</b> for no response. Leave blank if not tested. Shaded frequencies are the extended high frequencies.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Test date" className="mt-0">{id => <Input id={id} type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />}</Field>
          <Field label="Type" className="mt-0">{id => <Select id={id} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="monitor">Monitoring test</option><option value="baseline">Baseline</option><option value="retest">Retest to confirm a shift</option></Select>}</Field>
          <Field label="Note" className="mt-0">{id => <Input id={id} value={note} maxLength={80} placeholder="e.g. before cycle 3" onChange={e => setNote(e.target.value)} />}</Field>
        </div>
        <div className="mt-4 grid grid-cols-[3.2rem_1fr_1fr] items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-bold text-muted">Hz</span><span className="text-center text-xs font-bold text-right">Right</span><span className="text-center text-xs font-bold text-left">Left</span>
          {FREQS.map(f => {
            const ehf = f >= EHF_FROM;
            return (
              <div key={f} className={cx("contents")}>
                <span className={cx("text-[0.9rem] font-bold tabular-nums", ehf && "text-accent")}>{freqLabel(f)}</span>
                {(["R", "L"] as const).map(e => (
                  <Input key={e} aria-label={`${e === "R" ? "Right" : "Left"} ${f} Hz`} value={cells[`${e}-${f}`] ?? ""} inputMode="text" maxLength={3}
                    onChange={ev => setCells(c => ({ ...c, [`${e}-${f}`]: ev.target.value }))} className={cx("text-center tabular-nums", ehf && "bg-track")} />
                ))}
              </div>
            );
          })}
        </div>
        {err && <p role="alert" className="m-0 mt-2 font-semibold text-high">{err}</p>}
        <div className="mt-4"><Button variant="primary" onClick={saveTest}>Save test</Button></div>
      </Panel>
    </div>
  );
}
