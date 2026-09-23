"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { WithJournal, MigrationSummary } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { TradeList } from "@/components/trade-list";
import { EquityHero } from "@/components/equity-hero";
import { InstrumentList } from "@/components/instrument-list";
import { MonthGrid } from "@/components/month-grid";
import { Sheet } from "@/components/sheet";
import { Button, ButtonLink, Card, CardTitle, Empty, PageHeader, Stat } from "@/components/ui";
import { computeStats, enrich } from "@/lib/journal/stats";
import { auditJournal, todayISO } from "@/lib/journal/validate";
import { useJournal } from "@/lib/journal/store";
import { money, num, pct } from "@/lib/format";
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
    <div className="min-w-0 rounded-[var(--radius-card)] bg-surface p-4">
      <p className="text-[13px] font-semibold text-muted">Rischio di oggi</p>
      <p className="mt-1.5 text-[28px] leading-[34px] rounded-num">
        {num(used)}
        <span className="ml-1 text-[17px] font-semibold text-muted">%</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={Math.round(used)} aria-valuemin={0} aria-valuemax={100} aria-label="Limite di perdita giornaliera usato">
        <div className={`h-full rounded-full ${used >= 100 ? "bg-alert" : used >= 75 ? "bg-warn" : "bg-fg"}`} style={{ width: `${Math.max(used, 2)}%` }} />
      </div>
      <p className="mt-1.5 truncate text-[13px] text-muted">
        {used >= 100 ? "Limite raggiunto, stop per oggi" : `${money(pnl, cur, { sign: true })} su ${money(-limit, cur)}`}
      </p>
    </div>
  );
}

function Dashboard({ journal }: { journal: Journal }) {
  const { lastImport, clearImport } = useJournal();
  const [adding, setAdding] = useState(false);
  const s = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  const recent = useMemo(() => enrich(journal.trades, journal.profile.capital).reverse().slice(0, 8), [journal]);
  const flagged = useMemo(() => new Set(auditJournal(journal).filter((i) => i.level === "error").map((i) => i.tradeId)), [journal]);
  const cur = journal.profile.currency;

  // ⌘N / Ctrl+N apre il nuovo trade, come in un'app del Mac
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} title="Nuovo trade (⌘N)" aria-label="Nuovo trade" className="max-md:h-9 max-md:w-9 max-md:rounded-full max-md:px-0">
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden md:inline">Nuovo trade</span>
          </Button>
        }
      />

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Nuovo trade"
        action={<button type="submit" form="sheet-trade" className="text-[17px] font-semibold active:opacity-60">Aggiungi</button>}
      >
        <TradeForm id="sheet-trade" journal={journal} onSaved={() => setAdding(false)} />
      </Sheet>

      {lastImport && (
        <div className="mb-4 flex flex-col gap-3">
          <MigrationSummary report={lastImport} />
          <Button className="self-start" size="sm" onClick={clearImport}>Chiudi</Button>
        </div>
      )}
      {flagged.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3">
          <TriangleAlert size={18} className="shrink-0 text-alert" aria-hidden />
          <p className="min-w-0 flex-1 text-[15px]">
            {flagged.size} trade con dati incoerenti <span className="text-muted">falsano le statistiche</span>
          </p>
          <ButtonLink href="/settings#controllo-dati" variant="plain" size="sm" className="font-semibold">Controlla</ButtonLink>
        </div>
      )}

      {s.trades ? (
        <EquityHero curve={s.curve} capital={journal.profile.capital} currency={cur} />
      ) : (
        <Card>
          <Empty title="Nessun trade" action={<Button variant="primary" size="sm" onClick={() => setAdding(true)}>Registra il primo trade</Button>}>
            La curva del capitale compare dal primo trade registrato.
          </Empty>
        </Card>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Win rate" value={num(s.winRate, 1)} unit="%" hint={`${s.wins} vinti, ${s.losses} persi`} />
        <Stat label="Profit factor" value={num(s.profitFactor, 2)} hint={`${s.trades} trade`} />
        <Stat label="Expectancy" value={money(s.expectancy, cur, { sign: true })} hint="per trade" />
        <Stat label="Max drawdown" value={num(s.maxDrawdownPct, 2)} unit="%" hint={money(-s.maxDrawdown, cur)} />
        <div className="col-span-2 md:col-span-1">
          <DailyRisk journal={journal} />
        </div>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-3">
        <Card className="min-w-0 self-start lg:col-span-2">
          <CardTitle aside={<Link href="/journal" className="active:opacity-60">Mostra tutto</Link>}>Ultimi trade</CardTitle>
          {recent.length ? <TradeList trades={recent} currency={cur} compact flagged={flagged} /> : <Empty title="Il journal è vuoto" />}
        </Card>
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle aside={pct(s.returnPct, 2, { sign: true })}>Per strumento</CardTitle>
            {s.byAsset.length ? (
              <InstrumentList rows={s.byAsset.map((b) => ({ key: b.key, value: b.net, trades: b.trades }))} currency={cur} />
            ) : (
              <p className="text-[15px] text-muted">Nessun trade</p>
            )}
          </Card>
          <Card>
            <MonthGrid daily={s.daily} currency={cur} compact />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <Dashboard journal={j} />}</WithJournal>;
}
