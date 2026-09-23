"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { useJournal } from "@/lib/journal/store";
import { OUTCOME_LABEL, SESSION_LABEL, TYPE_LABEL, type Currency } from "@/lib/journal/types";
import type { EnrichedTrade } from "@/lib/journal/stats";
import { dateIT, money, num, tone } from "@/lib/format";

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <button className="absolute right-4 top-4 rounded-full border border-line p-2" onClick={onClose} aria-label="Chiudi"><X size={18} /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Screenshot del trade" className="max-h-[85vh] max-w-full rounded-[var(--radius-ui)]" />
    </div>
  );
}

/** `flagged` = id dei trade con errori nel controllo dati: vengono marcati con il link di correzione. */
export function TradeList({ trades, currency, compact = false, flagged = new Set<string>() }: { trades: EnrichedTrade[]; currency: Currency; compact?: boolean; flagged?: ReadonlySet<string> }) {
  const { deleteTrade } = useJournal();
  const [img, setImg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const remove = (id: string) => {
    if (confirmId === id) {
      deleteTrade(id);
      setConfirmId(null);
    } else setConfirmId(id);
  };

  return (
    <>
      {img && <ImageModal src={img} onClose={() => setImg(null)} />}

      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">Data</th>
              <th className="px-3 py-2 font-normal">Strumento</th>
              <th className="px-3 py-2 font-normal">Direzione</th>
              {!compact && <th className="px-3 py-2 font-normal">Sessione</th>}
              {!compact && <th className="px-3 py-2 font-normal">Tipo</th>}
              {!compact && <th className="px-3 py-2 text-right font-normal">Rischio</th>}
              <th className="px-3 py-2 font-normal">Esito</th>
              <th className="px-3 py-2 text-right font-normal">R</th>
              <th className="px-3 py-2 text-right font-normal">P&amp;L</th>
              {!compact && <th className="px-3 py-2 font-normal"><span className="sr-only">Azioni</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {trades.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="num whitespace-nowrap px-3 py-2.5">{dateIT(t.date)}<span className="ml-2 text-subtle">{t.time}</span></td>
                <td className="px-3 py-2.5 font-medium">
                  {t.asset}
                  {flagged.has(t.id) && (
                    <Link href={`/journal/${encodeURIComponent(t.id)}`} className="ml-2 text-xs font-normal text-neg underline underline-offset-4">
                      da correggere
                    </Link>
                  )}
                  {!compact && t.notes && <p className="max-w-64 truncate text-xs font-normal text-subtle" title={t.notes}>{t.notes}</p>}
                </td>
                <td className="px-3 py-2.5 text-muted">{t.direction === "LONG" ? "Long" : "Short"}</td>
                {!compact && <td className="px-3 py-2.5 text-muted">{SESSION_LABEL[t.session]}</td>}
                {!compact && <td className="px-3 py-2.5 text-muted">{TYPE_LABEL[t.type]} · {t.grade}</td>}
                {!compact && <td className="num px-3 py-2.5 text-right text-muted">{num(t.riskPct, 2)}%</td>}
                <td className="px-3 py-2.5 text-muted">{OUTCOME_LABEL[t.outcome]}</td>
                <td className={`num px-3 py-2.5 text-right ${tone(t.r)}`}>{t.r === null ? "n/d" : num(t.r, 2, { sign: true })}</td>
                <td className={`num px-3 py-2.5 text-right font-medium ${tone(t.pnl)}`}>{money(t.pnl, currency, { sign: true })}</td>
                {!compact && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs">
                    {t.image && <button className="mr-3 text-muted underline-offset-4 hover:underline" onClick={() => setImg(t.image!)}>Immagine</button>}
                    <Link href={`/journal/${encodeURIComponent(t.id)}`} className="mr-3 text-muted underline-offset-4 hover:underline">Modifica</Link>
                    <button className={confirmId === t.id ? "text-neg" : "text-subtle hover:text-fg"} onClick={() => remove(t.id)}>
                      {confirmId === t.id ? "Conferma" : "Elimina"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="flex flex-col divide-y divide-line md:hidden">
        {trades.map((t) => (
          <li key={t.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">
                {t.asset} <span className="text-sm font-normal text-muted">{t.direction === "LONG" ? "Long" : "Short"}</span>
                {flagged.has(t.id) && (
                  <Link href={`/journal/${encodeURIComponent(t.id)}`} className="ml-2 text-xs font-normal text-neg underline underline-offset-4">
                    da correggere
                  </Link>
                )}
              </p>
              <p className={`num font-medium ${tone(t.pnl)}`}>{money(t.pnl, currency, { sign: true })}</p>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-subtle">
              <p>{dateIT(t.date)} {t.time} · {OUTCOME_LABEL[t.outcome]}{t.r !== null && ` · ${num(t.r, 2, { sign: true })}R`}</p>
              {!compact && (
                <p className="flex gap-3">
                  {t.image && <button onClick={() => setImg(t.image!)}>Immagine</button>}
                  <Link href={`/journal/${encodeURIComponent(t.id)}`}>Modifica</Link>
                  <button className={confirmId === t.id ? "text-neg" : ""} onClick={() => remove(t.id)}>{confirmId === t.id ? "Conferma" : "Elimina"}</button>
                </p>
              )}
            </div>
            {!compact && t.notes && <p className="mt-1 text-xs text-muted">{t.notes}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
