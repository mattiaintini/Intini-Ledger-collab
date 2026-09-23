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
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Button, Group, Row, Segmented } from "./ui";

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
export function TradeForm({ journal, initial, onSaved, id }: { journal: Journal; initial?: Trade; onSaved?: () => void; id?: string }) {
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

  const outcomeError = errors.outcome && !d.outcome ? "Seleziona l'esito" : errors.outcome;

  return (
    <form id={id} onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Group header="Quando">
        <Row label="Data" error={errors.date}>
          <input type="date" className="row-input" value={d.date} max={todayISO()} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} />
        </Row>
        <Row label="Ora" error={errors.time}>
          <input type="time" className="row-input" value={d.time} onChange={(e) => set("time", e.target.value)} />
        </Row>
      </Group>

      <Group header="Strumento">
        <Row label="Strumento" error={errors.asset}>
          <input className="row-input uppercase" placeholder="XAUUSD" value={d.asset} onChange={(e) => set("asset", e.target.value)} aria-invalid={!!errors.asset} autoComplete="off" autoCapitalize="characters" />
        </Row>
        <Row label="Direzione">
          <Segmented<Direction> label="Direzione" value={d.direction} options={[["LONG", "Long"], ["SHORT", "Short"]]} onChange={(v) => set("direction", v)} size="sm" />
        </Row>
      </Group>

      <Group header="Piano">
        <Row label="Sessione">
          <Segmented<Session> label="Sessione" value={d.session} options={SESSIONS.map((x) => [x, SESSION_SHORT[x]] as const)} onChange={(v) => set("session", v)} size="sm" />
        </Row>
        <Row label="Tipo">
          <Segmented<TradeType> label="Tipo" value={d.type} options={TRADE_TYPES.map((x) => [x, TYPE_SHORT[x]] as const)} onChange={(v) => set("type", v)} size="sm" />
        </Row>
        <Row label="Setup">
          <Segmented<Grade> label="Setup" value={d.grade} options={GRADES.map((g) => [g, g] as const)} onChange={(v) => set("grade", v)} size="sm" />
        </Row>
        <Row label="Lotti" error={errors.lots}>
          <input className="row-input num" inputMode="decimal" placeholder="0,50" value={d.lots} onChange={(e) => set("lots", e.target.value)} aria-invalid={!!errors.lots} />
        </Row>
        <Row label="Rischio %" error={errors.riskPct}>
          <input className="row-input num" inputMode="decimal" value={d.riskPct} onChange={(e) => set("riskPct", e.target.value)} aria-invalid={!!errors.riskPct} />
        </Row>
        <Row label="RR" error={errors.rr}>
          <input className="row-input num" inputMode="decimal" value={d.rr} onChange={(e) => set("rr", e.target.value)} aria-invalid={!!errors.rr} />
        </Row>
      </Group>

      <Group
        header="Risultato"
        footer={suggested !== null ? `Da piano: ${money(suggested, cur)} su un capitale di ${money(ctx.equityBefore, cur)}.` : "Scegli l'esito: il P&L si calcola dal piano e puoi correggerlo."}
      >
        <Row label="Esito" error={outcomeError} stacked>
          <Segmented<Outcome> label="Esito" value={d.outcome} options={OUTCOMES.map((o) => [o, OUTCOME_LABEL[o]] as const)} onChange={(v) => set("outcome", v)} className="w-full" />
        </Row>
        <Row label={`P&L (${cur})`} error={errors.pnl}>
          <input
            className="row-input num font-semibold"
            inputMode="decimal"
            placeholder={suggested !== null ? inputNum(suggested) : "0,00"}
            value={pnlTouched ? d.pnl : suggested !== null ? inputNum(suggested) : ""}
            onChange={(e) => {
              setPnlTouched(true);
              set("pnl", e.target.value);
            }}
            aria-invalid={!!errors.pnl}
          />
        </Row>
      </Group>

      <Group header="Note">
        <textarea
          aria-label="Note"
          className="block min-h-24 w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-subtle"
          value={d.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Motivo d'ingresso, gestione, errori"
        />
      </Group>

      <Group header="Esecuzione" footer="Facoltativi. Servono per MAE, MFE e durata in Analytics: se mancano, quelle metriche restano vuote, mai stimate.">
        <Row label="MAE (R)" error={errors.maeR}>
          <input className="row-input num" inputMode="decimal" placeholder="−0,4" value={d.maeR} onChange={(e) => set("maeR", e.target.value)} />
        </Row>
        <Row label="MFE (R)" error={errors.mfeR}>
          <input className="row-input num" inputMode="decimal" placeholder="2,5" value={d.mfeR} onChange={(e) => set("mfeR", e.target.value)} />
        </Row>
        <Row label="Durata (min)" error={errors.durationMin}>
          <input className="row-input num" inputMode="numeric" placeholder="45" value={d.durationMin} onChange={(e) => set("durationMin", e.target.value)} />
        </Row>
      </Group>

      <Group>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 active:bg-surface-3">
          <span className="text-[15px]">{image ? "Cambia immagine" : "Allega immagine"}</span>
          <span className="flex items-center gap-2">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Anteprima" className="h-8 w-12 rounded-[4px] object-cover" />
            )}
            <ChevronRight size={16} className="text-subtle" aria-hidden />
          </span>
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
          <button type="button" className="flex min-h-11 w-full items-center px-4 text-[15px] text-alert active:bg-surface-3" onClick={() => setImage(undefined)}>
            Rimuovi immagine
          </button>
        )}
      </Group>

      {confirmWarnings && v.warnings.length > 0 && (
        <div className="flex gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <div className="text-[15px]">
            <p className="font-semibold">Controlla prima di salvare</p>
            <ul className="mt-1 text-muted">{v.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {confirmWarnings ? "Salva comunque" : initial ? "Salva modifiche" : "Registra trade"}
      </Button>
      {saved && <p className="-mt-3 text-center text-[13px] text-muted">Trade registrato.</p>}
    </form>
  );
}
