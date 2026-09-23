// Normalizzazione delle due fonti ufficiali CFTC nello stesso record.
// 1) API Socrata  publicreporting.cftc.gov, dataset 6dca-aqww (Legacy, Futures Only)
// 2) File grezzi  www.cftc.gov/dea/newcot/deafut.txt (settimana corrente)
//                 www.cftc.gov/files/dea/history/deacot{YYYY}.zip (storico annuale)

export interface CotRow {
  code: string;
  name: string;
  date: string; // YYYY-MM-DD, martedì di rilevazione
  oi: number;
  ncLong: number;
  ncShort: number;
  ncSpread: number;
  commLong: number;
  commShort: number;
  totLong: number;
  totShort: number;
  nrLong: number;
  nrShort: number;
  chgOi: number;
  chgNcLong: number;
  chgNcShort: number;
  chgNcSpread: number;
  chgCommLong: number;
  chgCommShort: number;
  chgNrLong: number;
  chgNrShort: number;
}

/** Campi numerici confrontati tra le fonti. */
export const NUMERIC_FIELDS = [
  "oi",
  "ncLong",
  "ncShort",
  "ncSpread",
  "commLong",
  "commShort",
  "totLong",
  "totShort",
  "nrLong",
  "nrShort",
  "chgOi",
  "chgNcLong",
  "chgNcShort",
  "chgNcSpread",
  "chgCommLong",
  "chgCommShort",
  "chgNrLong",
  "chgNrShort",
] as const satisfies readonly (keyof CotRow)[];

export type NumericField = (typeof NUMERIC_FIELDS)[number];

export class CotFormatError extends Error {}

function int(value: unknown, field: string): number {
  const s = String(value ?? "").trim();
  if (s === "" || s === ".") return 0; // la CFTC usa "." per "nessun dato" nelle colonne vuote
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new CotFormatError(`Valore non intero nel campo ${field}: "${s}"`);
  }
  return n;
}

// Nomi dei campi nell'API Socrata (inclusi i refusi originali del dataset CFTC).
export const SOCRATA_FIELDS: Record<NumericField, string> = {
  oi: "open_interest_all",
  ncLong: "noncomm_positions_long_all",
  ncShort: "noncomm_positions_short_all",
  ncSpread: "noncomm_postions_spread_all",
  commLong: "comm_positions_long_all",
  commShort: "comm_positions_short_all",
  totLong: "tot_rept_positions_long_all",
  totShort: "tot_rept_positions_short",
  nrLong: "nonrept_positions_long_all",
  nrShort: "nonrept_positions_short_all",
  chgOi: "change_in_open_interest_all",
  chgNcLong: "change_in_noncomm_long_all",
  chgNcShort: "change_in_noncomm_short_all",
  chgNcSpread: "change_in_noncomm_spead_all",
  chgCommLong: "change_in_comm_long_all",
  chgCommShort: "change_in_comm_short_all",
  chgNrLong: "change_in_nonrept_long_all",
  chgNrShort: "change_in_nonrept_short_all",
};

export function parseSocrataRow(r: Record<string, unknown>): CotRow {
  const date = String(r.report_date_as_yyyy_mm_dd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CotFormatError(`Data non valida: ${date}`);
  const row = {
    code: String(r.cftc_contract_market_code ?? "").trim(),
    name: String(r.market_and_exchange_names ?? "").trim(),
    date,
  } as CotRow;
  for (const f of NUMERIC_FIELDS) {
    if (!(SOCRATA_FIELDS[f] in r)) throw new CotFormatError(`Campo mancante nell'API: ${SOCRATA_FIELDS[f]}`);
    row[f] = int(r[SOCRATA_FIELDS[f]], SOCRATA_FIELDS[f]);
  }
  return row;
}

// Posizioni delle colonne nei file grezzi (formato "Legacy, comma delimited").
// Verificate contro l'intestazione del file annuale: vedi EXPECTED_HEADER.
const RAW_COLUMNS: Record<NumericField, number> = {
  oi: 7,
  ncLong: 8,
  ncShort: 9,
  ncSpread: 10,
  commLong: 11,
  commShort: 12,
  totLong: 13,
  totShort: 14,
  nrLong: 15,
  nrShort: 16,
  chgOi: 37,
  chgNcLong: 38,
  chgNcShort: 39,
  chgNcSpread: 40,
  chgCommLong: 41,
  chgCommShort: 42,
  chgNrLong: 45,
  chgNrShort: 46,
};

const EXPECTED_HEADER: Record<number, string> = {
  2: "As of Date in Form YYYY-MM-DD",
  3: "CFTC Contract Market Code",
  7: "Open Interest (All)",
  8: "Noncommercial Positions-Long (All)",
  9: "Noncommercial Positions-Short (All)",
  37: "Change in Open Interest (All)",
  38: "Change in Noncommercial-Long (All)",
  39: "Change in Noncommercial-Short (All)",
  45: "Change in Nonreportable-Long (All)",
  46: "Change in Nonreportable-Short (All)",
};

/** Parser CSV minimale conforme al formato CFTC (campi tra virgolette, virgole nei nomi). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Legge un file grezzo CFTC e restituisce le righe dei soli contratti richiesti.
 * Se la prima riga è un'intestazione ne controlla le colonne: se la CFTC cambia il
 * formato il parser si ferma invece di leggere numeri sbagliati.
 */
export function parseRawCotFile(text: string, codes: Set<string>): CotRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new CotFormatError("File CFTC vuoto");
  let start = 0;
  const first = parseCsvLine(lines[0]);
  if (first[0]?.trim() === "Market and Exchange Names") {
    for (const [idx, name] of Object.entries(EXPECTED_HEADER)) {
      if (first[Number(idx)]?.trim() !== name) {
        throw new CotFormatError(
          `Formato file CFTC cambiato: colonna ${idx} = "${first[Number(idx)]}", atteso "${name}"`,
        );
      }
    }
    start = 1;
  }
  const rows: CotRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const code = cols[3]?.trim();
    if (!code || !codes.has(code)) continue;
    if (cols.length < 47) throw new CotFormatError(`Riga CFTC troncata per ${code}: ${cols.length} colonne`);
    const row = { code, name: cols[0].trim(), date: cols[2].trim() } as CotRow;
    for (const f of NUMERIC_FIELDS) row[f] = int(cols[RAW_COLUMNS[f]], f);
    rows.push(row);
  }
  return rows;
}
