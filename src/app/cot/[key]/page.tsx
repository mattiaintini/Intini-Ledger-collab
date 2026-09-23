import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCotReport } from "@/lib/cot/report";
import { COT_MARKETS } from "@/lib/cot/markets";
import { CotNetChart } from "@/components/charts";
import { IndexBar, Positioning } from "@/components/cot-parts";
import { WeekTable } from "@/components/week-table";
import { ButtonLink, Card, CardTitle, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { dateIT, num, pct, tone } from "@/lib/format";

export const revalidate = 3600;

export function generateStaticParams() {
  return COT_MARKETS.map((m) => ({ key: m.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const m = COT_MARKETS.find((x) => x.key === key);
  return { title: m ? `COT ${m.label}` : "COT" };
}

export default async function CotMarketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const report = await getCotReport();
  const r = report.markets.find((m) => m.market.key === key);
  if (!r) notFound();
  const { analytics: a, verification: v, market } = r;

  return (
    <>
      <PageHeader
        title={market.label}
        description={<>{r.exchangeName}, codice CFTC {market.code}. Report del {dateIT(a.date, { day: "numeric", month: "long", year: "numeric" })}.</>}
        actions={<ButtonLink href="/cot">Tutti i mercati</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Speculative net" value={num(a.specNet, 0, { sign: true })} valueClass={tone(a.specNet)} hint={`${pct(a.specNetPctOi, 1, { sign: true })} dell'open interest`} />
        <Stat label="Weekly change" value={num(a.specNetChange, 0, { sign: true })} valueClass={tone(a.specNetChange)} hint={`4 settimane: ${num(a.specNetChange4w, 0, { sign: true })}`} />
        <Stat label="Speculative long" value={pct(a.specLongPct, 1)} hint={`${num(a.specLong)} long, ${num(a.specShort)} short`} />
        <Stat label="Commercial net" value={num(a.commNet, 0, { sign: true })} valueClass={tone(a.commNet)} hint={`Variazione ${num(a.commNetChange, 0, { sign: true })}`} />
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle aside={<span><span className="text-fg">Speculativi</span> · Commercial</span>}>Net positions, 3 years</CardTitle>
          <CotNetChart data={r.history} />
        </Card>
        <Card>
          <CardTitle>COT Index</CardTitle>
          <div className="flex flex-col gap-5">
            {[["26 weeks", a.cotIndex26], ["52 weeks", a.cotIndex52], ["3 years", a.cotIndex156], ["Commercial 52 weeks", a.commIndex52]].map(([l, val]) => (
              <div key={l as string} className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted">{l}</span>
                <IndexBar value={val as number | null} />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">Positioning</span>
              <Positioning label={a.positioning} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Open interest</span>
              <span className="num text-sm">{num(a.openInterest)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4 md:mt-6">
        <CardTitle aside={<StatusBadge status={v.status} />}>Weekly checks</CardTitle>
        <div className="mb-4 grid gap-2 text-sm text-muted md:grid-cols-2">
          <p><StatusBadge status={v.freshness.status} label="Aggiornamento" /> <span className="ml-2">{v.freshness.message}</span></p>
          <p><StatusBadge status={v.apiLag.status} label="Allineamento fonti" /> <span className="ml-2">{v.apiLag.message}</span></p>
        </div>
        <WeekTable weeks={v.weeks} />
      </Card>
    </>
  );
}
