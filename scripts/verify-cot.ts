// Verifica completa dei dati COT da terminale: npm run verify:cot
// Esce con codice 1 se una settimana non torna, cosi' si puo' usare in CI.
import { buildCotReport } from "../src/lib/cot/source";

async function main() {
const report = await buildCotReport({ noCache: true });
for (const s of report.sources) console.log(`${s.ok ? "ok  " : "ERR "} ${s.label}: ${s.rows} righe${s.error ? ` (${s.error})` : ""}`);
console.log(`\nUltimo report: ${report.latestReport}`);
for (const m of report.markets) {
  const v = m.verification;
  const a = m.analytics;
  console.log(
    `${v.status.padEnd(4)} ${m.market.label.padEnd(20)} net ${a.specNet.toLocaleString("it-IT").padStart(9)}  idx52 ${a.cotIndex52?.toFixed(0).padStart(3) ?? "n/d"}  settimane ${v.weeks.length} (fail ${v.counts.fail}, confronto fonti ok ${v.weeks.filter((w) => w.source === "pass").length})  ${v.freshness.status}: ${v.freshness.message}`,
  );
  for (const w of v.weeks.filter((w) => w.status === "fail")) console.log(`     ${w.date}: ${w.issues.join("; ")}`);
}
console.log(`\nStato: ${report.status}. Settimane verificate ${report.summary.weeksChecked}, fallite ${report.summary.weeksFailed}, confrontate col file CFTC ${report.summary.crossChecked}.`);
process.exit(report.status === "fail" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
