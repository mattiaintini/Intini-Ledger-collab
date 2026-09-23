"use client";

import { useState, useSyncExternalStore } from "react";
import { useJournal } from "@/lib/journal/store";
import { readPrefs, savePrefs, type Look, type Prefs, type Theme } from "@/lib/prefs";
import { Button, Card, CardTitle, Field } from "./ui";

// preferenze lette dal browser; sul server valgono quelle di default
let listeners: (() => void)[] = [];
let cached: Prefs | null = null;
const subscribe = (l: () => void) => {
  listeners.push(l);
  return () => (listeners = listeners.filter((x) => x !== l));
};
const snapshot = () => (cached ??= readPrefs());
const serverSnapshot = (): Prefs => ({ theme: "dark", look: "terminal" });
const update = (p: Prefs) => {
  cached = p;
  savePrefs(p);
  listeners.forEach((l) => l());
};

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div className="grid grid-cols-2 rounded-[var(--radius-ui)] border border-line p-0.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`rounded-[6px] py-2 text-sm ${value === v ? "bg-surface-3 text-fg" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppearanceCard() {
  const prefs = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <Card>
      <CardTitle>Appearance</CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented<Theme> label="Tema" value={prefs.theme} options={[["dark", "Scuro"], ["light", "Chiaro"]]} onChange={(theme) => update({ ...prefs, theme })} />
        <Segmented<Look> label="Stile" value={prefs.look} options={[["terminal", "Terminal"], ["clean", "Clean"]]} onChange={(look) => update({ ...prefs, look })} />
      </div>
      <p className="mt-3 text-xs text-subtle">Solo bianco, nero e grigi. Terminal: numeri ed etichette in monospace, come la v8. Vale per questo dispositivo.</p>
    </Card>
  );
}

const strong = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p);

export function SecurityCard() {
  const { hasPassword, setPassword, changePassword, removePassword } = useJournal();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [old, setOld] = useState("");
  const [recovery, setRecovery] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const enable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong(pw)) return setMsg({ ok: false, text: "Almeno 8 caratteri, una maiuscola e un simbolo" });
    if (pw !== pw2) return setMsg({ ok: false, text: "Le due password non coincidono" });
    void run(async () => {
      setRecovery(await setPassword(pw));
      setPw("");
      setPw2("");
    });
  };

  const change = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong(pw)) return setMsg({ ok: false, text: "Nuova password: almeno 8 caratteri, una maiuscola e un simbolo" });
    void run(async () => {
      const ok = await changePassword(old, pw);
      setMsg(ok ? { ok: true, text: "Password cambiata. La recovery key resta la stessa." } : { ok: false, text: "Password attuale errata" });
      if (ok) {
        setOld("");
        setPw("");
      }
    });
  };

  const remove = () =>
    void run(async () => {
      const ok = await removePassword(old);
      setMsg(ok ? { ok: true, text: "Cifratura disattivata: i dati sono di nuovo in chiaro in questo browser." } : { ok: false, text: "Password attuale errata" });
      if (ok) setOld("");
    });

  return (
    <Card>
      <CardTitle aside={hasPassword ? "cifrato" : "non protetto"}>Security</CardTitle>
      {recovery && (
        <div className="mb-5 rounded-[var(--radius-ui)] border border-line-strong p-4">
          <p className="text-sm">Recovery key, conservala ora: non verrà mostrata di nuovo.</p>
          <p className="num mt-2 select-all text-lg font-semibold tracking-[0.08em]">{recovery}</p>
          <p className="mt-2 text-xs text-subtle">Senza password e senza recovery key i dati non si possono più aprire, nemmeno da me.</p>
          <Button className="mt-3" onClick={() => setRecovery(null)}>L&apos;ho salvata</Button>
        </div>
      )}
      {!hasPassword ? (
        <form onSubmit={enable} className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-muted sm:col-span-2">
            Con una password il journal viene cifrato in questo browser (AES-256) e chiede lo sblocco a ogni apertura.
          </p>
          <Field label="Nuova password"><input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Ripeti password"><input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Button type="submit" variant="solid" disabled={busy}>{busy ? "Cifratura in corso" : "Proteggi con password"}</Button></div>
        </form>
      ) : (
        <form onSubmit={change} className="grid gap-4 sm:grid-cols-2">
          <Field label="Password attuale"><input className="field" type="password" autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} /></Field>
          <Field label="Nuova password"><input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="solid" disabled={busy || !old}>Cambia password</Button>
            <Button type="button" variant="danger" disabled={busy || !old} onClick={remove}>Disattiva cifratura</Button>
          </div>
        </form>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-fg" : "text-alert"}`}>{msg.text}</p>}
    </Card>
  );
}
