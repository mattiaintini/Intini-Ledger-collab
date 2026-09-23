"use client";

import { useState, useSyncExternalStore } from "react";
import { useJournal } from "@/lib/journal/store";
import { readPrefs, savePrefs, type Prefs, type ThemePref } from "@/lib/prefs";
import { Button, Group, Row, Segmented } from "./ui";

// preferenze lette dal browser; sul server valgono quelle di default
let listeners: (() => void)[] = [];
let cached: Prefs | null = null;
const subscribe = (l: () => void) => {
  listeners.push(l);
  return () => (listeners = listeners.filter((x) => x !== l));
};
const snapshot = () => (cached ??= readPrefs());
const serverSnapshot = (): Prefs => ({ theme: "system" });
const update = (p: Prefs) => {
  cached = p;
  savePrefs(p);
  listeners.forEach((l) => l());
};

const THEMES = [
  ["system", "Automatico"],
  ["light", "Chiaro"],
  ["dark", "Scuro"],
] as const;

export function AppearanceCard() {
  const prefs = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <Group header="Aspetto" footer="Automatico segue il tema del Mac o dell'iPhone. Vale per questo dispositivo.">
      <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-1.5">
        <span className="text-[15px]">Tema</span>
        <Segmented<ThemePref> label="Tema" value={prefs.theme} options={THEMES} onChange={(theme) => update({ ...prefs, theme })} size="sm" />
      </div>
    </Group>
  );
}

const strong = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p);

export function SecurityCard() {
  const { hasPassword, setPassword, changePassword, removePassword, lock } = useJournal();
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

  const pwRow = (label: string, value: string, set: (v: string) => void, auto: string) => (
    <Row label={label}>
      <input className="row-input" type="password" autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} placeholder="Obbligatoria" />
    </Row>
  );

  return (
    <div className="flex flex-col gap-3">
      {recovery && (
        <div className="rounded-[var(--radius-card)] bg-surface p-4">
          <p className="text-[15px] font-semibold">Recovery key, conservala ora: non verrà mostrata di nuovo.</p>
          <p className="num mt-2 select-all text-[22px] font-semibold tracking-[0.06em]">{recovery}</p>
          <p className="mt-2 text-[13px] text-muted">Senza password e senza recovery key i dati non si possono più aprire, nemmeno da me.</p>
          <Button className="mt-3" size="sm" onClick={() => setRecovery(null)}>L&apos;ho salvata</Button>
        </div>
      )}
      {!hasPassword ? (
        <form onSubmit={enable}>
          <Group header="Sicurezza" footer={msg ? <span className={msg.ok ? "" : "text-alert"}>{msg.text}</span> : "Con una password il journal viene cifrato in questo browser (AES-256) e chiede lo sblocco a ogni apertura. Almeno 8 caratteri, una maiuscola e un simbolo."}>
            {pwRow("Nuova password", pw, setPw, "new-password")}
            {pwRow("Ripeti password", pw2, setPw2, "new-password")}
            <button type="submit" disabled={busy} className="flex min-h-11 w-full items-center px-4 text-[15px] font-semibold active:bg-surface-3 disabled:opacity-40">
              {busy ? "Cifratura in corso" : "Proteggi con password"}
            </button>
          </Group>
        </form>
      ) : (
        <form onSubmit={change}>
          <Group header="Sicurezza" footer={msg ? <span className={msg.ok ? "" : "text-alert"}>{msg.text}</span> : "Journal cifrato. La recovery key resta valida anche se cambi password."}>
            {pwRow("Password attuale", old, setOld, "current-password")}
            {pwRow("Nuova password", pw, setPw, "new-password")}
            <button type="submit" disabled={busy || !old} className="flex min-h-11 w-full items-center px-4 text-[15px] font-semibold active:bg-surface-3 disabled:opacity-40">Cambia password</button>
            <button type="button" disabled={busy || !old} onClick={remove} className="flex min-h-11 w-full items-center px-4 text-[15px] text-alert active:bg-surface-3 disabled:opacity-40">Disattiva cifratura</button>
            <button type="button" onClick={lock} className="flex min-h-11 w-full items-center px-4 text-[15px] active:bg-surface-3">Blocca ora</button>
          </Group>
        </form>
      )}
    </div>
  );
}
