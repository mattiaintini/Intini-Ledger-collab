"use client";

import { useParams, useRouter } from "next/navigation";
import { WithJournal } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";
import { auditJournal } from "@/lib/journal/validate";
import { dateIT } from "@/lib/format";

export default function EditTradePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <WithJournal>
      {(j) => {
        const trade = j.trades.find((t) => t.id === decodeURIComponent(id));
        if (!trade) {
          return (
            <>
              <PageHeader title="Edit trade" actions={<ButtonLink href="/journal">Journal</ButtonLink>} />
              <Empty title="Trade non trovato">Potrebbe essere stato eliminato.</Empty>
            </>
          );
        }
        const issues = auditJournal(j).filter((i) => i.tradeId === trade.id);
        return (
          <>
            <PageHeader
              title="Edit trade"
              description={`${trade.asset} del ${dateIT(trade.date)}. Le modifiche passano dagli stessi controlli dell'inserimento.`}
              actions={<ButtonLink href="/journal">Journal</ButtonLink>}
            />
            {issues.length > 0 && (
              <div className="mb-4 max-w-2xl rounded-[var(--radius-ui)] border border-neg/40 p-3 text-sm">
                <p className="text-neg">Problemi trovati dal controllo dati</p>
                <ul className="mt-1 list-disc pl-5 text-muted">{issues.map((i) => <li key={i.message}>{i.message}</li>)}</ul>
              </div>
            )}
            <Card className="max-w-2xl">
              <TradeForm journal={j} initial={trade} onSaved={() => router.push("/settings#controllo-dati")} />
            </Card>
          </>
        );
      }}
    </WithJournal>
  );
}
