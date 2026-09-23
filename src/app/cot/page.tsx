import type { Metadata } from "next";
import Link from "next/link";
import { getCotReport } from "@/lib/cot/report";
import { CotTable } from "@/components/cot-parts";
import { ButtonLink, Card, PageHeader, StatusBadge } from "@/components/ui";
import { dateIT } from "@/lib/format";
import type { MarketGroup } from "@/lib/cot/markets";

export const metadata: Metadata = { title: "COT Report" };
export const revalidate = 3600;

const GROUPS: MarketGroup[] = ["Valute", "Metalli", "Energia", "Indici", "Crypto"];

export default async function CotPage() {
  const report = await getCotReport();
  const { summary } = report;

  return (
    <>
      <PageHeader
        title="COT Report"
        description="Posizionamento dei grandi speculatori (Non-Commercial) dal Commitments of Traders della CFTC, futures only. Ogni settimana è confrontata con i file ufficiali CFTC prima di essere mostrata."
        actions={<ButtonLink href="/cot/verification">Dettaglio verifica</ButtonLink>}
      />

      <Card className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={report.status} />
            <p className="text-sm text-muted">
              Report del <span className="text-fg">{dateIT(report.latestReport, { day: "numeric", month: "long", year: "numeric" })}</span>.{" "}
              {summary.weeksChecked.toLocaleString("it-IT")} settimane controllate, {summary.crossChecked.toLocaleString("it-IT")} confrontate col file CFTC,{" "}
              {summary.weeksFailed === 0 ? "nessuna discrepanza." : <span className="text-neg">{summary.weeksFailed} con discrepanze.</span>}
            </p>
          </div>
          <p className="text-xs text-subtle">
            Aggiornato {new Date(report.generatedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" })}
          </p>
        </div>
      </Card>

      <div className="flex flex-col gap-10">
        {GROUPS.map((g) => {
          const markets = report.markets.filter((m) => m.market.group === g);
          return markets.length ? (
            <section key={g}>
              <h2 className="mb-3 text-sm font-medium text-muted">{g}</h2>
              <CotTable markets={markets} />
            </section>
          ) : null;
        })}
      </div>

      <Card className="mt-10">
        <h2 className="text-sm font-medium">Come leggere i numeri</h2>
        <dl className="mt-4 grid gap-4 text-sm text-muted md:grid-cols-2">
          <div><dt className="text-fg">Net speculativa</dt><dd>Contratti long meno short dei Non-Commercial (fondi, CTA).</dd></div>
          <div><dt className="text-fg">Variazione</dt><dd>Dai campi di variazione pubblicati dalla CFTC, verificati contro la differenza tra le due settimane.</dd></div>
          <div><dt className="text-fg">COT Index</dt><dd>Dove si trova la net attuale tra minimo (0) e massimo (100) delle ultime 26 settimane, 52 settimane o 3 anni. Sopra 80 o sotto 20 è un estremo.</dd></div>
          <div><dt className="text-fg">Posizionamento</dt><dd>Classificato sul COT Index a 52 settimane: 80+ long estremo, 60+ long, 40-60 neutrale, 20-40 short, sotto 20 short estremo.</dd></div>
        </dl>
        <p className="mt-4 text-xs text-subtle">
          Fonte: <Link className="underline underline-offset-4" href="https://publicreporting.cftc.gov/" target="_blank">CFTC Public Reporting</Link>. Dati del martedì, pubblicati il venerdì alle 15:30 ora di New York.
        </p>
      </Card>
    </>
  );
}
