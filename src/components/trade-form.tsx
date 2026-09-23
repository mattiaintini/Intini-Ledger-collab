"use client";

import { useMemo, useState } from "react";
import { useJournal } from "@/lib/journal/store";
import { contextFor, plannedPnl, todayISO, validateTrade, type TradeInput } from "@/lib/journal/validate";
import {
  GRADES,
  OUTCOME_LABEL,
  OUTCOMES,
  SESSION_SHORT,
  SESSIONS,
  TRADE_TYPES,
  TYPE_SHORT,
  type Direction,
  type Grade,
  type Journal,
  type Outcome,
  type Session,
  type Trade,
  type TradeType,
} from "@/lib/journal/types";
import { inputNum, money, parseNum } from "@/lib/format";
import { Button, Field } from "./ui";

/** Riduce l'immagine a 1280px JPEG: una schermata del grafico passa da ~2 MB a ~150 KB. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

const nowTime = () => new Date().toTimeString().slice(0, 5);

interface Draft {
  date: string;
  time: string;
  asset: string;
  session: Session;
  type: TradeType;
  direction: Direction;
  lots: string;
  riskPct: string;
  rr: string;
  grade: Grade;
  outcome: Outcome | "";
  pnl: string;
  notes: string;
  maeR: string;
  mfeR: string;
  durationMin: string;
}

const empty = (): Draft => ({
  date: todayISO(),
  time: nowTime(),
  asset: "",
  session: "LDN",
  type: "INTRA",
  direction: "LONG",
  lots: "",
  riskPct: "1",
  rr: "2",
  grade: "A",
  outcome: "",
  pnl: "",
  notes: "",
  maeR: "",
  mfeR: "",
  durationMin: "",
});

const optional = (s: string) => (s.trim() === "" ? undefined : parseNum(s));

const fromTrade = (t: Trade): Draft => ({
  date: t.date,
  time: t.time,
  asset: t.asset,
  session: t.session,
  type: t.type,
  direction: t.direction,
  lots: String(t.lots).replace(".", ","),
  riskPct: String(t.riskPct).replace(".", ","),
  rr: String(t.rr).replace(".", ","),
  grade: t.grade,
  outcome: t.outcome,
  pnl: inputNum(t.pnl),
  notes: t.notes,
  maeR: t.maeR === undefined ? "" : String(t.maeR).replace(".", ","),
  mfeR: t.mfeR === undefined ? "" : String(t.mfeR).replace(".", ","),
  durationMin: t.durationMin === undefined ? "" : String(t.durationMin),
});

/** Nuovo trade, oppure modifica di `initial` con le stesse regole di validazione. */
export function TradeForm({ journal, initial, onSaved }: { journal: Journal; initial?: Trade; onSaved?: () => void }) {
  const { addTrade, updateTrade } = useJournal();
  const [d, setD] = useState<Draft>(() => (initial ? fromTrade(initial) : empty()));
  // in modifica il P&L registrato resta quello scritto, non viene ricalcolato dal piano
  const [pnlTouched, setPnlTouched] = useState(!!initial);
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [submitted, setSubmitted] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [saved, setSaved] = useState(false);
  const cur = journal.profile.currency;

  const ctx = useMemo(() => contextFor(journal, { date: d.date, time: d.time }, initial?.id), [journal, d.date, d.time, initial?.id]);
  const riskAmount = (ctx.equityBefore * (parseNum(d.riskPct) || 0)) / 100;
  const suggested = d.outcome ? plannedPnl(d.outcome, riskAmount, parseNum(d.rr) || 0) : null;

  const input: TradeInput = {
    date: d.date,
    time: d.time,
    asset: d.asset.trim().toUpperCase(),
    session: d.session,
    type: d.type,
    direction: d.direction,
    lots: parseNum(d.lots),
    riskPct: parseNum(d.riskPct),
    rr: parseNum(d.rr),
    grade: d.grade,
    outcome: (d.outcome || "X") as Outcome,
    pnl: pnlTouched ? parseNum(d.pnl, { money: true }) : (suggested ?? NaN),
    notes: d.notes,
    image,
    maeR: optional(d.maeR),
    mfeR: optional(d.mfeR),
    durationMin: optional(d.durationMin),
  };
  const v = validateTrade(input, ctx);
  const errors = submitted ? v.errors : {};

  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => {
    setD((p) => ({ ...p, [k]: val }));
    setConfirmWarnings(false);
    setSaved(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(v.errors).length) return;
    if (v.warnings.length && !confirmWarnings) return setConfirmWarnings(true);
    if (initial) {
      updateTrade(initial.id, input);
      setSubmitted(false);
      setConfirmWarnings(false);
      onSaved?.();
      return;
    }
    addTrade(input);
    setD({ ...empty(), date: d.date, session: d.session, type: d.type, riskPct: d.riskPct, rr: d.rr });
    setPnlTouched(false);
    setImage(undefined);
    setSubmitted(false);
    setConfirmWarnings(false);
    setSaved(true);
    onSaved?.();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" error={errors.date}>
          <input type="date" className="field" value={d.date} max={todayISO()} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} />
        </Field>
        <Field label="Ora" error={errors.time}>
          <input type="time" className="field" value={d.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Strumento" error={errors.asset}>
          <input className="field uppercase" placeholder="XAUUSD" value={d.asset} onChange={(e) => set("asset", e.target.value)} aria-invalid={!!errors.asset} autoComplete="off" />
        </Field>
        <Field label="Direzione" group>
          <div className="grid grid-cols-2 rounded-[var(--radius-ui)] border border-line p-0.5">
            {(["LONG", "SHORT"] as const).map((dir) => (
              <button
                type="button"
                key={dir}
                onClick={() => set("direction", dir)}
                aria-pressed={d.direction === dir}
                className={`rounded-[8px] py-2 text-sm ${d.direction === dir ? "bg-surface-3 text-fg" : "text-muted"}`}
              >
                {dir === "LONG" ? "Long" : "Short"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Sessione">
          <select className="field" value={d.session} onChange={(e) => set("session", e.target.value as Session)}>
            {SESSIONS.map((s) => <option key={s} value={s}>{SESSION_SHORT[s]}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="field" value={d.type} onChange={(e) => set("type", e.target.value as TradeType)}>
            {TRADE_TYPES.map((s) => <option key={s} value={s}>{TYPE_SHORT[s]}</option>)}
          </select>
        </Field>
        <Field label="Setup">
          <select className="field" value={d.grade} onChange={(e) => set("grade", e.target.value as Grade)}>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Lotti" error={errors.lots}>
          <input className="field num" inputMode="decimal" value={d.lots} onChange={(e) => set("lots", e.target.value)} aria-invalid={!!errors.lots} />
        </Field>
        <Field label="Rischio %" error={errors.riskPct}>
          <input className="field num" inputMode="decimal" value={d.riskPct} onChange={(e) => set("riskPct", e.target.value)} aria-invalid={!!errors.riskPct} />
        </Field>
        <Field label="RR" error={errors.rr}>
          <input className="field num" inputMode="decimal" value={d.rr} onChange={(e) => set("rr", e.target.value)} aria-invalid={!!errors.rr} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Esito" error={errors.outcome && !d.outcome ? "Seleziona l'esito" : errors.outcome}>
          <select className="field" value={d.outcome} onChange={(e) => set("outcome", e.target.value as Outcome)} aria-invalid={!!errors.outcome}>
            <option value="" disabled>Seleziona</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
          </select>
        </Field>
        <Field
          label={`P&L (${cur})`}
          error={errors.pnl}
          hint={suggested !== null ? `Da piano: ${money(suggested, cur)} su capitale ${money(ctx.equityBefore, cur)}` : "Scegli l'esito per il calcolo automatico"}
        >
          <input
            className="field num"
            inputMode="decimal"
            placeholder={suggested !== null ? inputNum(suggested) : "0,00"}
            value={pnlTouched ? d.pnl : suggested !== null ? inputNum(suggested) : ""}
            onChange={(e) => {
              setPnlTouched(true);
              set("pnl", e.target.value);
            }}
            aria-invalid={!!errors.pnl}
          />
        </Field>
      </div>

      <Field label="Note">
        <textarea className="field min-h-20 resize-y" value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Motivo d'ingresso, gestione, errori" />
      </Field>

      <details className="rounded-[var(--radius-ui)] border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm text-muted">Dati di esecuzione (facoltativi)</summary>
        <p className="mt-2 text-xs text-subtle">Servono per MAE, MFE e durata in Analytics. Se non li inserisci, quelle metriche restano vuote: niente valori stimati.</p>
        <div className="mt-3 grid grid-cols-3 gap-3 pb-2">
          <Field label="MAE (R)" error={errors.maeR}>
            <input className="field num" inputMode="decimal" placeholder="-0,4" value={d.maeR} onChange={(e) => set("maeR", e.target.value)} />
          </Field>
          <Field label="MFE (R)" error={errors.mfeR}>
            <input className="field num" inputMode="decimal" placeholder="2,5" value={d.mfeR} onChange={(e) => set("mfeR", e.target.value)} />
          </Field>
          <Field label="Durata (min)" error={errors.durationMin}>
            <input className="field num" inputMode="numeric" value={d.durationMin} onChange={(e) => set("durationMin", e.target.value)} />
          </Field>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <label className="cursor-pointer text-sm text-muted underline-offset-4 hover:underline">
          {image ? "Cambia immagine" : "Allega immagine"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImage(await compressImage(f));
            }}
          />
        </label>
        {image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Anteprima" className="h-10 w-16 rounded object-cover" />
            <button type="button" className="text-xs text-subtle" onClick={() => setImage(undefined)}>Rimuovi</button>
          </>
        )}
      </div>

      {confirmWarnings && v.warnings.length > 0 && (
        <div className="rounded-[var(--radius-ui)] border border-warn/40 p-3 text-sm">
          <p className="text-warn">Controlla prima di salvare</p>
          <ul className="mt-1 list-disc pl-5 text-muted">{v.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <Button type="submit" variant="primary">{confirmWarnings ? "Salva comunque" : initial ? "Salva modifiche" : "Registra trade"}</Button>
      {saved && <p className="text-sm text-pos">Trade registrato.</p>}
    </form>
  );
}
