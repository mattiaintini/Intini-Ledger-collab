import type { Trade } from "./types";

// Statistiche calcolate solo dai trade registrati. Nessun valore stimato o simulato:
// se un dato manca (MAE, MFE, durata) la metrica usa solo i trade che lo hanno e lo dichiara.

export const tradeOrder = (a: Trade, b: Trade) =>
  a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "") || a.createdAt - b.createdAt;

export const sortTrades = (trades: Trade[]) => [...trades].sort(tradeOrder);

export interface EnrichedTrade extends Trade {
  equityBefore: number;
  equityAfter: number;
  /** Rischio pianificato in valuta: capitale prima del trade x rischio %. */
  riskAmount: number;
  /** Risultato in multipli di R, null se il rischio non è registrato. */
  r: number | null;
}

export function enrich(trades: Trade[], capital: number): EnrichedTrade[] {
  let equity = capital;
  return sortTrades(trades).map((t) => {
    const equityBefore = equity;
    equity += t.pnl;
    const riskAmount = (equityBefore * t.riskPct) / 100;
    return { ...t, equityBefore, equityAfter: equity, riskAmount, r: riskAmount > 0 ? t.pnl / riskAmount : null };
  });
}

export interface Breakdown {
  key: string;
  trades: number;
  net: number;
  winRate: number | null;
}

export interface Stats {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  net: number;
  equity: number;
  returnPct: number;
  /** Vinti / (vinti + persi). I break even sono esclusi. */
  winRate: number | null;
  grossProfit: number;
  grossLoss: number;
  /** Profitto lordo / perdita lorda. Infinity se non ci sono perdite. */
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoff: number | null;
  expectancy: number | null;
  avgR: number | null;
  tradesWithR: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxWinStreak: number;
  maxLossStreak: number;
  bestTrade: number | null;
  worstTrade: number | null;
  curve: { index: number; date: string; equity: number }[];
  daily: Map<string, { pnl: number; trades: number }>;
  bySession: Breakdown[];
  byAsset: Breakdown[];
  byType: Breakdown[];
  byGrade: Breakdown[];
  byDirection: Breakdown[];
  byWeekday: Breakdown[];
  excursion: { avgMaeR: number | null; avgMfeR: number | null; avgDurationMin: number | null; withMae: number; withMfe: number; withDuration: number };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function breakdown(trades: Trade[], keyOf: (t: Trade) => string, order?: string[]): Breakdown[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyOf(t);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const rows = [...groups].map(([key, ts]) => {
    const w = ts.filter((t) => t.pnl > 0).length;
    const l = ts.filter((t) => t.pnl < 0).length;
    return { key, trades: ts.length, net: ts.reduce((a, t) => a + t.pnl, 0), winRate: w + l ? (w / (w + l)) * 100 : null };
  });
  return order ? rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : rows.sort((a, b) => b.net - a.net);
}

export function computeStats(trades: Trade[], capital: number): Stats {
  const list = enrich(trades, capital);
  const wins = list.filter((t) => t.pnl > 0);
  const losses = list.filter((t) => t.pnl < 0);
  const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = losses.reduce((a, t) => a + t.pnl, 0);
  const net = grossProfit + grossLoss;

  let peak = capital;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  const daily = new Map<string, { pnl: number; trades: number }>();
  const curve = [{ index: 0, date: list[0]?.date ?? "", equity: capital }];

  list.forEach((t, i) => {
    peak = Math.max(peak, t.equityAfter);
    const dd = peak - t.equityAfter;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
    if (t.pnl > 0) {
      winStreak++;
      lossStreak = 0;
    } else if (t.pnl < 0) {
      lossStreak++;
      winStreak = 0;
    }
    // un break even non interrompe né allunga la serie
    maxWinStreak = Math.max(maxWinStreak, winStreak);
    maxLossStreak = Math.max(maxLossStreak, lossStreak);
    const d = daily.get(t.date) ?? { pnl: 0, trades: 0 };
    daily.set(t.date, { pnl: d.pnl + t.pnl, trades: d.trades + 1 });
    curve.push({ index: i + 1, date: t.date, equity: t.equityAfter });
  });

  const decided = wins.length + losses.length;
  const avgWin = avg(wins.map((t) => t.pnl));
  const avgLoss = avg(losses.map((t) => t.pnl));
  const rs = list.map((t) => t.r).filter((r): r is number => r !== null);
  const mae = list.map((t) => t.maeR).filter((x): x is number => x !== undefined);
  const mfe = list.map((t) => t.mfeR).filter((x): x is number => x !== undefined);
  const dur = list.map((t) => t.durationMin).filter((x): x is number => x !== undefined);

  return {
    trades: list.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: list.length - decided,
    net,
    equity: capital + net,
    returnPct: capital > 0 ? (net / capital) * 100 : 0,
    winRate: decided ? (wins.length / decided) * 100 : null,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : grossProfit > 0 ? Infinity : null,
    avgWin,
    avgLoss,
    payoff: avgWin !== null && avgLoss !== null ? avgWin / -avgLoss : null,
    expectancy: list.length ? net / list.length : null,
    avgR: avg(rs),
    tradesWithR: rs.length,
    maxDrawdown,
    maxDrawdownPct,
    maxWinStreak,
    maxLossStreak,
    bestTrade: list.length ? Math.max(...list.map((t) => t.pnl)) : null,
    worstTrade: list.length ? Math.min(...list.map((t) => t.pnl)) : null,
    curve,
    daily,
    bySession: breakdown(list, (t) => t.session, ["ASIA", "LDN", "NY"]),
    byAsset: breakdown(list, (t) => t.asset),
    byType: breakdown(list, (t) => t.type, ["SCALP", "INTRA", "SWING"]),
    byGrade: breakdown(list, (t) => t.grade, ["A", "B", "C"]),
    byDirection: breakdown(list, (t) => t.direction, ["LONG", "SHORT"]),
    byWeekday: breakdown(list, (t) => WEEKDAYS[new Date(`${t.date}T12:00:00Z`).getUTCDay()], WEEKDAYS.slice(1).concat(WEEKDAYS[0])),
    excursion: { avgMaeR: avg(mae), avgMfeR: avg(mfe), avgDurationMin: avg(dur), withMae: mae.length, withMfe: mfe.length, withDuration: dur.length },
  };
}
