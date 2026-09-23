import { buildCotReport } from "@/lib/cot/source";

// Job settimanale (vercel.json): rifà la verifica completa senza cache.
// Risponde 500 se una settimana non torna, così l'errore compare nei log e negli alert di Vercel.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await buildCotReport({ noCache: true });
  const failures = report.markets.flatMap((m) =>
    m.verification.weeks.filter((w) => w.status === "fail").map((w) => ({ market: m.market.key, date: w.date, issues: w.issues })),
  );
  const body = {
    status: report.status,
    latestReport: report.latestReport,
    summary: report.summary,
    missing: report.missing.map((m) => m.key),
    sources: report.sources.map(({ id, ok, rows, error }) => ({ id, ok, rows, error })),
    freshness: report.markets.map((m) => ({ market: m.market.key, ...m.verification.freshness })),
    failures,
  };
  console.log(`[verify-cot] ${report.status} latest=${report.latestReport} weeks=${report.summary.weeksChecked} failed=${report.summary.weeksFailed}`);
  return Response.json(body, { status: report.status === "fail" ? 500 : 200 });
}
