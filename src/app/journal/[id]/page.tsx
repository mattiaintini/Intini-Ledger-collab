"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { WithJournal } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { Button, ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { auditJournal } from "@/lib/journal/validate";
import { useJournal } from "@/lib/journal/store";
import { dateIT } from "@/lib/format";
import type { Journal, Trade } from "@/lib/journal/types";

const Back = () => (
  <ButtonLink href="/journal" variant="plain" size="sm" className="-ml-2 mb-2 text-[15px]">
    <ChevronLeft size={18} /> Journal
  </ButtonLink>
);

function EditTrade({ journal, trade }: { journal: Journal; trade: Trade }) {
  const router = useRouter();
  const { deleteTrade } = useJournal();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const issues = auditJournal(journal).filter((i) => i.tradeId === trade.id);

  return (
    <div className="max-w-2xl">
      <Back />
      <PageHeader title={trade.asset} description={`${trade.direction === "LONG" ? "Long" : "Short"} del ${dateIT(trade.date, { day: "numeric", month: "long", year: "numeric" })}${trade.time ? ` alle ${trade.time}` : ""}`} />

      {issues.length > 0 && (
        <div className="mb-4 flex gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-alert" aria-hidden />
          <div className="text-[15px]">
            <p className="font-semibold">Problemi trovati dal controllo dati</p>
            <ul className="mt-1 text-muted">{issues.map((i) => <li key={i.message}>{i.message}</li>)}</ul>
          </div>
        </div>
      )}

      {trade.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trade.image} alt={`Grafico del trade ${trade.asset}`} className="mb-4 w-full rounded-[var(--radius-card)]" />
      )}

      <TradeForm journal={journal} initial={trade} onSaved={() => router.back()} />

      <Card className="mt-8 p-0 md:p-0">
        <Button
          variant="danger"
          className="h-11 w-full rounded-[var(--radius-card)] text-[15px]"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            deleteTrade(trade.id);
            router.push("/journal");
          }}
        >
          {confirmDelete ? "Conferma eliminazione" : "Elimina trade"}
        </Button>
      </Card>
      {confirmDelete && <p className="mt-2 px-4 text-[13px] text-muted">Il trade viene rimosso dal journal e dalle statistiche.</p>}
    </div>
  );
}

export default function EditTradePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <WithJournal>
      {(j) => {
        const trade = j.trades.find((t) => t.id === decodeURIComponent(id));
        if (!trade) {
          return (
            <>
              <Back />
              <Card>
                <Empty title="Trade non trovato">Potrebbe essere stato eliminato.</Empty>
              </Card>
            </>
          );
        }
        return <EditTrade journal={j} trade={trade} />;
      }}
    </WithJournal>
  );
}
