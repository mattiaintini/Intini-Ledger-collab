"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WithJournal } from "@/components/onboarding";
import { Button, Card, PageHeader } from "@/components/ui";
import { computeStats } from "@/lib/journal/stats";
import type { Journal } from "@/lib/journal/types";
import { money, tone } from "@/lib/format";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function CalendarView({ journal }: { journal: Journal }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { daily } = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  const cur = journal.profile.currency;

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
    <>
      <PageHeader title="Calendar" description="P&L giornaliero chiuso, per data del trade." />
      <Card>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-medium capitalize">{first.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
            <p className="text-sm text-muted">
              <span className={`num ${tone(monthNet)}`}>{money(monthNet, cur, { sign: true })}</span> · {monthDays.length} giorni operativi, {green} in positivo
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => shift(-1)} aria-label="Mese precedente" className="px-3"><ChevronLeft size={16} /></Button>
            <Button onClick={() => shift(1)} aria-label="Mese successivo" className="px-3"><ChevronRight size={16} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-subtle md:gap-2">
          {DAYS.map((d) => <div key={d} className="pb-2">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const v = daily.get(iso(ym.y, ym.m, d));
            return (
              <div
                key={i}
                className={`flex aspect-square flex-col justify-between rounded-[8px] border p-1.5 text-left md:aspect-[4/3] md:p-2.5 ${
                  v ? (v.pnl > 0 ? "border-pos/30 bg-pos/[0.06]" : v.pnl < 0 ? "border-neg/30 bg-neg/[0.06]" : "border-line-strong") : "border-line"
                }`}
              >
                <span className="text-[11px] text-muted">{d}</span>
                {v && (
                  <span>
                    <span className={`num block truncate text-[10px] font-medium md:text-sm ${tone(v.pnl)}`}>{money(v.pnl, cur, { sign: true })}</span>
                    <span className="hidden text-[11px] text-subtle md:block">{v.trades} trade</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <CalendarView journal={j} />}</WithJournal>;
}
