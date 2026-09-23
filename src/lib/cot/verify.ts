import { NUMERIC_FIELDS, type CotRow, type NumericField } from "./parse";

// Verifica dei dati COT, settimana per settimana.
// Ogni controllo usa solo identità contabili della CFTC o il confronto tra fonti ufficiali:
// nessuna soglia arbitraria, un numero o torna o non torna.

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface WeekVerification {
  date: string;
  /** I campi "change" pubblicati coincidono con la differenza dalla settimana precedente. */
  continuity: CheckStatus;
  /** OI = reportable + non reportable, reportable = spec + spreading + commercial (long e short). */
  balance: CheckStatus;
  /** La settimana precedente è a 5..9 giorni (i festivi spostano la rilevazione di un giorno). */
  calendar: CheckStatus;
  /** Tutti i campi coincidono con il file grezzo CFTC della stessa data. */
  source: CheckStatus;
  issues: string[];
  status: CheckStatus;
}

export interface MarketVerification {
  weeks: WeekVerification[];
  freshness: { status: CheckStatus; latest: string; expected: string; message: string };
  /** Il file grezzo CFTC è più recente dell'API: l'API è in ritardo. */
  apiLag: { status: CheckStatus; message: string };
  counts: Record<CheckStatus, number>;
  status: CheckStatus;
}

const fmt = (n: number) => n.toLocaleString("it-IT");

const worst = (list: CheckStatus[]): CheckStatus =>
  list.includes("fail") ? "fail" : list.includes("warn") ? "warn" : list.every((s) => s === "skip") ? "skip" : "pass";

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const CONTINUITY_PAIRS: [NumericField, NumericField, string][] = [
  ["oi", "chgOi", "open interest"],
  ["ncLong", "chgNcLong", "long speculativi"],
  ["ncShort", "chgNcShort", "short speculativi"],
  ["ncSpread", "chgNcSpread", "spreading"],
  ["commLong", "chgCommLong", "long commercial"],
  ["commShort", "chgCommShort", "short commercial"],
  ["nrLong", "chgNrLong", "long non reportable"],
  ["nrShort", "chgNrShort", "short non reportable"],
];

export function checkContinuity(prev: CotRow, cur: CotRow): string[] {
  const issues: string[] = [];
  for (const [level, change, label] of CONTINUITY_PAIRS) {
    const diff = cur[level] - prev[level];
    if (diff !== cur[change]) {
      issues.push(`Variazione ${label}: pubblicata ${fmt(cur[change])}, calcolata ${fmt(diff)}`);
    }
  }
  return issues;
}

export function checkBalance(r: CotRow): string[] {
  const issues: string[] = [];
  if (r.totLong + r.nrLong !== r.oi) issues.push(`OI ${fmt(r.oi)} diverso da reportable+non reportable long ${fmt(r.totLong + r.nrLong)}`);
  if (r.totShort + r.nrShort !== r.oi) issues.push(`OI ${fmt(r.oi)} diverso da reportable+non reportable short ${fmt(r.totShort + r.nrShort)}`);
  if (r.ncLong + r.ncSpread + r.commLong !== r.totLong) issues.push("Reportable long diverso da speculativi+spreading+commercial");
  if (r.ncShort + r.ncSpread + r.commShort !== r.totShort) issues.push("Reportable short diverso da speculativi+spreading+commercial");
  for (const f of NUMERIC_FIELDS) {
    if (!f.startsWith("chg") && r[f] < 0) issues.push(`Posizione negativa nel campo ${f}`);
  }
  return issues;
}

export function compareSources(api: CotRow, raw: CotRow): string[] {
  return NUMERIC_FIELDS.filter((f) => api[f] !== raw[f]).map(
    (f) => `Campo ${f}: API ${fmt(api[f])}, file CFTC ${fmt(raw[f])}`,
  );
}

/**
 * Data dell'ultimo report che dovrebbe essere già pubblicato a `now`.
 * La CFTC pubblica il venerdì alle 15:30 ET i dati del martedì precedente.
 * Si usa 20:30 UTC (15:30 con ora solare), prudente anche con l'ora legale.
 */
export function expectedLatestReport(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0 domenica .. 5 venerdì
  let back = (dow - 5 + 7) % 7; // giorni dall'ultimo venerdì
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (back === 0 && minutes < 20 * 60 + 30) back = 7;
  d.setUTCDate(d.getUTCDate() - back - 3); // venerdì di pubblicazione -> martedì di rilevazione
  return d.toISOString().slice(0, 10);
}

/**
 * `history` in ordine cronologico crescente (API Socrata).
 * `raw` sono le righe dei file grezzi CFTC per lo stesso contratto, indicizzate per data.
 * `coveredYears` sono gli anni di cui l'archivio CFTC è stato scaricato: lì una settimana assente dal file
 * è un errore; negli altri anni il confronto non è possibile e vale "skip", non "pass".
 * `rawConflicts` sono le date in cui file settimanale e archivio annuale CFTC non coincidono tra loro.
 */
export function verifyMarket(
  history: CotRow[],
  raw: Map<string, CotRow>,
  coveredYears: ReadonlySet<number>,
  now: Date,
  rawConflicts: ReadonlyMap<string, string[]> = new Map(),
): MarketVerification {
  const weeks: WeekVerification[] = history.map((cur, i) => {
    const prev = i > 0 ? history[i - 1] : null;
    const issues: string[] = [];

    let continuity: CheckStatus = "skip";
    let calendar: CheckStatus = "skip";
    if (prev) {
      const c = checkContinuity(prev, cur);
      const gap = daysBetween(prev.date, cur.date);
      if (gap < 5 || gap > 9) {
        calendar = "fail";
        issues.push(`Settimana precedente a ${gap} giorni: report mancante o duplicato`);
        // senza la settimana giusta prima, la continuità non si può giudicare
        continuity = "skip";
      } else {
        calendar = "pass";
        continuity = c.length ? "fail" : "pass";
        issues.push(...c);
      }
    }

    const b = checkBalance(cur);
    const balance: CheckStatus = b.length ? "fail" : "pass";
    issues.push(...b);

    let source: CheckStatus = "skip";
    const rawRow = raw.get(cur.date);
    if (rawRow) {
      const s = compareSources(cur, rawRow);
      source = s.length ? "fail" : "pass";
      issues.push(...s);
    } else if (coveredYears.has(Number(cur.date.slice(0, 4)))) {
      source = "fail";
      issues.push("Settimana presente nell'API ma assente nel file ufficiale CFTC");
    }
    const conflict = rawConflicts.get(cur.date);
    if (conflict?.length) {
      source = "fail";
      issues.push(...conflict.map((c) => `File settimanale e archivio CFTC diversi: ${c}`));
    }

    return { date: cur.date, continuity, balance, calendar, source, issues, status: worst([continuity, balance, calendar, source]) };
  });

  const latest = history[history.length - 1]?.date ?? "";
  const expected = expectedLatestReport(now);
  const lagDays = latest ? daysBetween(latest, expected) : Infinity;
  const freshness =
    // tolleranza di 2 giorni: con i festivi la CFTC rileva di lunedì invece che di martedì
    lagDays <= 2
      ? { status: "pass" as const, message: "Dato allineato all'ultimo report pubblicato" }
      : lagDays <= 9
        ? { status: "warn" as const, message: `Ultimo report di ${lagDays} giorni prima dell'atteso: pubblicazione CFTC in ritardo o festivo` }
        : // "fail" è riservato ai numeri che non tornano: un report non pubblicato (es. shutdown) è un avviso
          { status: "warn" as const, message: `Nessun report CFTC da ${lagDays} giorni oltre l'atteso: pubblicazione sospesa o fonte ferma` };

  const newestRaw = [...raw.keys()].sort().at(-1);
  const apiLag =
    newestRaw && latest && newestRaw > latest
      ? { status: "warn" as const, message: `Il file CFTC ha già il report del ${newestRaw}, l'API no` }
      : { status: newestRaw ? ("pass" as const) : ("skip" as const), message: newestRaw ? "API e file CFTC sulla stessa settimana" : "File CFTC non disponibile" };

  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const w of weeks) counts[w.status]++;

  return {
    weeks,
    freshness: { ...freshness, latest, expected },
    apiLag,
    counts,
    // settimane senza confronto tra fonti: i numeri tornano ma la seconda fonte non li ha confermati
    status: worst([...weeks.map((w) => w.status), freshness.status, apiLag.status, weeks.some((w) => w.source === "skip") ? "warn" : "pass"]),
  };
}
