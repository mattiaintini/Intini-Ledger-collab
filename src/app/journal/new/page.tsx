"use client";

import { ChevronLeft } from "lucide-react";
import { WithJournal } from "@/components/onboarding";
import { TradeForm } from "@/components/trade-form";
import { ButtonLink, PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <WithJournal>
      {(j) => (
        <div className="max-w-2xl">
          <ButtonLink href="/journal" variant="plain" className="-ml-2 mb-2 text-[15px]">
            <ChevronLeft size={18} /> Journal
          </ButtonLink>
          <PageHeader title="New trade" description="Il P&L si calcola dal piano: se lo correggi oltre il 25% ti viene chiesta conferma." />
          <TradeForm journal={j} />
        </div>
      )}
    </WithJournal>
  );
}
