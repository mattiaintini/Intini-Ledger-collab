"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Currency } from "@/lib/journal/types";
import { money } from "@/lib/format";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Valore compatto per celle strette: "+171", "-1,2k". */
export const compactPnl = (n: number) => {
  const a = Math.abs(n);
  const body = a >= 1000 ? `${(a / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })}k` : Math.round(a).toString();
  return `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${body}`;
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

  const today = new Date();
  const todayKey = iso(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className={`font-semibold capitalize ${compact ? "text-[15px]" : "text-[22px] font-bold"}`}>{first.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
          <p className="text-[13px] text-muted">
            <span className={`num ${monthNet < 0 ? "" : "font-semibold text-fg"}`}>{money(monthNet, currency, { sign: true })}</span> · {monthDays.length} giorni di trading, {green} positivi
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} aria-label="Mese precedente" className="flex h-8 w-8 items-center justify-center rounded-full text-fg active:bg-surface-3"><ChevronLeft size={18} /></button>
          <button onClick={() => shift(1)} aria-label="Mese successivo" className="flex h-8 w-8 items-center justify-center rounded-full text-fg active:bg-surface-3"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className={`grid grid-cols-7 ${compact ? "gap-1" : "gap-1.5"}`}>
        {DAYS.map((d) => <div key={d} className="pb-1 text-center text-[11px] font-semibold text-muted">{compact ? d[0] : d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = iso(ym.y, ym.m, d);
          const v = daily.get(key);
          const isToday = key === todayKey;
          // giorno positivo: riempito; negativo: nessun riempimento, valore in grigio col meno
          return (
            <div
              key={i}
              title={v ? `${money(v.pnl, currency, { sign: true })}, ${v.trades} trade` : undefined}
              className={`flex min-w-0 flex-col justify-between rounded-[8px] ${compact ? "aspect-square p-1" : "min-h-12 p-1.5 md:min-h-[72px] md:p-2"} ${v && v.pnl > 0 ? "bg-surface-3" : ""}`}
            >
              <span
                className={`flex items-center justify-center self-start rounded-full text-[12px] font-medium ${compact ? "h-5 w-5 text-[11px]" : "h-6 w-6 md:text-[13px]"} ${isToday ? "bg-fg font-semibold text-bg" : "text-muted"}`}
              >
                {d}
              </span>
              {v && (
                <>
                  <span className={`num block self-end overflow-hidden font-semibold ${compact ? "text-[9px] tracking-[-0.03em]" : "text-[11px] md:hidden"} ${v.pnl < 0 ? "font-normal text-muted" : ""}`}>{compactPnl(v.pnl)}</span>
                  {!compact && <span className={`num hidden self-end truncate text-[13px] font-semibold md:block ${v.pnl < 0 ? "font-normal text-muted" : ""}`}>{money(v.pnl, currency, { sign: true })}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
