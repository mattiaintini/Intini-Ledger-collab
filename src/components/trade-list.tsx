"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, ImageIcon } from "lucide-react";
import { OUTCOME_LABEL, SESSION_LABEL, TYPE_LABEL, type Currency } from "@/lib/journal/types";
import type { EnrichedTrade } from "@/lib/journal/stats";
import { dateIT, money, num } from "@/lib/format";

const editHref = (id: string) => `/journal/${encodeURIComponent(id)}`;

/** Punto rosso sui trade che non superano il controllo dati (il testo resta neutro). */
const Flag = ({ on }: { on: boolean }) =>
  on ? <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-alert" role="img" aria-label="Da correggere" title="Dati incoerenti: da correggere" /> : null;

const pnlCls = (n: number) => (n < 0 ? "text-muted" : "font-semibold");

/**
 * Tabella in stile Apple: niente righe di azioni, la riga intera apre il trade (modifica ed eliminazione sono lì).
 * `flagged` = id dei trade con errori nel controllo dati.
 */
export function TradeList({ trades, currency, compact = false, flagged = new Set<string>() }: { trades: EnrichedTrade[]; currency: Currency; compact?: boolean; flagged?: ReadonlySet<string> }) {
  const router = useRouter();
  const open = (id: string) => router.push(editHref(id));

  return (
    <>
      {/* Mac */}
      <div className="-mx-2 hidden md:block">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[12px] font-medium text-muted">
            <tr>
              <th className="px-2 pb-2 font-medium">Data</th>
              <th className="px-2 pb-2 font-medium">Strumento</th>
              {!compact && <th className="px-2 pb-2 font-medium">Sessione</th>}
              {!compact && <th className="px-2 pb-2 font-medium">Tipo</th>}
              {!compact && <th className="px-2 pb-2 text-right font-medium">Rischio</th>}
              <th className="px-2 pb-2 font-medium">Esito</th>
              {!compact && <th className="px-2 pb-2 text-right font-medium">R</th>}
              <th className="px-2 pb-2 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr
                key={t.id}
                onClick={() => open(t.id)}
                onKeyDown={(e) => e.key === "Enter" && open(t.id)}
                tabIndex={0}
                aria-label={`${t.asset} del ${dateIT(t.date)}, apri`}
                className="cursor-default border-t-[0.5px] border-line active:bg-surface-3 [&>td]:h-9 [&>td]:px-2"
              >
                <td className="num whitespace-nowrap text-muted">
                  <span className="text-fg">{dateIT(t.date, { day: "numeric", month: "short" })}</span> {t.time}
                </td>
                <td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Flag on={flagged.has(t.id)} />
                    {t.asset}
                    <span className="font-normal text-muted">{t.direction === "LONG" ? "Long" : "Short"}</span>
                    {t.image && <ImageIcon size={13} className="text-muted" aria-label="con immagine" />}
                  </span>
                </td>
                {!compact && <td className="text-muted">{SESSION_LABEL[t.session]}</td>}
                {!compact && <td className="text-muted">{TYPE_LABEL[t.type]} · {t.grade}</td>}
                {!compact && <td className="num text-right text-muted">{num(t.riskPct, 2)}%</td>}
                <td className="whitespace-nowrap text-muted">{OUTCOME_LABEL[t.outcome]}</td>
                {!compact && <td className={`num text-right ${t.r === null ? "text-muted" : pnlCls(t.r)}`}>{t.r === null ? "n/d" : num(t.r, 2, { sign: true })}</td>}
                <td className={`num whitespace-nowrap text-right ${pnlCls(t.pnl)}`}>{money(t.pnl, currency, { sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* iPhone: righe da 44pt con freccia */}
      <ul className="-mx-4 md:hidden">
        {trades.map((t, i) => (
          <li key={t.id}>
            <button onClick={() => open(t.id)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3 ${i ? "border-t-[0.5px] border-line" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px] font-medium">
                  <Flag on={flagged.has(t.id)} />
                  {t.asset} <span className="font-normal text-muted">{t.direction === "LONG" ? "Long" : "Short"}</span>
                </p>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {dateIT(t.date, { day: "numeric", month: "short" })} {t.time} · {OUTCOME_LABEL[t.outcome]}
                  {t.r !== null && ` · ${num(t.r, 2, { sign: true })}R`}
                </p>
                {!compact && t.notes && <p className="mt-0.5 truncate text-[13px] text-muted">{t.notes}</p>}
              </div>
              <span className={`num text-[15px] ${pnlCls(t.pnl)}`}>{money(t.pnl, currency, { sign: true })}</span>
              <ChevronRight size={16} className="text-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
