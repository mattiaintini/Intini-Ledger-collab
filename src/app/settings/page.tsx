"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { WithJournal, MigrationSummary } from "@/components/onboarding";
import { Group, PageHeader, Row, StatusBadge } from "@/components/ui";
import { useJournal } from "@/lib/journal/store";
import { auditJournal } from "@/lib/journal/validate";
import { parseBackup } from "@/lib/journal/backup";
import { download, tradesToCsv } from "@/lib/journal/csv";
import { CURRENCIES, type Currency, type Journal } from "@/lib/journal/types";
import type { MigrationReport } from "@/lib/journal/migrate";
import { dateIT, inputNum, parseNum } from "@/lib/format";
import { AppearanceCard, SecurityCard } from "@/components/settings-extra";

// Impostazioni in stile macOS: liste raggruppate, valori a destra, salvataggio automatico all'uscita dal campo.

function ProfileGroup({ journal }: { journal: Journal }) {
  const { updateProfile } = useJournal();
  const p = journal.profile;
  const [name, setName] = useState(p.name);
  const [capital, setCapital] = useState(inputNum(p.capital));
  const [max, setMax] = useState(String(p.maxDailyLossPct).replace(".", ","));
  const [error, setError] = useState<{ capital?: string; max?: string }>({});

  const commitCapital = () => {
    const v = parseNum(capital, { money: true });
    if (!(v > 0)) return setError((e) => ({ ...e, capital: "Maggiore di zero" }));
    setError((e) => ({ ...e, capital: undefined }));
    if (v !== p.capital) updateProfile({ capital: v });
    setCapital(inputNum(v));
  };
  const commitMax = () => {
    const v = parseNum(max);
    if (!(v > 0 && v <= 100)) return setError((e) => ({ ...e, max: "Tra 0 e 100" }));
    setError((e) => ({ ...e, max: undefined }));
    if (v !== p.maxDailyLossPct) updateProfile({ maxDailyLossPct: v });
  };

  return (
    <Group header="Profilo" footer="Il capitale iniziale è la base di equity, R e drawdown di tutti i trade. Le modifiche si salvano da sole.">
      <Row label="Nome">
        <input className="row-input" value={name} placeholder="Facoltativo" onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== p.name && updateProfile({ name: name.trim() })} />
      </Row>
      <Row label="Valuta">
        <select className="row-input w-auto cursor-pointer" value={p.currency} onChange={(e) => updateProfile({ currency: e.target.value as Currency })}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Row>
      <Row label="Capitale iniziale" error={error.capital}>
        <input className="row-input num" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} onBlur={commitCapital} aria-invalid={!!error.capital} />
      </Row>
      <Row label="Perdita massima giornaliera %" error={error.max}>
        <input className="row-input num" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} onBlur={commitMax} aria-invalid={!!error.max} />
      </Row>
    </Group>
  );
}

function DataCheck({ journal }: { journal: Journal }) {
  const issues = useMemo(() => auditJournal(journal), [journal]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const errorTrades = new Set(errors.map((i) => i.tradeId)).size;
  const status = errors.length ? "fail" : warnings.length ? "warn" : "pass";
  return (
    <div id="controllo-dati" className="scroll-mt-6">
      <Group
        header="Controllo dati"
        footer="Ogni trade ricontrollato con le regole dell'inserimento: date, coerenza tra esito e P&L, scostamento dal piano oltre il 25%, rischio oltre il limite, doppioni."
      >
        <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
          <span className="text-[15px]">
            {journal.trades.length} trade: {errors.length} errori su {errorTrades} trade, {warnings.length} avvisi.
          </span>
          <StatusBadge status={status} label={status === "pass" ? "Nessun problema" : undefined} />
        </div>
        {[...errors, ...warnings].map((i, k) => (
          <Link key={k} href={`/journal/${encodeURIComponent(i.tradeId)}`} className="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-surface-3">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i.level === "error" ? "bg-alert" : "bg-warn"}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">{i.message}</span>
              <span className="block text-[13px] text-muted">{dateIT(i.date)} · {i.asset}</span>
            </span>
            <span className="text-[15px] text-muted">Correggi</span>
            <ChevronRight size={16} className="text-subtle" aria-hidden />
          </Link>
        ))}
      </Group>
    </div>
  );
}

const rowBtn = "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[15px] active:bg-surface-3";

function DataManagement({ journal }: { journal: Journal }) {
  const { replaceJournal, wipe, legacyUsers, importLegacy } = useJournal();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = () => download(`journal_backup_${stamp}.json`, JSON.stringify(journal), "application/json");
  const reimport = (u: string) => {
    if (confirmImport !== u) return setConfirmImport(u);
    backup(); // copia di sicurezza del journal attuale prima di sostituirlo
    setReport(importLegacy(u));
    setConfirmImport(null);
  };
  const restore = async (file: File) => {
    const res = parseBackup(await file.text());
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    replaceJournal(res.journal);
    setMsg({ ok: true, text: `Backup caricato: ${res.journal.trades.length} trade. Guarda il controllo dati qui sopra.` });
  };

  return (
    <>
      <Group
        header="Backup"
        footer={msg ? <span className={msg.ok ? "" : "text-alert"}>{msg.text}</span> : "I dati vivono solo in questo browser: il backup JSON è l'unico modo per spostarli su un altro dispositivo."}
      >
        <button className={rowBtn} onClick={backup}>Esporta backup JSON <ChevronRight size={16} className="text-subtle" /></button>
        <button className={rowBtn} onClick={() => download(`journal_${stamp}.csv`, tradesToCsv(journal.trades), "text/csv")}>Esporta CSV <ChevronRight size={16} className="text-subtle" /></button>
        <label className={`${rowBtn} cursor-pointer`}>
          Carica backup
          <ChevronRight size={16} className="text-subtle" />
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </Group>

      {legacyUsers.length > 0 && (
        <Group header="Versione precedente" footer="Dati della v8 presenti in questo browser. L'import sostituisce il journal attuale e prima scarica un backup JSON.">
          {legacyUsers.map((u) => (
            <button key={u} className={`${rowBtn} ${confirmImport === u ? "text-alert" : ""}`} onClick={() => reimport(u)}>
              {confirmImport === u ? `Conferma: sostituisce ${journal.trades.length} trade` : `Reimporta profilo ${u}`}
            </button>
          ))}
        </Group>
      )}
      {report && <MigrationSummary report={report} />}

      <Group footer={confirmWipe ? "Prima di eliminare viene scaricato un backup JSON." : undefined}>
        <button
          className="flex min-h-11 w-full items-center justify-center px-4 text-[15px] text-alert active:bg-surface-3"
          onClick={() => {
            if (!confirmWipe) return setConfirmWipe(true);
            backup();
            wipe();
          }}
        >
          {confirmWipe ? "Conferma: elimina tutto" : "Elimina tutti i dati"}
        </button>
      </Group>
    </>
  );
}

export default function SettingsPage() {
  return (
    <WithJournal>
      {(j) => (
        <div className="mx-auto max-w-[680px]">
          <PageHeader title="Settings" />
          <div className="flex flex-col gap-8">
            <ProfileGroup journal={j} />
            <AppearanceCard />
            <SecurityCard />
            <DataCheck journal={j} />
            <DataManagement journal={j} />
            <p className="text-center text-[13px] text-subtle">Journal Suite v11 · dati salvati solo in questo browser</p>
          </div>
        </div>
      )}
    </WithJournal>
  );
}
