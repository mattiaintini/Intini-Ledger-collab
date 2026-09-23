import { unzipSync, strFromU8 } from "fflate";
import { COT_MARKETS, type CotMarket } from "./markets";
import { parseRawCotFile, parseSocrataRow, SOCRATA_FIELDS, type CotRow } from "./parse";
import { analyze, commNet, specNet, type CotAnalytics } from "./analytics";
import { compareSources, verifyMarket, type CheckStatus, type MarketVerification } from "./verify";

const SOCRATA_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const WEEKLY_URL = "https://www.cftc.gov/dea/newcot/deafut.txt";
const annualUrl = (year: number) => `https://www.cftc.gov/files/dea/history/deacot${year}.zip`;

/** 156 settimane per il COT Index a 3 anni, +1 per verificare la continuità della prima. */
export const HISTORY_WEEKS = 157;
const REVALIDATE_SECONDS = 3600;

// cftc.gov risponde 403 alle richieste senza User-Agent.
const HEADERS = { "User-Agent": "IntiniJournalSuite/9 (COT verification)" };

export interface MarketReport {
  market: CotMarket;
  exchangeName: string;
  analytics: CotAnalytics;
  history: { date: string; specNet: number; commNet: number; oi: number }[];
  verification: MarketVerification;
}

export interface SourceStatus {
  id: "socrata" | "weekly" | `annual-${number}`;
  label: string;
  url: string;
  ok: boolean;
  rows: number;
  error?: string;
  /** Nota informativa, es. archivio dell'anno non ancora pubblicato dalla CFTC. */
  note?: string;
}

export interface CotReport {
  generatedAt: string;
  latestReport: string;
  markets: MarketReport[];
  sources: SourceStatus[];
  status: CheckStatus;
  /** Mercati configurati per cui l'API non ha restituito dati: il report li omette e va in errore. */
  missing: CotMarket[];
  summary: { weeksChecked: number; weeksFailed: number; crossChecked: number };
}

async function fetchSocrata(markets: CotMarket[], weeks: number, noCache: boolean, now: Date): Promise<CotRow[]> {
  // filtro per data e non per numero di righe: un mercato con settimane mancanti non toglie storico agli altri
  const from = new Date(now.getTime() - (weeks + 2) * 7 * 86_400_000).toISOString().slice(0, 10);
  const where = `cftc_contract_market_code in(${markets.map((m) => `'${m.code}'`).join(",")}) AND report_date_as_yyyy_mm_dd >= '${from}'`;
  const params = new URLSearchParams({
    // solo i campi usati: la risposta completa pesa 13 MB, oltre il limite di cache
    $select: ["cftc_contract_market_code", "market_and_exchange_names", "report_date_as_yyyy_mm_dd", ...Object.values(SOCRATA_FIELDS)].join(","),
    $where: where,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "50000",
  });
  const res = await fetch(`${SOCRATA_URL}?${params}`, noCache ? { cache: "no-store" } : { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`API CFTC ha risposto ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>[];
  return json.map(parseSocrataRow);
}

// I file grezzi superano i 2 MB, oltre il limite della data cache di Next (che lo segnala nei log).
// La revalidate evita comunque che la pagina diventi dinamica: si scaricano solo quando la pagina si rigenera.
const cacheOpts = (noCache: boolean): RequestInit =>
  noCache ? { headers: HEADERS, cache: "no-store" } : { headers: HEADERS, next: { revalidate: REVALIDATE_SECONDS } };

async function fetchText(url: string, noCache: boolean): Promise<string> {
  const res = await fetch(url, cacheOpts(noCache));
  if (!res.ok) throw new Error(`${url} ha risposto ${res.status}`);
  return res.text();
}

class NotPublishedYet extends Error {}

async function fetchAnnual(year: number, noCache: boolean, now: Date): Promise<string> {
  const res = await fetch(annualUrl(year), cacheOpts(noCache));
  // a inizio anno l'archivio dell'anno nuovo non esiste ancora: non è un errore delle fonti
  if (res.status === 404 && year === now.getUTCFullYear()) throw new NotPublishedYet();
  if (!res.ok) throw new Error(`Archivio ${year} ha risposto ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".txt"));
  if (!name) throw new Error(`Archivio ${year} senza file .txt`);
  return strFromU8(files[name]);
}

export async function buildCotReport(opts: { noCache?: boolean; now?: Date; markets?: CotMarket[] } = {}): Promise<CotReport> {
  const now = opts.now ?? new Date();
  const noCache = opts.noCache ?? false;
  const configured = opts.markets ?? COT_MARKETS;
  const codes = new Set(configured.map((m) => m.code));
  const sources: SourceStatus[] = [];

  // Fonte primaria: senza di lei non c'è report.
  const apiRows = await fetchSocrata(configured, HISTORY_WEEKS, noCache, now);
  if (apiRows.length === 0) throw new Error("L'API CFTC non ha restituito dati");
  sources.push({ id: "socrata", label: "API CFTC (Socrata, Legacy Futures Only)", url: SOCRATA_URL, ok: true, rows: apiRows.length });

  // Fonti di controllo: il file della settimana e gli archivi annuali che coprono lo storico.
  const oldest = apiRows.reduce((min, r) => (r.date < min ? r.date : min), apiRows[0]?.date ?? now.toISOString());
  const firstYear = Number(oldest.slice(0, 4));
  const years: number[] = [];
  for (let y = firstYear; y <= now.getUTCFullYear(); y++) years.push(y);

  const [weekly, ...annuals] = await Promise.allSettled([fetchText(WEEKLY_URL, noCache), ...years.map((y) => fetchAnnual(y, noCache, now))]);

  // righe grezze per contratto e data; se file settimanale e archivio hanno la stessa settimana, devono coincidere
  const rawByKey = new Map<string, CotRow>();
  const conflicts = new Map<string, string[]>();
  const addRaw = (rows: CotRow[]) => {
    for (const r of rows) {
      const key = `${r.code}|${r.date}`;
      const prev = rawByKey.get(key);
      if (prev) {
        const diff = compareSources(prev, r);
        if (diff.length) conflicts.set(key, diff);
      } else rawByKey.set(key, r);
    }
  };
  const coveredYears = new Set<number>();

  if (weekly.status === "fulfilled") {
    const rows = parseRawCotFile(weekly.value, codes);
    addRaw(rows);
    sources.push({ id: "weekly", label: "File CFTC settimanale (deafut.txt)", url: WEEKLY_URL, ok: true, rows: rows.length });
  } else {
    sources.push({ id: "weekly", label: "File CFTC settimanale (deafut.txt)", url: WEEKLY_URL, ok: false, rows: 0, error: String(weekly.reason) });
  }

  annuals.forEach((a, i) => {
    const year = years[i];
    const base = { id: `annual-${year}` as const, label: `Archivio CFTC ${year}`, url: annualUrl(year) };
    if (a.status === "fulfilled") {
      const rows = parseRawCotFile(a.value, codes);
      addRaw(rows);
      coveredYears.add(year);
      sources.push({ ...base, ok: true, rows: rows.length });
    } else if (a.reason instanceof NotPublishedYet) {
      sources.push({ ...base, ok: true, rows: 0, note: "Non ancora pubblicato: le settimane di quest'anno si confrontano col file settimanale" });
    } else {
      sources.push({ ...base, ok: false, rows: 0, error: String(a.reason) });
    }
  });
  const rawRows = [...rawByKey.values()];

  const missing = configured.filter((m) => !apiRows.some((r) => r.code === m.code));
  const markets: MarketReport[] = configured.filter((m) => !missing.includes(m)).map((market) => {
    const history = apiRows
      .filter((r) => r.code === market.code)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-HISTORY_WEEKS);
    const raw = new Map(rawRows.filter((r) => r.code === market.code).map((r) => [r.date, r]));
    // Il controllo parte dalla prima settimana dello storico mostrato, non dall'archivio intero.
    const rawInWindow = new Map([...raw].filter(([d]) => d >= history[0].date));
    const marketConflicts = new Map(
      [...conflicts].filter(([k]) => k.startsWith(`${market.code}|`)).map(([k, v]) => [k.split("|")[1], v]),
    );
    return {
      market,
      exchangeName: history[history.length - 1].name,
      analytics: analyze(history),
      history: history.map((r) => ({ date: r.date, specNet: specNet(r), commNet: commNet(r), oi: r.oi })),
      verification: verifyMarket(history, rawInWindow, coveredYears, now, marketConflicts),
    };
  });

  const allWeeks = markets.flatMap((m) => m.verification.weeks);
  const statuses = markets.map((m) => m.verification.status);
  return {
    generatedAt: now.toISOString(),
    latestReport: markets.map((m) => m.analytics.date).sort().at(-1) ?? "",
    markets,
    sources,
    missing,
    status: statuses.includes("fail") || missing.length ? "fail" : statuses.includes("warn") || sources.some((s) => !s.ok) ? "warn" : "pass",
    summary: {
      weeksChecked: allWeeks.length,
      weeksFailed: allWeeks.filter((w) => w.status === "fail").length,
      crossChecked: allWeeks.filter((w) => w.source === "pass").length,
    },
  };
}
