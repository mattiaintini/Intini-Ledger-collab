"use client";

import { useMemo, useState } from "react";
import { WithJournal } from "@/components/onboarding";
import { TradeList } from "@/components/trade-list";
import { Button, ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { enrich } from "@/lib/journal/stats";
import { auditJournal } from "@/lib/journal/validate";
import { download, tradesToCsv } from "@/lib/journal/csv";
import { OUTCOME_LABEL, OUTCOMES, type Journal, type Outcome } from "@/lib/journal/types";
import { money, tone } from "@/lib/format";

function JournalView({ journal }: { journal: Journal }) {
  const [asset, setAsset] = useState("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [month, setMonth] = useState("");
  const all = useMemo(() => enrich(journal.trades, journal.profile.capital).reverse(), [journal]);
  const flagged = useMemo(() => new Set(auditJournal(journal).filter((i) => i.level === "error").map((i) => i.tradeId)), [journal]);
  const assets = useMemo(() => [...new Set(all.map((t) => t.asset))].sort(), [all]);
  const months = useMemo(() => [...new Set(all.map((t) => t.date.slice(0, 7)))], [all]);
  const list = all.filter((t) => (!asset || t.asset === asset) && (!outcome || t.outcome === outcome) && (!month || t.date.startsWith(month)));
  const net = list.reduce((a, t) => a + t.pnl, 0);
  const cur = journal.profile.currency;

  return (
    <>
      <PageHeader
        title="Journal"
        description={`${all.length} trade registrati. Ogni trade passa dagli stessi controlli dell'inserimento.`}
        actions={
          <>
            <Button onClick={() => download(`journal_${new Date().toISOString().slice(0, 10)}.csv`, tradesToCsv(journal.trades), "text/csv")} disabled={!all.length}>Esporta CSV</Button>
            <ButtonLink href="/journal/new" variant="primary">Nuovo trade</ButtonLink>
          </>
        }
      />
      <Card>
        <div className="mb-4 grid grid-cols-2 gap-3 md:flex md:items-center">
          <select className="field md:w-44" value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Strumento">
            <option value="">Tutti gli strumenti</option>
            {assets.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select className="field md:w-44" value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | "")} aria-label="Esito">
            <option value="">Tutti gli esiti</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
          </select>
          <select className="field md:w-44" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mese">
            <option value="">Tutti i mesi</option>
            {months.map((m) => <option key={m} value={m}>{new Date(`${m}-15T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</option>)}
          </select>
          <p className="text-sm text-muted md:ml-auto">
            {list.length} trade, <span className={`num ${tone(net)}`}>{money(net, cur, { sign: true })}</span>
          </p>
        </div>
        {list.length ? <TradeList trades={list} currency={cur} flagged={flagged} /> : <Empty title="Nessun trade con questi filtri" />}
      </Card>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <JournalView journal={j} />}</WithJournal>;
}
