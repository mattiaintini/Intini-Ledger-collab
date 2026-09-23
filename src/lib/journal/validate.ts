import { enrich } from "./stats";
import { DIRECTIONS, GRADES, OUTCOMES, SESSIONS, TRADE_TYPES, type Journal, type Trade } from "./types";

// Verifica dei dati del journal.
// Errore = il dato è impossibile o incoerente, il trade non si salva.
// Avviso = il dato è possibile ma sospetto (slippage, chiusura parziale, doppio inserimento).

export type TradeInput = Omit<Trade, "id" | "createdAt">;

export interface Validation {
  errors: Partial<Record<keyof TradeInput | "form", string>>;
  warnings: string[];
}

export const todayISO = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

const eur = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Tolleranza oltre la quale il P&L si discosta dal piano (capitale x rischio x RR). */
export const PLAN_TOLERANCE = 0.25;

/** P&L atteso dal piano: +rischio x RR a target, -rischio allo stop, 0 a break even. */
export function plannedPnl(outcome: Trade["outcome"], riskAmount: number, rr: number): number {
  if (outcome === "TP") return riskAmount * rr;
  if (outcome === "SL") return -riskAmount;
  return 0;
}

export function validateTrade(
  t: TradeInput,
  ctx: { equityBefore: number; maxDailyLossPct: number; dayPnlBefore: number; others: Trade[]; today?: string },
): Validation {
  const errors: Validation["errors"] = {};
  const warnings: string[] = [];
  const today = ctx.today ?? todayISO();

  if (!isDate(t.date)) errors.date = "Data non valida";
  else if (t.date > today) errors.date = "Data nel futuro";
  if (t.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) errors.time = "Orario non valido";
  if (!/^[A-Z0-9.!/_-]{2,15}$/.test(t.asset)) errors.asset = "Simbolo da 2 a 15 caratteri (lettere, numeri, . / _ -)";
  if (!SESSIONS.includes(t.session)) errors.session = "Sessione non valida";
  if (!TRADE_TYPES.includes(t.type)) errors.type = "Tipo non valido";
  if (!DIRECTIONS.includes(t.direction)) errors.direction = "Direzione non valida";
  if (!GRADES.includes(t.grade)) errors.grade = "Grado non valido";
  if (!OUTCOMES.includes(t.outcome)) errors.outcome = "Esito non valido";
  if (!Number.isFinite(t.lots) || t.lots <= 0) errors.lots = "Lotti maggiori di zero";
  if (!Number.isFinite(t.riskPct) || t.riskPct <= 0 || t.riskPct > 100) errors.riskPct = "Rischio tra 0 e 100%";
  if (!Number.isFinite(t.rr) || t.rr < 0 || t.rr > 100) errors.rr = "RR tra 0 e 100";
  if (!Number.isFinite(t.pnl)) errors.pnl = "P&L non valido";
  if (t.maeR !== undefined && (!Number.isFinite(t.maeR) || t.maeR > 0)) errors.maeR = "MAE in R, zero o negativo";
  if (t.mfeR !== undefined && (!Number.isFinite(t.mfeR) || t.mfeR < 0)) errors.mfeR = "MFE in R, zero o positivo";
  if (t.durationMin !== undefined && (!Number.isFinite(t.durationMin) || t.durationMin < 0)) errors.durationMin = "Durata non valida";

  // Coerenza esito / risultato: un target chiuso in perdita è un errore di inserimento.
  if (!errors.pnl && !errors.outcome) {
    if (t.outcome === "TP" && t.pnl <= 0) errors.pnl = "Take profit con P&L non positivo";
    if (t.outcome === "SL" && t.pnl >= 0) errors.pnl = "Stop loss con P&L non negativo";
  }

  if (Object.keys(errors).length === 0) {
    const riskAmount = (ctx.equityBefore * t.riskPct) / 100;
    const plan = plannedPnl(t.outcome, riskAmount, t.rr);
    if (t.outcome === "BE") {
      if (Math.abs(t.pnl) > riskAmount * PLAN_TOLERANCE) {
        warnings.push(`Break even con P&L ${eur(t.pnl)}, oltre il ${PLAN_TOLERANCE * 100}% del rischio: controlla l'esito`);
      }
    } else if (Math.abs(t.pnl - plan) > Math.abs(plan) * PLAN_TOLERANCE) {
      warnings.push(`P&L ${eur(t.pnl)} lontano dal piano ${eur(plan)} (capitale x ${t.riskPct}% x ${t.outcome === "TP" ? `RR ${t.rr}` : "1R"}): slippage, parziale o dato errato`);
    }
    if (t.riskPct > ctx.maxDailyLossPct) warnings.push(`Rischio ${t.riskPct}% oltre il limite giornaliero di ${ctx.maxDailyLossPct}%`);
    const dayAfter = ctx.dayPnlBefore + t.pnl;
    // il limite si misura sul capitale di inizio giornata
    const limit = (-(ctx.equityBefore - ctx.dayPnlBefore) * ctx.maxDailyLossPct) / 100;
    if (dayAfter < limit) warnings.push(`Con questo trade la perdita del giorno supera il limite del ${ctx.maxDailyLossPct}%`);
    if (t.outcome === "TP" && t.mfeR !== undefined && t.mfeR < t.rr) warnings.push("MFE inferiore all'RR chiuso a target");
    const dup = ctx.others.find(
      (o) => o.date === t.date && o.time === t.time && o.asset === t.asset && o.direction === t.direction && o.pnl === t.pnl,
    );
    if (dup) warnings.push("Esiste già un trade identico: possibile doppio inserimento");
  }

  return { errors, warnings };
}

/** Contesto di validazione per un trade nuovo, calcolato dal journal esistente. */
export function contextFor(journal: Journal, t: Pick<Trade, "date" | "time">, excludeId?: string) {
  const others = journal.trades.filter((o) => o.id !== excludeId);
  const before = others.filter((o) => o.date < t.date || (o.date === t.date && (o.time || "") <= (t.time || "")));
  const equityBefore = journal.profile.capital + before.reduce((a, o) => a + o.pnl, 0);
  const dayPnlBefore = before.filter((o) => o.date === t.date).reduce((a, o) => a + o.pnl, 0);
  return { equityBefore, dayPnlBefore, others, maxDailyLossPct: journal.profile.maxDailyLossPct };
}

export interface AuditIssue {
  tradeId: string;
  date: string;
  asset: string;
  level: "error" | "warning";
  message: string;
}

/** Ricontrolla l'intero journal con le stesse regole dell'inserimento. */
export function auditJournal(journal: Journal, today?: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const list = enrich(journal.trades, journal.profile.capital);
  const dayRunning = new Map<string, number>();
  const seen: Trade[] = [];
  for (const t of list) {
    const v = validateTrade(t, {
      equityBefore: t.equityBefore,
      maxDailyLossPct: journal.profile.maxDailyLossPct,
      dayPnlBefore: dayRunning.get(t.date) ?? 0,
      others: seen,
      today,
    });
    for (const msg of Object.values(v.errors)) issues.push({ tradeId: t.id, date: t.date, asset: t.asset, level: "error", message: msg! });
    for (const msg of v.warnings) issues.push({ tradeId: t.id, date: t.date, asset: t.asset, level: "warning", message: msg });
    dayRunning.set(t.date, (dayRunning.get(t.date) ?? 0) + t.pnl);
    seen.push(t);
  }
  return issues;
}
