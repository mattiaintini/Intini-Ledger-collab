"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LEGACY_STORAGE_KEY, STORAGE_KEY, type Journal, type Profile, type Trade } from "./types";
import { listLegacyUsers, migrateLegacy, type MigrationReport } from "./migrate";

// Il journal vive nel browser (localStorage), come nella v8: nessun dato di trading lascia il dispositivo.

type Status = "loading" | "empty" | "ready";

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
  deleteTrade: (id: string) => void;
  importLegacy: (user: string) => MigrationReport;
  replaceJournal: (j: Journal) => void;
  wipe: () => void;
}

const Ctx = createContext<JournalContext | null>(null);

function read(): Journal | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Journal;
    return j && j.version === 9 && Array.isArray(j.trades) ? j : null;
  } catch {
    return null;
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

export function JournalProvider({ children }: { children: ReactNode }) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [legacyUsers, setLegacyUsers] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<MigrationReport | null>(null);

  useEffect(() => {
    // lettura unica all'avvio: localStorage esiste solo nel browser
    const j = read();
    /* eslint-disable react-hooks/set-state-in-effect */
    setJournal(j);
    setLegacyUsers(listLegacyUsers(readLegacyRaw()));
    setStatus(j ? "ready" : "empty");
    /* eslint-enable react-hooks/set-state-in-effect */
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = read();
        setJournal(next);
        setStatus(next ? "ready" : "empty");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: Journal | null) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
      setStorageError(null);
    } catch {
      setStorageError("Spazio del browser esaurito: elimina le immagini dei trade più vecchi o esporta un backup.");
      return;
    }
    setJournal(next);
    setStatus(next ? "ready" : "empty");
  }, []);

  const value = useMemo<JournalContext>(
    () => ({
      status,
      journal,
      legacyUsers,
      storageError,
      lastImport,
      clearImport: () => setLastImport(null),
      createProfile: (profile) => persist({ version: 9, profile, trades: [] }),
      updateProfile: (p) => journal && persist({ ...journal, profile: { ...journal.profile, ...p } }),
      addTrade: (t) => journal && persist({ ...journal, trades: [...journal.trades, { ...t, id: newId(), createdAt: Date.now() }] }),
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
      wipe: () => persist(null),
    }),
    [status, journal, legacyUsers, storageError, lastImport, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJournal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJournal fuori da JournalProvider");
  return ctx;
}
