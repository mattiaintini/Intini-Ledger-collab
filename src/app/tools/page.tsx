"use client";

import { useMemo, useState } from "react";
import { SimulationChart } from "@/components/charts";
import { Button, Card, CardTitle, Field, PageHeader, Stat } from "@/components/ui";
import { useJournal } from "@/lib/journal/store";
import { computeStats } from "@/lib/journal/stats";
import { monteCarlo, type MonteCarloResult } from "@/lib/montecarlo";
import { num, pct } from "@/lib/format";

const n = (s: string) => Number(s.replace(",", "."));

function PositionSize({ capital }: { capital: number }) {
  const [cap, setCap] = useState(String(Math.round(capital)));
  const [risk, setRisk] = useState("1");
  const [stop, setStop] = useState("20");
  const [pipValue, setPipValue] = useState("10");
  const riskAmount = (n(cap) * n(risk)) / 100;
  const lots = n(stop) > 0 && n(pipValue) > 0 ? riskAmount / (n(stop) * n(pipValue)) : NaN;
  return (
    <Card>
      <CardTitle>Position size</CardTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capitale"><input className="field num" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
        <Field label="Rischio %"><input className="field num" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} /></Field>
        <Field label="Stop (pip o punti)"><input className="field num" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
        <Field label="Valore pip per lotto" hint="EURUSD 10, XAUUSD 1 per 0,01 $"><input className="field num" inputMode="decimal" value={pipValue} onChange={(e) => setPipValue(e.target.value)} /></Field>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Lotti" value={Number.isFinite(lots) ? num(lots, 2) : "n/d"} />
        <Stat label="Rischio in valuta" value={Number.isFinite(riskAmount) ? num(riskAmount, 2) : "n/d"} />
      </div>
      <p className="mt-3 text-xs text-subtle">Lotti = capitale x rischio / (stop x valore del pip). Arrotonda per difetto al passo del tuo broker.</p>
    </Card>
  );
}

function Simulator({ prefill }: { prefill: { start: number; winRate: number; rr: number } }) {
  const [f, setF] = useState({ start: String(Math.round(prefill.start)), winRate: String(Math.round(prefill.winRate)), rr: String(prefill.rr), risk: "1", trades: "100", dd: "20" });
  const [res, setRes] = useState<MonteCarloResult | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const run = () =>
    setRes(monteCarlo({ start: n(f.start), winRate: n(f.winRate) / 100, rr: n(f.rr), riskPct: n(f.risk), trades: Math.min(1000, Math.round(n(f.trades))), runs: 2000, ddThresholdPct: n(f.dd) }));
  const valid = [f.start, f.winRate, f.rr, f.risk, f.trades, f.dd].every((v) => Number.isFinite(n(v)) && n(v) > 0) && n(f.winRate) <= 100;

  return (
    <Card>
      <CardTitle aside="2.000 simulazioni">Monte Carlo</CardTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Capitale"><input className="field num" value={f.start} onChange={set("start")} inputMode="decimal" /></Field>
        <Field label="Win rate %"><input className="field num" value={f.winRate} onChange={set("winRate")} inputMode="decimal" /></Field>
        <Field label="RR"><input className="field num" value={f.rr} onChange={set("rr")} inputMode="decimal" /></Field>
        <Field label="Rischio %"><input className="field num" value={f.risk} onChange={set("risk")} inputMode="decimal" /></Field>
        <Field label="Trade"><input className="field num" value={f.trades} onChange={set("trades")} inputMode="numeric" /></Field>
        <Field label="Soglia DD %"><input className="field num" value={f.dd} onChange={set("dd")} inputMode="decimal" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={run} disabled={!valid}>Simula</Button>
        <p className="text-xs text-subtle">Precompilato con win rate e payoff reali del tuo journal, quando ci sono trade.</p>
      </div>
      {res && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Mediana finale" value={num(res.median, 0)} />
            <Stat label="Peggior 5%" value={num(res.p5, 0)} />
            <Stat label="Miglior 5%" value={num(res.p95, 0)} />
            <Stat label="Drawdown mediano" value={pct(res.medianMaxDdPct)} />
            <Stat label={`DD oltre ${f.dd}%`} value={pct(res.probDd * 100)} hint={`Chiude in perdita: ${pct(res.probLoss * 100)}`} />
          </div>
          <div className="mt-6">
            <SimulationChart paths={res.paths} start={n(f.start)} />
          </div>
        </>
      )}
    </Card>
  );
}

export default function ToolsPage() {
  const { journal } = useJournal();
  const prefill = useMemo(() => {
    if (!journal) return { start: 10000, winRate: 50, rr: 2 };
    const s = computeStats(journal.trades, journal.profile.capital);
    return { start: s.equity, winRate: s.winRate ?? 50, rr: s.payoff !== null && Number.isFinite(s.payoff) ? Math.round(s.payoff * 100) / 100 : 2 };
  }, [journal]);

  return (
    <>
      <PageHeader title="Tools" description="Dimensionamento della posizione e simulazione dell'andamento del capitale." />
      <div className="grid gap-4 md:gap-6">
        <div className="max-w-2xl"><PositionSize capital={prefill.start} /></div>
        <Simulator key={journal ? "j" : "none"} prefill={prefill} />
      </div>
    </>
  );
}
