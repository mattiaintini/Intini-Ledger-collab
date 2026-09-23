"use client";

import { Button, Card, PageHeader } from "@/components/ui";

export default function CotError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="COT Report" />
      <Card>
        <p className="text-sm">La CFTC non ha risposto o ha restituito dati in un formato inatteso.</p>
        <p className="mt-2 text-sm text-muted">Nessun dato viene mostrato finché non supera la verifica: meglio una pagina vuota che numeri sbagliati.</p>
        <Button className="mt-4" onClick={reset}>Riprova</Button>
      </Card>
    </>
  );
}
