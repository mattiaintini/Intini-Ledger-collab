import { getCotReport } from "@/lib/cot/report";
import { NUMERIC_FIELDS } from "@/lib/cot/parse";

// Numeri della schermata d'ingresso: solo i totali della verifica, senza lo storico completo.
export const revalidate = 3600;

export async function GET() {
  const r = await getCotReport();
  return Response.json({
    status: r.status,
    latestReport: r.latestReport,
    markets: r.markets.length,
    weeksChecked: r.summary.weeksChecked,
    weeksFailed: r.summary.weeksFailed,
    // ogni settimana confrontata col file CFTC confronta tutti i campi numerici
    valuesCompared: r.summary.crossChecked * NUMERIC_FIELDS.length,
  });
}
