"use client";

import { useMemo } from "react";
import { WithJournal } from "@/components/onboarding";
import { MonthGrid } from "@/components/month-grid";
import { Card, PageHeader } from "@/components/ui";
import { computeStats } from "@/lib/journal/stats";
import type { Journal } from "@/lib/journal/types";

function CalendarView({ journal }: { journal: Journal }) {
  const { daily } = useMemo(() => computeStats(journal.trades, journal.profile.capital), [journal]);
  return (
    <>
      <PageHeader title="Calendar" description="P&L giornaliero chiuso, per data del trade." />
      <Card>
        <MonthGrid daily={daily} currency={journal.profile.currency} />
      </Card>
    </>
  );
}

export default function Page() {
  return <WithJournal>{(j) => <CalendarView journal={j} />}</WithJournal>;
}
