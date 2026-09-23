import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { NewsTable } from "@/components/news-table";
import { fetchCalendar, FF_URL } from "@/lib/news/forexfactory";

export const metadata: Metadata = { title: "News" };
// Pagina dinamica, feed nella data cache per un'ora: ForexFactory limita molto le richieste (429)
// e solo le risposte riuscite vengono salvate, quindi un errore non resta in pagina per un'ora.
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  let data: Awaited<ReturnType<typeof fetchCalendar>> | null = null;
  try {
    data = await fetchCalendar();
  } catch {
    data = null;
  }

  return (
    <>
      <PageHeader
        title="News"
        description="Calendario macro della settimana: orario, valuta, impatto, previsto e precedente. Gli eventi già passati sono attenuati."
      />
      <Card>
        {data ? <NewsTable events={data.events} /> : <p className="text-sm text-muted">Il calendario ForexFactory non ha risposto. Riprova tra qualche minuto.</p>}
        <p className="mt-6 text-xs text-subtle">
          Fonte: <Link href={FF_URL} target="_blank" className="underline underline-offset-4">ForexFactory</Link>, aggiornato ogni ora. Il feed copre solo la settimana corrente e non riporta il dato effettivo.
          {data && data.dropped > 0 && ` ${data.dropped} eventi scartati perché malformati.`}
        </p>
      </Card>
    </>
  );
}
