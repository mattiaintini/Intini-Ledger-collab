"use client";

import { WithJournal } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <WithJournal>
      {(j) => (
        <>
          <PageHeader
            title="Nuovo trade"
            description="Il P&L si calcola dal piano (capitale x rischio x RR). Se lo modifichi e si discosta di oltre il 25% ti viene chiesta conferma."
            actions={<ButtonLink href="/journal">Journal</ButtonLink>}
          />
          <Card className="max-w-2xl">
            <TradeForm journal={j} />
          </Card>
        </>
      )}
    </WithJournal>
  );
}
