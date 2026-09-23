"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WithJournal, MigrationSummary } from "@/components/onboarding";
import { Button, Card, CardTitle, Field, PageHeader, StatusBadge } from "@/components/ui";
import { useJournal } from "@/lib/journal/store";
import { auditJournal } from "@/lib/journal/validate";
import { parseBackup } from "@/lib/journal/backup";
import { download, tradesToCsv } from "@/lib/journal/csv";
import { CURRENCIES, type Currency, type Journal } from "@/lib/journal/types";
import type { MigrationReport } from "@/lib/journal/migrate";
import { dateIT, parseNum } from "@/lib/format";
import { AppearanceCard, SecurityCard } from "@/components/settings-extra";

function ProfileForm({ journal }: { journal: Journal }) {
  const { updateProfile } = useJournal();
  const [f, setF] = useState({ name: journal.profile.name, capital: String(journal.profile.capital), currency: journal.profile.currency, max: String(journal.profile.maxDailyLossPct) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const capital = parseNum(f.capital, { money: true });
    const max = parseNum(f.max);
    if (!(capital > 0)) return setMsg({ ok: false, text: "Capitale iniziale maggiore di zero" });
    if (!(max > 0 && max <= 100)) return setMsg({ ok: false, text: "Perdita giornaliera tra 0 e 100%" });
    updateProfile({ name: f.name.trim(), capital, currency: f.currency, maxDailyLossPct: max });
    setMsg({ ok: true, text: "Profilo salvato. Capitale e statistiche ricalcolati." });
  };
  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Valuta">
          <select className="field" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Capitale iniziale" hint="Base per equity, R e drawdown di tutti i trade">
          <input className="field num" inputMode="decimal" value={f.capital} onChange={(e) => setF({ ...f, capital: e.target.value })} />
        </Field>
        <Field label="Perdita massima giornaliera %">
          <input className="field num" inputMode="decimal" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="solid">Salva</Button>
          {msg && <span className={`text-sm ${msg.ok ? "text-pos" : "text-alert"}`}>{msg.text}</span>}
        </div>
      </form>
    </Card>
  );
}

function DataCheck({ journal }: { journal: Journal }) {
  const issues = useMemo(() => auditJournal(journal), [journal]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const errorTrades = new Set(errors.map((i) => i.tradeId)).size;
  const status = errors.length ? "fail" : warnings.length ? "warn" : "pass";
  return (
    <Card id="controllo-dati">
      <CardTitle aside={<StatusBadge status={status} label={status === "pass" ? "Nessun problema" : undefined} />}>Data check</CardTitle>
      <p className="text-sm text-muted">
        Ogni trade ricontrollato con le regole dell&apos;inserimento: date, coerenza tra esito e P&amp;L, scostamento dal piano oltre il 25%, rischio oltre il limite, doppioni.{" "}
        {journal.trades.length} trade: {errors.length} errori su {errorTrades} trade, {warnings.length} avvisi.
      </p>
      {issues.length > 0 && (
        <ul className="mt-4 max-h-96 divide-y divide-line overflow-y-auto scrollbar-thin text-sm">
          {[...errors, ...warnings].map((i, k) => (
            <li key={k} className="flex flex-col gap-0.5 py-2 md:flex-row md:gap-4">
              <span className="num w-40 shrink-0 text-muted">{dateIT(i.date)} · {i.asset}</span>
              <span className={`flex-1 ${i.level === "error" ? "text-alert" : "text-warn"}`}>{i.message}</span>
              <Link href={`/journal/${encodeURIComponent(i.tradeId)}`} className="text-muted underline underline-offset-4">Correggi</Link>
            </li>
          ))}
        </ul>
      )}
      
    </Card>
  );
}

function DataManagement({ journal }: { journal: Journal }) {
  const { replaceJournal, wipe, legacyUsers, importLegacy } = useJournal();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const backup = () => download(`journal_backup_${stamp}.json`, JSON.stringify(journal), "application/json");
  const reimport = (u: string) => {
    if (confirmImport !== u) return setConfirmImport(u);
    backup(); // copia di sicurezza del journal attuale prima di sostituirlo
    setReport(importLegacy(u));
    setConfirmImport(null);
  };
  const stamp = new Date().toISOString().slice(0, 10);

  const restore = async (file: File) => {
    const res = parseBackup(await file.text());
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    replaceJournal(res.journal);
    setMsg({ ok: true, text: `Backup caricato: ${res.journal.trades.length} trade. Controlla l'esito del controllo dati qui sopra.` });
  };

  return (
    <Card>
      <CardTitle>Backup</CardTitle>
      <p className="text-sm text-muted">I dati vivono solo in questo browser. Esporta un backup JSON con regolarità: è l&apos;unico modo per spostarli su un altro dispositivo.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="solid" onClick={backup}>Esporta backup JSON</Button>
        <Button onClick={() => download(`journal_${stamp}.csv`, tradesToCsv(journal.trades), "text/csv")}>Esporta CSV</Button>
        <label className="inline-flex cursor-pointer items-center rounded-[var(--radius-ui)] border border-line px-4 py-2.5 text-sm font-medium hover:border-line-strong">
          Carica backup
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-pos" : "text-alert"}`}>{msg.text}</p>}

      {legacyUsers.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm">Dati della versione precedente (v8) presenti in questo browser</p>
          <p className="mt-1 text-xs text-subtle">L&apos;import sostituisce il journal attuale. Prima di sostituirlo viene scaricato un backup JSON.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {legacyUsers.map((u) => (
              <Button key={u} variant={confirmImport === u ? "danger" : "ghost"} onClick={() => reimport(u)}>
                {confirmImport === u ? `Conferma: sostituisce ${journal.trades.length} trade` : `Reimporta profilo ${u}`}
              </Button>
            ))}
          </div>
          {report && <div className="mt-3"><MigrationSummary report={report} /></div>}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <Button
          variant="danger"
          onClick={() => {
            if (!confirmWipe) return setConfirmWipe(true);
            backup();
            wipe();
          }}
        >
          {confirmWipe ? "Conferma: elimina tutto" : "Elimina tutti i dati"}
        </Button>
        {confirmWipe && <p className="mt-2 text-xs text-subtle">Prima di eliminare viene scaricato un backup JSON.</p>}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <WithJournal>
      {(j) => (
        <>
          <PageHeader title="Settings" />
          <div className="flex flex-col gap-4 md:gap-6">
            <ProfileForm journal={j} />
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              <AppearanceCard />
              <SecurityCard />
            </div>
            <DataCheck journal={j} />
            <DataManagement journal={j} />
          </div>
        </>
      )}
    </WithJournal>
  );
}
