"use client";

import { useState, type ReactNode } from "react";
import { useJournal } from "@/lib/journal/store";
import { CURRENCIES, DEFAULT_PROFILE, type Currency, type Journal } from "@/lib/journal/types";
import type { MigrationReport } from "@/lib/journal/migrate";
import { parseNum } from "@/lib/format";
import { Button, Card, Field, PageHeader } from "./ui";

export function MigrationSummary({ report }: { report: MigrationReport }) {
  return (
    <div className="rounded-[var(--radius-ui)] border border-line bg-surface-2 p-4 text-sm">
      <p>{report.imported} trade importati{report.rejected.length ? `, ${report.rejected.length} scartati` : ""}.</p>
      {[...report.rejected.map((r) => r.reason), ...report.corrections].length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-muted">
          {report.rejected.map((r) => <li key={`r${r.index}`} className="text-alert">{r.reason}</li>)}
          {report.corrections.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}
    </div>
  );
}

function Onboarding() {
  const { createProfile, legacyUsers, importLegacy } = useJournal();
  const [name, setName] = useState("");
  const [capital, setCapital] = useState(String(DEFAULT_PROFILE.capital));
  const [currency, setCurrency] = useState<Currency>("€");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseNum(capital, { money: true });
    if (!Number.isFinite(cap) || cap <= 0) return setError("Capitale iniziale maggiore di zero");
    createProfile({ ...DEFAULT_PROFILE, name: name.trim(), capital: cap, currency });
  };

  return (
    <>
      <PageHeader title="Journal Suite" description="Registra i trade, verifica i dati e misura il tuo edge con numeri reali. I dati restano in questo browser." />
      <div className="grid gap-4 lg:grid-cols-2">
        {legacyUsers.length > 0 && (
          <Card>
            <h2 className="text-base font-medium">Recupera i dati della versione precedente</h2>
            <p className="mt-2 text-sm text-muted">
              In questo browser ci sono i dati della v8. L&apos;import converte ogni trade, lo ricontrolla con le nuove regole e ti mostra cosa è stato corretto. La password della v8 non viene importata.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {legacyUsers.map((u) => (
                <Button key={u} variant="primary" onClick={() => importLegacy(u)}>Importa profilo {u}</Button>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <h2 className="text-base font-medium">{legacyUsers.length ? "Oppure inizia da zero" : "Crea il tuo profilo"}</h2>
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome (facoltativo)">
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </Field>
            </div>
            <Field label="Capitale iniziale" error={error ?? undefined}>
              <input className="field num" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} aria-invalid={!!error} />
            </Field>
            <Field label="Valuta">
              <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary">Inizia</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

function LockScreen() {
  const { unlock } = useJournal();
  const [via, setVia] = useState<"password" | "recovery">("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await unlock(secret, via);
    setBusy(false);
    if (!ok) setError(via === "password" ? "Password errata" : "Recovery key errata");
  };
  return (
    <div className="mx-auto mt-10 max-w-sm md:mt-20">
      <Card>
        <h1 className="label text-fg">Journal bloccato</h1>
        <p className="mt-2 text-sm text-muted">I dati di questo browser sono cifrati. Inserisci {via === "password" ? "la password" : "la recovery key"} per aprirli.</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <Field label={via === "password" ? "Password" : "Recovery key"} error={error ?? undefined}>
            <input
              className="field num"
              type={via === "password" ? "password" : "text"}
              autoComplete={via === "password" ? "current-password" : "off"}
              placeholder={via === "recovery" ? "XXXXX-XXXXX-XXXXX-XXXXX" : undefined}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !secret}>{busy ? "Sblocco in corso" : "Sblocca"}</Button>
        </form>
        <button className="mt-4 text-xs text-muted underline underline-offset-4" onClick={() => { setVia(via === "password" ? "recovery" : "password"); setError(null); setSecret(""); }}>
          {via === "password" ? "Password dimenticata? Usa la recovery key" : "Usa la password"}
        </button>
      </Card>
    </div>
  );
}

/** Mostra il contenuto solo quando esiste un journal sbloccato, altrimenti onboarding o blocco. */
export function WithJournal({ children }: { children: (j: Journal) => ReactNode }) {
  const { status, journal, storageError } = useJournal();
  if (status === "loading") return <div className="h-40" aria-busy="true" />;
  if (status === "locked") return <LockScreen />;
  if (!journal) return <Onboarding />;
  return (
    <>
      {storageError && <p className="mb-4 rounded-[var(--radius-ui)] border border-alert/40 p-3 text-sm text-alert">{storageError}</p>}
      {children(journal)}
    </>
  );
}
