"use client";

import { useMemo } from "react";
import { WithJournal } from "@/components/onboarding";
import { PnlBars } from "@/components/charts";
import { Card, CardTitle, Empty, PageHeader, Stat } from "@/components/ui";
import { computeStats, enrich, type Breakdown } from "@/lib/journal/stats";
import { SESSION_LABEL, TYPE_LABEL, type Currency, type Journal, type Session, type TradeType } from "@/lib/journal/types";
import { money, num, pct, tone } from "@/lib/format";

function BreakdownTable({ title, rows, currency, label = (k) => k }: { title: string; rows: Breakdown[]; currency: Currency; label?: (k: string) => string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-normal" />
            <th className="py-2 text-right font-normal">Trade</th>
            <th className="py-2 text-right font-normal">Win rate</th>
            <th className="py-2 text-right font-normal">P&amp;L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2">{label(r.key)}</td>
              <td className="num py-2 text-right text-muted">{r.trades}</td>
              <td className="num py-2 text-right">{pct(r.winRate, 0)}</td>
              <td className={`num py-2 text-right ${tone(r.net)}`}>{money(r.net, currency, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Distribuzione dei risultati in R, a intervalli di mezzo R. */
function rHistogram(rs: number[]) {
  if (!rs.length) return [];
  const bin = (r: number) => Math.max(-3, Math.min(5, Math.floor(r * 2) / 2));
  const counts = new Map<number, number>();
  for (const r of rs) counts.set(bin(r), (counts.get(bin(r)) ?? 0) + 1);
  const out = [];
  for (let b = -3; b <= 5; b += 0.5) out.push({ key: `${b > 0 ? "+" : ""}${b}`, value: counts.get(b) ?? 0, negative: b < 0 });
  return out;
}

function Analytics({ journal }: { journal: Journal }) {
  const s = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  const rs = useMemo(() => enrich(journal.trades, journal.profile.capital).map((t) => t.r).filter((r): r is number => r !== null), [journal]);
  const cur = journal.profile.currency;

  if (!s.trades) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Empty title="Servono dei trade per le statistiche" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Tutte le metriche sono calcolate dai trade registrati. Win rate su vinti e persi, break even esclusi. R calcolato sul capitale prima di ogni trade."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Profit factor" value={num(s.profitFactor, 2)} hint={`${money(s.grossProfit, cur)} / ${money(-s.grossLoss, cur)}`} />
        <Stat label="Expectancy" value={money(s.expectancy, cur, { sign: true })} valueClass={tone(s.expectancy)} hint={`R medio ${num(s.avgR, 2, { sign: true })} su ${s.tradesWithR} trade`} />
        <Stat label="Payoff" value={num(s.payoff, 2)} hint={`Media vinti ${money(s.avgWin, cur)}, persi ${money(s.avgLoss, cur)}`} />
        <Stat label="Win rate" value={pct(s.winRate)} hint={`${s.wins} su ${s.wins + s.losses} trade decisi`} />
        <Stat label="Max drawdown" value={pct(s.maxDrawdownPct, 2)} hint={money(-s.maxDrawdown, cur)} />
        <Stat label="Max streaks" value={`${s.maxWinStreak} / ${s.maxLossStreak}`} hint="Vinti di fila / persi di fila" />
        <Stat label="Best trade" value={money(s.bestTrade, cur, { sign: true })} valueClass={tone(s.bestTrade)} />
        <Stat label="Worst trade" value={money(s.worstTrade, cur, { sign: true })} valueClass={tone(s.worstTrade)} />
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-2">
        <Card>
          <CardTitle aside="trade per intervallo di 0,5R">R distribution</CardTitle>
          {rs.length ? <PnlBars data={rHistogram(rs)} label="Trade" /> : <Empty title="Nessun trade con rischio registrato" />}
        </Card>
        <Card>
          <CardTitle>P&amp;L by weekday</CardTitle>
          <PnlBars data={s.byWeekday.map((b) => ({ key: b.key.slice(0, 3), value: b.net }))} label="P&L" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2 lg:grid-cols-3">
        <BreakdownTable title="By session" rows={s.bySession} currency={cur} label={(k) => SESSION_LABEL[k as Session]} />
        <BreakdownTable title="By type" rows={s.byType} currency={cur} label={(k) => TYPE_LABEL[k as TradeType]} />
        <BreakdownTable title="By setup grade" rows={s.byGrade} currency={cur} label={(k) => `Grado ${k}`} />
        <BreakdownTable title="By direction" rows={s.byDirection} currency={cur} label={(k) => (k === "LONG" ? "Long" : "Short")} />
        <div className="md:col-span-2">
          <BreakdownTable title="By instrument" rows={s.byAsset} currency={cur} />
        </div>
      </div>

      <Card className="mt-4 md:mt-6">
        <CardTitle>Execution quality</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">MAE medio</p>
            <p className="num mt-1 text-xl">{s.excursion.avgMaeR === null ? "n/d" : `${num(s.excursion.avgMaeR, 2)}R`}</p>
            <p className="text-xs text-subtle">su {s.excursion.withMae} trade</p>
          </div>
          <div>
            <p className="text-xs text-muted">MFE medio</p>
            <p className="num mt-1 text-xl">{s.excursion.avgMfeR === null ? "n/d" : `${num(s.excursion.avgMfeR, 2)}R`}</p>
            <p className="text-xs text-subtle">su {s.excursion.withMfe} trade</p>
          </div>
          <div>
            <p className="text-xs text-muted">Durata media</p>
            <p className="num mt-1 text-xl">{s.excursion.avgDurationMin === null ? "n/d" : `${num(s.excursion.avgDurationMin)} min`}</p>
            <p className="text-xs text-subtle">su {s.excursion.withDuration} trade</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-subtle">Calcolati solo sui trade in cui hai inserito MAE, MFE e durata. La versione precedente li generava a caso: sono stati rimossi.</p>
      </Card>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <Analytics journal={j} />}</WithJournal>;
}
