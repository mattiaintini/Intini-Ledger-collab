"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LEGACY_STORAGE_KEY, STORAGE_KEY, type Journal, type Profile, type Trade } from "./types";
import { listLegacyUsers, migrateLegacy, type MigrationReport } from "./migrate";
import { changeVaultPassword, createVault, isVault, resealVault, unlockVault, type VaultFile } from "./vault";

// Il journal vive nel browser (localStorage), come nella v8: nessun dato di trading lascia il dispositivo.
// Con la password attiva il localStorage contiene solo il vault cifrato; la chiave resta in memoria finché
// il journal è sbloccato.

type Status = "loading" | "empty" | "locked" | "ready";

interface JournalContext {
  status: Status;
  journal: Journal | null;
  legacyUsers: string[];
  storageError: string | null;
  /** Esito dell'ultimo import v8, mostrato finché non viene chiuso. */
  lastImport: MigrationReport | null;
  clearImport: () => void;
  createProfile: (p: Profile) => void;
  updateProfile: (p: Partial<Profile>) => void;
  addTrade: (t: Omit<Trade, "id" | "createdAt">) => void;
  /** Sostituisce i dati di un trade esistente mantenendo id e ordine di inserimento. */
  updateTrade: (id: string, t: Omit<Trade, "id" | "createdAt">) => void;
  deleteTrade: (id: string) => void;
  importLegacy: (user: string) => MigrationReport;
  replaceJournal: (j: Journal) => void;
  wipe: () => void;
  hasPassword: boolean;
  /** Attiva la cifratura; restituisce la recovery key da mostrare una volta sola. */
  setPassword: (password: string) => Promise<string>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  removePassword: (password: string) => Promise<boolean>;
  unlock: (secret: string, via?: "password" | "recovery") => Promise<boolean>;
  lock: () => void;
}

const Ctx = createContext<JournalContext | null>(null);

const validJournal = (j: unknown): j is Journal => !!j && (j as Journal).version === 9 && Array.isArray((j as Journal).trades);

function readStored(): { journal: Journal | null; vault: VaultFile | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { journal: null, vault: null };
    const parsed = JSON.parse(raw);
    if (isVault(parsed)) return { journal: null, vault: parsed };
    return { journal: validJournal(parsed) ? parsed : null, vault: null };
  } catch {
    return { journal: null, vault: null };
  }
}

function readLegacyRaw(): string | null {
  try {
    return localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const QUOTA_MSG = "Spazio del browser esaurito: elimina le immagini dei trade più vecchi o esporta un backup.";

export function JournalProvider({ children }: { children: ReactNode }) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [legacyUsers, setLegacyUsers] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<MigrationReport | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  // vault attivo e chiave dati in memoria (solo da sbloccato)
  const vaultRef = useRef<{ file: VaultFile; dek: CryptoKey } | null>(null);
  // le scritture cifrate sono asincrone: si accodano per non sovrascriversi fuori ordine
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // lettura unica all'avvio: localStorage esiste solo nel browser
    const { journal: j, vault } = readStored();
    /* eslint-disable react-hooks/set-state-in-effect */
    setJournal(j);
    setHasPassword(!!vault);
    setLegacyUsers(listLegacyUsers(readLegacyRaw()));
    setStatus(vault ? "locked" : j ? "ready" : "empty");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const write = useCallback((next: Journal | null) => {
    writeQueue.current = writeQueue.current.then(async () => {
      try {
        if (!next) localStorage.removeItem(STORAGE_KEY);
        else if (vaultRef.current) {
          const file = await resealVault(vaultRef.current.file, vaultRef.current.dek, JSON.stringify(next));
          vaultRef.current = { ...vaultRef.current, file };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
        } else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setStorageError(null);
      } catch {
        setStorageError(QUOTA_MSG);
      }
    });
    return writeQueue.current;
  }, []);

  const persist = useCallback(
    (next: Journal | null) => {
      setJournal(next);
      setStatus(next ? "ready" : "empty");
      void write(next);
    },
    [write],
  );

  const value = useMemo<JournalContext>(
    () => ({
      status,
      journal,
      legacyUsers,
      storageError,
      lastImport,
      hasPassword,
      clearImport: () => setLastImport(null),
      createProfile: (profile) => persist({ version: 9, profile, trades: [] }),
      updateProfile: (p) => journal && persist({ ...journal, profile: { ...journal.profile, ...p } }),
      addTrade: (t) => journal && persist({ ...journal, trades: [...journal.trades, { ...t, id: newId(), createdAt: Date.now() }] }),
      updateTrade: (id, t) =>
        journal && persist({ ...journal, trades: journal.trades.map((o) => (o.id === id ? { ...t, id, createdAt: o.createdAt } : o)) }),
      deleteTrade: (id) => journal && persist({ ...journal, trades: journal.trades.filter((t) => t.id !== id) }),
      importLegacy: (user) => {
        const raw = readLegacyRaw();
        if (!raw) throw new Error("Nessun dato v8 in questo browser");
        const { journal: j, report } = migrateLegacy(raw, user);
        persist(j);
        setLastImport(report);
        return report;
      },
      replaceJournal: (j) => persist(j),
      wipe: () => {
        vaultRef.current = null;
        setHasPassword(false);
        persist(null);
      },
      setPassword: async (password) => {
        if (!journal) throw new Error("Nessun journal da proteggere");
        const { file, dek, recoveryKey } = await createVault(JSON.stringify(journal), password);
        vaultRef.current = { file, dek };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
        setHasPassword(true);
        return recoveryKey;
      },
      changePassword: async (oldPassword, newPassword) => {
        if (!vaultRef.current) return false;
        const file = await changeVaultPassword(vaultRef.current.file, oldPassword, newPassword);
        if (!file) return false;
        vaultRef.current = { ...vaultRef.current, file };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
        return true;
      },
      removePassword: async (password) => {
        if (!vaultRef.current || !journal) return false;
        const ok = await unlockVault(vaultRef.current.file, password);
        if (!ok) return false;
        vaultRef.current = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
        setHasPassword(false);
        return true;
      },
      unlock: async (secret, via = "password") => {
        const { vault } = readStored();
        if (!vault) return false;
        const res = await unlockVault(vault, secret, via);
        if (!res) return false;
        const j = JSON.parse(res.plaintext);
        if (!validJournal(j)) return false;
        vaultRef.current = { file: vault, dek: res.dek };
        setJournal(j);
        setStatus("ready");
        return true;
      },
      lock: () => {
        if (!hasPassword) return;
        // attende le scritture in corso, poi dimentica chiave e dati in chiaro
        void writeQueue.current.then(() => {
          vaultRef.current = null;
          setJournal(null);
          setStatus("locked");
        });
      },
    }),
    [status, journal, legacyUsers, storageError, lastImport, hasPassword, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJournal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJournal fuori da JournalProvider");
  return ctx;
}
