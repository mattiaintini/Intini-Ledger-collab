"use client";

import Link from "next/link";
import { useMemo } from "react";
import { WithJournal, MigrationSummary } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { EquityChart } from "@/components/charts";
import { Button, ButtonLink, Card, CardTitle, Empty, PageHeader, Stat } from "@/components/ui";
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
    <Card>
      <CardTitle aside={`limite ${num(journal.profile.maxDailyLossPct, 1)}%`}>Rischio di oggi</CardTitle>
      <p className={`num text-2xl font-semibold tracking-[-0.02em] ${tone(pnl)}`}>{money(pnl, cur, { sign: true })}</p>
      <div className="mt-4 h-1.5 rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${used >= 100 ? "bg-neg" : used >= 75 ? "bg-warn" : "bg-fg"}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-xs text-subtle">
        {used >= 100 ? "Limite giornaliero raggiunto: stop per oggi." : `Perdita massima ${money(limit, cur)}, usato il ${num(used)}%. ${todays.length} trade oggi.`}
      </p>
    </Card>
  );
}

function Dashboard({ journal }: { journal: Journal }) {
  const { lastImport, clearImport } = useJournal();
  const s = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  const recent = useMemo(() => enrich(journal.trades, journal.profile.capital).reverse().slice(0, 8), [journal]);
  const errors = useMemo(() => new Set(auditJournal(journal).filter((i) => i.level === "error").map((i) => i.tradeId)).size, [journal]);
  const cur = journal.profile.currency;

  return (
    <>
      <PageHeader
        title={journal.profile.name ? `Dashboard, ${journal.profile.name}` : "Dashboard"}
        description={`${s.trades} trade registrati su un capitale iniziale di ${money(journal.profile.capital, cur)}.`}
        actions={<ButtonLink href="/journal/new" variant="primary" className="lg:hidden">Nuovo trade</ButtonLink>}
      />

      {lastImport && (
        <div className="mb-6 flex flex-col gap-3">
          <MigrationSummary report={lastImport} />
          <Button className="self-start" onClick={clearImport}>Chiudi</Button>
        </div>
      )}
      {errors > 0 && (
        <p className="mb-6 rounded-[var(--radius-ui)] border border-neg/40 p-3 text-sm">
          <span className="text-neg">{errors} trade con dati incoerenti</span>
          <span className="text-muted"> falsano le statistiche. </span>
          <Link href="/settings#controllo-dati" className="underline underline-offset-4">Apri il controllo dati</Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <Stat label="Capitale" value={money(s.equity, cur)} hint={pct(s.returnPct, 2, { sign: true })} />
        <Stat label="P&L netto" value={money(s.net, cur, { sign: true })} valueClass={tone(s.net)} />
        <Stat label="Win rate" value={pct(s.winRate)} hint={`${s.wins} vinti, ${s.losses} persi, ${s.breakeven} BE`} />
        <Stat label="Profit factor" value={num(s.profitFactor, 2)} hint={`Expectancy ${money(s.expectancy, cur)}`} />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Max drawdown" value={pct(s.maxDrawdownPct, 2)} hint={money(-s.maxDrawdown, cur)} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-3">
        <div className="order-2 flex flex-col gap-4 lg:order-1 lg:col-span-2">
          <Card>
            <CardTitle aside="linea tratteggiata = capitale iniziale">Equity curve</CardTitle>
            {s.trades ? <EquityChart data={s.curve} capital={journal.profile.capital} /> : <Empty title="Nessun trade ancora">Registra il primo trade per vedere la curva.</Empty>}
          </Card>
          <Card>
            <CardTitle aside={<Link href="/journal" className="underline-offset-4 hover:underline">Tutti i trade</Link>}>Ultimi trade</CardTitle>
            {recent.length ? <TradeList trades={recent} currency={cur} compact /> : <Empty title="Il journal è vuoto" />}
          </Card>
        </div>
        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <DailyRisk journal={journal} />
          <Card className="hidden lg:block">
            <CardTitle>Nuovo trade</CardTitle>
            <TradeForm journal={journal} />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <Dashboard journal={j} />}</WithJournal>;
}
