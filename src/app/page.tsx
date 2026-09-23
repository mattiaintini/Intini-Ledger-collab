"use client";

import Link from "next/link";
import { useMemo } from "react";
import { WithJournal, MigrationSummary } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { EquityChart, InstrumentBars } from "@/components/charts";
import { MonthGrid } from "@/components/month-grid";
import { Button, ButtonLink, Card, CardTitle, Empty, Stat } from "@/components/ui";
import { computeStats, enrich } from "@/lib/journal/stats";
import { auditJournal, todayISO } from "@/lib/journal/validate";
import { useJournal } from "@/lib/journal/store";
import { money, num, pct, tone } from "@/lib/format";
import type { Journal } from "@/lib/journal/types";

function DailyRisk({ journal }: { journal: Journal }) {
  const today = todayISO();
  const list = enrich(journal.trades, journal.profile.capital);
  const todays = list.filter((t) => t.date === today);
  const startEquity = todays[0]?.equityBefore ?? journal.profile.capital + list.reduce((a, t) => a + t.pnl, 0);
  const pnl = todays.reduce((a, t) => a + t.pnl, 0);
  const limit = (startEquity * journal.profile.maxDailyLossPct) / 100;
  const used = pnl < 0 ? Math.min(100, (-pnl / limit) * 100) : 0;
  const cur = journal.profile.currency;
  return (
    <div className="rounded-[var(--radius-ui)] border border-line p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label text-muted">Daily risk</span>
        <span className="num text-xs text-subtle">limite {num(journal.profile.maxDailyLossPct, 1)}%</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${used >= 100 ? "bg-alert" : used >= 75 ? "bg-warn" : "bg-fg"}`} style={{ width: `${used}%` }} />
      </div>
      <p className="num mt-2 text-xs text-muted">
        {used >= 100 ? "Limite raggiunto: stop per oggi." : `${money(pnl, cur, { sign: true })} / -${money(limit, cur)} · ${todays.length} trade oggi`}
      </p>
    </div>
  );
}

function Dashboard({ journal }: { journal: Journal }) {
  const { lastImport, clearImport } = useJournal();
  const s = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  const recent = useMemo(() => enrich(journal.trades, journal.profile.capital).reverse().slice(0, 10), [journal]);
  const flagged = useMemo(() => new Set(auditJournal(journal).filter((i) => i.level === "error").map((i) => i.tradeId)), [journal]);
  const errors = flagged.size;
  const cur = journal.profile.currency;
  const byAsset = s.byAsset.map((b) => ({ key: b.key, value: b.net }));

  return (
    <>
      {lastImport && (
        <div className="mb-4 flex flex-col gap-3">
          <MigrationSummary report={lastImport} />
          <Button className="self-start" onClick={clearImport}>Chiudi</Button>
        </div>
      )}
      {errors > 0 && (
        <p className="mb-4 rounded-[var(--radius-ui)] border border-alert/40 px-3 py-2 text-sm">
          <span className="text-alert">{errors} trade con dati incoerenti</span>
          <span className="text-muted"> falsano le statistiche. </span>
          <Link href="/settings#controllo-dati" className="underline underline-offset-4">Apri il controllo dati</Link>
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Colonna ordini, sempre visibile su desktop come nella v8 */}
        <aside className="hidden xl:block">
          <Card className="sticky top-20">
            <CardTitle aside={<span className="num">{todayISO().split("-").reverse().join("/")}</span>}>New trade</CardTitle>
            <div className="mb-4"><DailyRisk journal={journal} /></div>
            <TradeForm journal={journal} />
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="xl:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <ButtonLink href="/journal/new" variant="primary">Nuovo trade</ButtonLink>
            </div>
            <DailyRisk journal={journal} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Equity" value={money(s.equity, cur)} hint={pct(s.returnPct, 2, { sign: true })} />
            <Stat label="Net P&L" value={money(s.net, cur, { sign: true })} valueClass={tone(s.net)} hint={`su ${money(journal.profile.capital, cur)}`} />
            <Stat label="Win rate" value={pct(s.winRate)} hint={`${s.wins}V ${s.losses}P ${s.breakeven}BE`} />
            <Stat label="Profit factor" value={num(s.profitFactor, 2)} hint={`EV ${money(s.expectancy, cur, { sign: true })}`} />
            <div className="col-span-2 md:col-span-1">
              <Stat label="Max drawdown" value={pct(s.maxDrawdownPct, 2)} hint={`${s.trades} trade`} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle aside="tratteggio = capitale iniziale">Equity curve</CardTitle>
              {s.trades ? <EquityChart data={s.curve} capital={journal.profile.capital} /> : <Empty title="Nessun trade ancora" />}
            </Card>
            <Card>
              <CardTitle>P&amp;L by instrument</CardTitle>
              {byAsset.length ? <InstrumentBars data={byAsset} /> : <Empty title="Nessun trade" />}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardTitle aside={<Link href="/journal" className="underline-offset-4 hover:underline">Tutti i trade</Link>}>Trade log</CardTitle>
              {recent.length ? <TradeList trades={recent} currency={cur} compact flagged={flagged} /> : <Empty title="Il journal è vuoto" />}
            </Card>
            <Card>
              <CardTitle aside={<Link href="/calendar" className="underline-offset-4 hover:underline">Apri</Link>}>Calendar</CardTitle>
              <MonthGrid daily={s.daily} currency={cur} compact />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <Dashboard journal={j} />}</WithJournal>;
}
