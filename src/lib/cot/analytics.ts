import type { CotRow } from "./parse";

// Tutte le metriche sono calcolate SOLO dai numeri pubblicati dalla CFTC.
// Convenzione: "speculatori" = Non-Commercial (fondi, CTA), "commercial" = hedger.

export interface CotAnalytics {
  date: string;
  openInterest: number;
  specLong: number;
  specShort: number;
  specNet: number;
  /** Variazione settimanale della net, dai campi "change" pubblicati. */
  specNetChange: number;
  /** Quota long degli speculatori sul totale long+short, 0..100. */
  specLongPct: number;
  /** Net speculativa in % dell'open interest. */
  specNetPctOi: number;
  commNet: number;
  commNetChange: number;
  /** Net speculativa su 4 settimane (null se lo storico non basta). */
  specNetChange4w: number | null;
  /** COT Index 0..100 sulla net speculativa (null se lo storico non basta). */
  cotIndex26: number | null;
  cotIndex52: number | null;
  cotIndex156: number | null;
  commIndex52: number | null;
  positioning: Positioning;
}

export type Positioning = "long estremo" | "long" | "neutrale" | "short" | "short estremo" | "storico insufficiente";

export const specNet = (r: CotRow) => r.ncLong - r.ncShort;
export const commNet = (r: CotRow) => r.commLong - r.commShort;

/**
 * COT Index (metodo Briese): posizione della net attuale nel range min/max
 * delle ultime `weeks` settimane, estremi inclusi. 100 = massimo del periodo.
 * `series` è ordinata dalla settimana più vecchia alla più recente.
 */
export function cotIndex(series: number[], weeks: number): number | null {
  if (series.length < weeks) return null;
  const window = series.slice(-weeks);
  const current = window[window.length - 1];
  const min = Math.min(...window);
  const max = Math.max(...window);
  if (max === min) return 50;
  return ((current - min) / (max - min)) * 100;
}

export function classifyPositioning(index52: number | null): Positioning {
  if (index52 === null) return "storico insufficiente";
  if (index52 >= 80) return "long estremo";
  if (index52 >= 60) return "long";
  if (index52 > 40) return "neutrale";
  if (index52 > 20) return "short";
  return "short estremo";
}

/** `history` in ordine cronologico crescente, l'ultimo elemento è la settimana analizzata. */
export function analyze(history: CotRow[]): CotAnalytics {
  if (history.length === 0) throw new Error("Storico COT vuoto");
  const last = history[history.length - 1];
  const nets = history.map(specNet);
  const comms = history.map(commNet);
  const net = nets[nets.length - 1];
  const totalSpec = last.ncLong + last.ncShort;
  const idx52 = cotIndex(nets, 52);
  return {
    date: last.date,
    openInterest: last.oi,
    specLong: last.ncLong,
    specShort: last.ncShort,
    specNet: net,
    specNetChange: last.chgNcLong - last.chgNcShort,
    specLongPct: totalSpec === 0 ? 50 : (last.ncLong / totalSpec) * 100,
    specNetPctOi: last.oi === 0 ? 0 : (net / last.oi) * 100,
    commNet: comms[comms.length - 1],
    commNetChange: last.chgCommLong - last.chgCommShort,
    specNetChange4w: nets.length > 4 ? net - nets[nets.length - 5] : null,
    cotIndex26: cotIndex(nets, 26),
    cotIndex52: idx52,
    cotIndex156: cotIndex(nets, 156),
    commIndex52: cotIndex(comms, 52),
    positioning: classifyPositioning(idx52),
  };
}
