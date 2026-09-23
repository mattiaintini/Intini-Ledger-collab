import type { Currency } from "./journal/types";

const ISO: Record<Currency, string> = { "€": "EUR", $: "USD", "£": "GBP" };

export function money(n: number | null | undefined, currency: Currency, opts: { sign?: boolean } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/d";
  const s = new Intl.NumberFormat("it-IT", { style: "currency", currency: ISO[currency], minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function num(n: number | null | undefined, digits = 0, opts: { sign?: boolean } = {}) {
  if (n === null || n === undefined) return "n/d";
  if (n === Infinity) return "∞";
  if (!Number.isFinite(n)) return "n/d";
  const s = n.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function pct(n: number | null | undefined, digits = 1, opts: { sign?: boolean } = {}) {
  const s = num(n, digits, opts);
  return s === "n/d" ? s : `${s}%`;
}

export function dateIT(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!iso) return "n/d";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("it-IT", { ...opts, timeZone: "UTC" });
}

export const tone = (n: number | null | undefined) =>
  n === null || n === undefined || n === 0 || !Number.isFinite(n) ? "text-fg" : n > 0 ? "text-pos" : "text-neg";

/**
 * Numero scritto a mano, in formato italiano o inglese: "1.234,56", "1234,56", "1234.56", "-0,5".
 * Con entrambi i separatori l'ultimo e' il decimale. Con un solo punto e' un decimale (0.5 lotti),
 * con piu' punti sono migliaia. Con `money` un solo punto seguito da 3 cifre e' un separatore delle migliaia
 * ("10.000" = 10000), come si scrivono gli importi in italiano. Stringa vuota o non numerica = NaN.
 */
export function parseNum(input: string, opts: { money?: boolean } = {}): number {
  const s = input.trim().replace(/\s/g, "");
  if (!/^[+-]?[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    const [int, dec, ...rest] = s.split(decimal);
    if (rest.length) return NaN;
    if (!/^[+-]?\d{1,3}([.,]\d{3})*$/.test(int) || int.includes(decimal)) return NaN;
    normalized = `${int.split(thousands).join("")}.${dec}`;
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    if (parts.length > 2) return NaN;
    normalized = parts.join(".");
  } else {
    const parts = s.split(".");
    // Importi scritti all'italiana: "10.000" sono diecimila, non dieci. Lotti e percentuali restano decimali.
    const italianThousands = opts.money && parts.length === 2 && /^[+-]?[1-9]\d{0,2}$/.test(parts[0]) && /^\d{3}$/.test(parts[1]);
    normalized = parts.length > 2 || italianThousands ? parts.join("") : s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Valore per un campo di input, con la virgola decimale. */
export const inputNum = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits).replace(".", ",") : "");
