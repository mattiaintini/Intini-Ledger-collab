import { CURRENCIES, DIRECTIONS, GRADES, OUTCOMES, SESSIONS, TRADE_TYPES, type Journal, type Trade } from "./types";

// Controllo strutturale di un backup JSON prima di sostituire il journal.
// Il file o è valido per intero o non viene caricato: niente import parziali silenziosi.

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isOpt = (v: unknown) => v === undefined || isNum(v);
const isIn = <T extends string>(v: unknown, list: readonly T[]) => list.includes(v as T);

export function parseBackup(text: string): { journal: Journal } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Il file non è un JSON valido" };
  }
  const j = data as Partial<Journal>;
  if (!j || j.version !== 9) return { error: "Non è un backup della Journal Suite v9" };
  const p = j.profile;
  if (!p || !isNum(p.capital) || p.capital <= 0 || !isIn(p.currency, CURRENCIES) || !isNum(p.maxDailyLossPct) || typeof p.name !== "string") {
    return { error: "Profilo del backup non valido" };
  }
  if (!Array.isArray(j.trades)) return { error: "Elenco dei trade mancante" };
  const ids = new Set<string>();
  for (const [i, t] of (j.trades as Trade[]).entries()) {
    const ok =
      t && typeof t.id === "string" && !ids.has(t.id) &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.date) && typeof t.time === "string" && typeof t.asset === "string" &&
      isIn(t.session, SESSIONS) && isIn(t.type, TRADE_TYPES) && isIn(t.direction, DIRECTIONS) &&
      isIn(t.grade, GRADES) && isIn(t.outcome, OUTCOMES) &&
      isNum(t.lots) && isNum(t.riskPct) && isNum(t.rr) && isNum(t.pnl) && isNum(t.createdAt) &&
      typeof t.notes === "string" && isOpt(t.maeR) && isOpt(t.mfeR) && isOpt(t.durationMin) &&
      (t.image === undefined || (typeof t.image === "string" && t.image.startsWith("data:image/")));
    if (!ok) return { error: `Trade ${i + 1} del backup non valido o duplicato` };
    ids.add(t.id);
  }
  return { journal: { version: 9, profile: { name: p.name, capital: p.capital, currency: p.currency, maxDailyLossPct: p.maxDailyLossPct }, trades: j.trades as Trade[] } };
}
