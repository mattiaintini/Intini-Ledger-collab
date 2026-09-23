"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Currency } from "@/lib/journal/types";
import { money, tone } from "@/lib/format";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Valore compatto per celle strette: "+171", "-1,2k". */
export const compactPnl = (n: number) => {
  const a = Math.abs(n);
  const body = a >= 1000 ? `${(a / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })}k` : Math.round(a).toString();
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${body}`;
};

/**
 * Mese con il P&L giornaliero. `compact` per il pannello della dashboard (valori brevi);
 * altrimenti valori completi su desktop e brevi su mobile.
 */
export function MonthGrid({ daily, currency, compact = false }: { daily: Map<string, { pnl: number; trades: number }>; currency: Currency; compact?: boolean }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7; // lunedì = 0
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthKey = iso(ym.y, ym.m, 1).slice(0, 7);
  const monthDays = [...daily].filter(([d]) => d.startsWith(monthKey));
  const monthNet = monthDays.reduce((a, [, v]) => a + v.pnl, 0);
  const green = monthDays.filter(([, v]) => v.pnl > 0).length;
  const shift = (k: number) => setYm(({ y, m }) => ({ y: m + k < 0 ? y - 1 : m + k > 11 ? y + 1 : y, m: (m + k + 12) % 12 }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className={`font-medium capitalize ${compact ? "text-sm" : "text-lg"}`}>{first.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
          <p className="text-xs text-muted">
            <span className={`num ${tone(monthNet)}`}>{money(monthNet, currency, { sign: true })}</span> · {monthDays.length} giorni, {green} positivi
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => shift(-1)} aria-label="Mese precedente" className="rounded-[var(--radius-ui)] border border-line p-1.5 text-muted hover:text-fg"><ChevronLeft size={15} /></button>
          <button onClick={() => shift(1)} aria-label="Mese successivo" className="rounded-[var(--radius-ui)] border border-line p-1.5 text-muted hover:text-fg"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-subtle">
        {DAYS.map((d) => <div key={d} className="pb-1">{compact ? d[0] : d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const v = daily.get(iso(ym.y, ym.m, d));
          // scala di grigi: giornata positiva piena, negativa tratteggiata
          const cls = v
            ? v.pnl > 0
              ? "border-fg/60 bg-fg/[0.08]"
              : v.pnl < 0
                ? "border-dashed border-line-strong bg-transparent"
                : "border-line-strong"
            : "border-line";
          return (
            <div key={i} className={`flex min-w-0 flex-col justify-between rounded-[6px] border text-left ${compact ? "aspect-square p-0.5" : "aspect-square p-1 md:aspect-[4/3] md:p-2"} ${cls}`}>
              <span className="text-[10px] text-subtle">{d}</span>
              {v && (
                <>
                  <span className={`num block overflow-hidden font-medium ${compact ? "text-[9px] tracking-[-0.04em]" : "text-[10px] md:hidden"} ${tone(v.pnl)}`}>{compactPnl(v.pnl)}</span>
                  {!compact && <span className={`num hidden truncate text-sm font-medium md:block ${tone(v.pnl)}`}>{money(v.pnl, currency, { sign: true })}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
