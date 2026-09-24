"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { renderField } from "./field.js";
import { useJournal } from "@/lib/journal/store";
import { CURRENCIES, DEFAULT_PROFILE, type Currency } from "@/lib/journal/types";
import { parseNum } from "@/lib/format";

// Ingresso del journal con la stessa scena di Backtesta: candele vere, book e profilo dei volumi
// dietro un titolo grande, i numeri reali della verifica COT e un solo pulsante.

interface Summary {
  weeksChecked: number;
  valuesCompared: number;
  markets: number;
  weeksFailed: number;
}

function CountUp({ to, delay = 420 }: { to: number; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => Math.round(n).toLocaleString("it-IT", { useGrouping: "always" } as Intl.NumberFormatOptions);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 1500));
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <dt ref={ref}>0</dt>;
}

function Stats() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/cot/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // senza dati verificati non si mostrano numeri: meglio nessuna cifra che una cifra inventata
  if (!s) return <div className="entry-stats" style={{ minHeight: 76 }} aria-hidden />;
  return (
    <dl className="entry-stats">
      <div><CountUp to={s.weeksChecked} /><dd>settimane COT verificate</dd></div>
      <div><CountUp to={s.valuesCompared} /><dd>valori confrontati coi file CFTC</dd></div>
      <div><CountUp to={s.markets} /><dd>mercati coperti</dd></div>
      <div><CountUp to={s.weeksFailed} /><dd>discrepanze trovate</dd></div>
    </dl>
  );
}

function Unlock() {
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
    <form onSubmit={submit} className="entry-form">
      <label htmlFor="entry-secret" className="entry-sr">{via === "password" ? "Password" : "Recovery key"}</label>
      <input
        id="entry-secret"
        className="entry-input"
        type={via === "password" ? "password" : "text"}
        autoComplete={via === "password" ? "current-password" : "off"}
        placeholder={via === "password" ? "Password" : "XXXXX-XXXXX-XXXXX-XXXXX"}
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        aria-invalid={!!error}
        autoFocus
      />
      <button type="submit" className="entry-primary mt-1" disabled={busy || !secret}>
        {busy ? "Sblocco in corso" : "Sblocca"}
      </button>
      <p className={`entry-note ${error ? "err" : ""}`} role="status" aria-live="polite">
        {error ?? "Journal bloccato: i dati di questo browser sono cifrati."}
      </p>
      <button
        type="button"
        className="entry-link"
        onClick={() => {
          setVia(via === "password" ? "recovery" : "password");
          setError(null);
          setSecret("");
        }}
      >
        {via === "password" ? "Password dimenticata? Usa la recovery key" : "Usa la password"}
      </button>
    </form>
  );
}

function Create({ onBack }: { onBack?: () => void }) {
  const { createProfile } = useJournal();
  const [capital, setCapital] = useState("10.000");
  const [currency, setCurrency] = useState<Currency>("€");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseNum(capital, { money: true });
    if (!Number.isFinite(cap) || cap <= 0) return setError("Il capitale iniziale deve essere maggiore di zero");
    createProfile({ ...DEFAULT_PROFILE, name: name.trim(), capital: cap, currency });
  };
  return (
    <form onSubmit={submit} className="entry-form">
      <div className="entry-row">
        <label htmlFor="entry-capital" className="entry-sr">Capitale iniziale</label>
        <input id="entry-capital" className="entry-input" inputMode="decimal" placeholder="Capitale iniziale" value={capital} onChange={(e) => setCapital(e.target.value)} aria-invalid={!!error} />
        <label htmlFor="entry-currency" className="entry-sr">Valuta</label>
        <select id="entry-currency" className="entry-input cursor-pointer" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c === "€" ? "Euro €" : c === "$" ? "Dollaro $" : "Sterlina £"}</option>)}
        </select>
      </div>
      <label htmlFor="entry-name" className="entry-sr">Nome</label>
      <input id="entry-name" className="entry-input" placeholder="Nome (facoltativo)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      <button type="submit" className="entry-primary mt-1">Inizia</button>
      <p className={`entry-note ${error ? "err" : ""}`} role="status" aria-live="polite">
        {error ?? "I dati restano in questo browser: nessun account, nessun server."}
      </p>
      {onBack && <button type="button" className="entry-link" onClick={onBack}>Torna all&apos;import</button>}
    </form>
  );
}

function Start() {
  const { legacyUsers, importLegacy } = useJournal();
  const [fresh, setFresh] = useState(false);
  if (!legacyUsers.length || fresh) return <Create onBack={legacyUsers.length ? () => setFresh(false) : undefined} />;
  return (
    <div className="entry-form">
      {legacyUsers.map((u) => (
        <button key={u} className="entry-primary" onClick={() => importLegacy(u)}>
          Importa profilo {u}
        </button>
      ))}
      <p className="entry-note">Dati della versione precedente trovati in questo browser: ogni trade viene ricontrollato. La password della v8 non viene importata.</p>
      <button className="entry-link" onClick={() => setFresh(true)}>Oppure crea un journal nuovo</button>
    </div>
  );
}

export function EntryScreen({ mode }: { mode: "empty" | "locked" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scene = renderField(canvas.current);
    return () => scene?.stop();
  }, []);

  return (
    <div className="entry" role="main">
      <header className="entry-bar">
        <div className="entry-brand">Journal Suite<span>.</span></div>
        <Link href="/cot" className="entry-pill-ghost">COT Report</Link>
      </header>
      <section className="entry-hero">
        <canvas ref={canvas} className="entry-field" aria-hidden="true" />
        <div className="entry-inner">
          <h1>
            Registra ogni trade.
            <br />
            <em>Misura il tuo edge.</em>
          </h1>
          <Stats />
          <div className="entry-cta">{mode === "locked" ? <Unlock /> : <Start />}</div>
        </div>
      </section>
    </div>
  );
}
