"use client";

import type { ReactNode } from "react";
import { useJournal } from "@/lib/journal/store";
import type { Journal } from "@/lib/journal/types";
import type { MigrationReport } from "@/lib/journal/migrate";
import { EntryScreen } from "./entry/entry-screen";

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

/** Mostra il contenuto solo quando esiste un journal sbloccato, altrimenti la schermata d'ingresso. */
export function WithJournal({ children }: { children: (j: Journal) => ReactNode }) {
  const { status, journal, storageError } = useJournal();
  if (status === "loading") return <div className="h-40" aria-busy="true" />;
  // ingresso a tutto schermo con la scena di Backtesta: primo avvio e sblocco
  if (status === "locked") return <EntryScreen mode="locked" />;
  if (!journal) return <EntryScreen mode="empty" />;
  return (
    <>
      {storageError && <p className="mb-4 rounded-[var(--radius-ui)] border border-alert/40 p-3 text-sm text-alert">{storageError}</p>}
      {children(journal)}
    </>
  );
}
