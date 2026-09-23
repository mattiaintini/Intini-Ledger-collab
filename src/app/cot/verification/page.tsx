import type { Metadata } from "next";
import Link from "next/link";
import { getCotReport } from "@/lib/cot/report";
import { ButtonLink, Card, CardTitle, PageHeader, StatusBadge } from "@/components/ui";
import { dateIT } from "@/lib/format";

export const metadata: Metadata = { title: "Verifica COT" };
export const revalidate = 3600;

export default async function VerificationPage() {
  const report = await getCotReport();

  return (
    <>
      <PageHeader
        title="Data verification"
        description="Come vengono controllati i dati COT prima di arrivare al journal. Tutti i controlli sono identità contabili della CFTC o confronti tra fonti ufficiali: un numero torna o non torna."
        actions={<ButtonLink href="/cot">Torna al report</ButtonLink>}
      />

      <Card className="mb-6">
        <CardTitle aside={<StatusBadge status={report.status} />}>Fonti usate in questa generazione</CardTitle>
        <ul className="divide-y divide-line text-sm">
          {report.sources.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <Link href={s.url} target="_blank" className="underline-offset-4 hover:underline">{s.label}</Link>
                {s.error && <p className="text-xs text-neg">{s.error}</p>}
                {s.note && <p className="text-xs text-subtle">{s.note}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-xs text-muted">{s.rows.toLocaleString("it-IT")} righe</span>
                <StatusBadge status={s.ok ? "pass" : "fail"} label={s.ok ? "Scaricata" : "Non disponibile"} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Esito per mercato</CardTitle>
        {report.missing.length > 0 && (
          <p className="mb-4 text-sm text-neg">Nessun dato dall&apos;API CFTC per {report.missing.map((m) => `${m.label} (${m.code})`).join(", ")}.</p>
        )}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-normal">Mercato</th>
                <th className="px-3 py-2 font-normal">Ultimo report</th>
                <th className="px-3 py-2 text-right font-normal">Settimane</th>
                <th className="px-3 py-2 text-right font-normal">Confrontate col file CFTC</th>
                <th className="px-3 py-2 text-right font-normal">Errori</th>
                <th className="px-3 py-2 font-normal">Aggiornamento</th>
                <th className="px-3 py-2 font-normal">Esito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.markets.map(({ market, verification: v }) => (
                <tr key={market.key}>
                  <td className="px-3 py-2"><Link className="underline-offset-4 hover:underline" href={`/cot/${market.key}`}>{market.label}</Link></td>
                  <td className="num px-3 py-2">{dateIT(v.freshness.latest)}</td>
                  <td className="num px-3 py-2 text-right">{v.weeks.length}</td>
                  <td className="num px-3 py-2 text-right">{v.weeks.filter((w) => w.source === "pass").length}</td>
                  <td className={`num px-3 py-2 text-right ${v.counts.fail ? "text-neg" : ""}`}>{v.counts.fail}</td>
                  <td className="px-3 py-2"><StatusBadge status={v.freshness.status} /></td>
                  <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardTitle>Controlli eseguiti su ogni settimana</CardTitle>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-muted">
          <li><span className="text-fg">Confronto tra fonti.</span> Ogni campo dell&apos;API CFTC deve coincidere con il file grezzo ufficiale della stessa data (archivi annuali e file della settimana).</li>
          <li><span className="text-fg">Continuità.</span> Le variazioni settimanali pubblicate devono essere uguali alla differenza calcolata tra le due settimane, per speculativi, commercial, spreading, non reportable e open interest.</li>
          <li><span className="text-fg">Bilancio.</span> Open interest uguale a posizioni reportable più non reportable, sia lato long sia lato short, e reportable uguale a speculativi più spreading più commercial.</li>
          <li><span className="text-fg">Calendario.</span> Nessuna settimana mancante o duplicata (tolleranza di un giorno per i festivi).</li>
          <li><span className="text-fg">Aggiornamento.</span> L&apos;ultimo report deve essere quello atteso dal calendario di pubblicazione CFTC (venerdì 15:30 ora di New York).</li>
        </ol>
        <p className="mt-4 text-xs text-subtle">
          Pagina rigenerata ogni ora. Un job settimanale (sabato mattina) ripete la verifica completa e registra l&apos;esito nei log di Vercel. Generata il {new Date(report.generatedAt).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" })}.
        </p>
      </Card>
    </>
  );
}
