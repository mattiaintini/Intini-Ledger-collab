import { buildCotReport, type CotReport } from "./source";

// Le pagine COT (panoramica, 13 mercati, verifica, API) usano lo stesso report.
// Lo si tiene in memoria 10 minuti per istanza: una rigenerazione non riscarica 7 MB per ogni pagina.
const TTL_MS = 10 * 60 * 1000;
let memo: { at: number; promise: Promise<CotReport> } | null = null;

export function getCotReport(): Promise<CotReport> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.promise;
  const promise = buildCotReport();
  memo = { at: Date.now(), promise };
  // un errore non deve restare in memoria: la richiesta successiva riprova
  promise.catch(() => {
    if (memo?.promise === promise) memo = null;
  });
  return promise;
}
