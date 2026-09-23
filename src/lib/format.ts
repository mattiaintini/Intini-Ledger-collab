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
