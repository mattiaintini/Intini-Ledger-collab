import { describe, expect, it } from "vitest";
import { computeStats, enrich } from "./stats";
import { auditJournal, contextFor, validateTrade, type TradeInput } from "./validate";
import { listLegacyUsers, migrateLegacy } from "./migrate";
import type { Journal, Trade } from "./types";
import { monteCarlo } from "../montecarlo";
import { parseBackup } from "./backup";

const base: Omit<Trade, "id" | "date" | "pnl" | "outcome" | "createdAt"> = {
  time: "10:00",
  asset: "EURUSD",
  session: "LDN",
  type: "INTRA",
  direction: "LONG",
  lots: 1,
  riskPct: 1,
  rr: 2,
  grade: "A",
  notes: "",
};

let seq = 0;
const tr = (date: string, pnl: number, extra: Partial<Trade> = {}): Trade => ({
  ...base,
  id: String(++seq),
  date,
  pnl,
  outcome: pnl > 0 ? "TP" : pnl < 0 ? "SL" : "BE",
  createdAt: seq,
  ...extra,
});

// Capitale 10.000. Sequenza: +200, -100, +200, 0, -100, -100  => net +100
const trades = [
  tr("2026-09-01", 200),
  tr("2026-09-02", -100),
  tr("2026-09-02", 200, { time: "15:00" }),
  tr("2026-09-03", 0),
  tr("2026-09-04", -100),
  tr("2026-09-07", -100, { session: "NY" }),
];

describe("statistiche", () => {
  const s = computeStats(trades, 10_000);

  it("totali e win rate senza break even", () => {
    expect(s.trades).toBe(6);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(3);
    expect(s.breakeven).toBe(1);
    expect(s.net).toBe(100);
    expect(s.equity).toBe(10_100);
    expect(s.winRate).toBeCloseTo(40, 10); // 2 / (2 + 3)
  });

  it("profit factor, medie, payoff, expectancy", () => {
    expect(s.profitFactor).toBeCloseTo(400 / 300, 10);
    expect(s.avgWin).toBe(200);
    expect(s.avgLoss).toBe(-100);
    expect(s.payoff).toBe(2);
    expect(s.expectancy).toBeCloseTo(100 / 6, 10);
  });

  it("drawdown massimo dal picco (10.300 -> 10.100)", () => {
    expect(s.maxDrawdown).toBe(200);
    expect(s.maxDrawdownPct).toBeCloseTo((200 / 10_300) * 100, 10);
  });

  it("serie: il break even non interrompe la serie di perdite", () => {
    expect(s.maxWinStreak).toBe(1);
    expect(s.maxLossStreak).toBe(2);
  });

  it("R multiple sul capitale prima del trade", () => {
    const e = enrich(trades, 10_000);
    expect(e[0].riskAmount).toBe(100);
    expect(e[0].r).toBe(2);
    expect(e[1].equityBefore).toBe(10_200);
    expect(e[1].r).toBeCloseTo(-100 / 102, 10);
  });

  it("P&L giornaliero e ripartizioni", () => {
    expect(s.daily.get("2026-09-02")).toEqual({ pnl: 100, trades: 2 });
    expect(s.bySession.find((b) => b.key === "NY")).toEqual({ key: "NY", trades: 1, net: -100, winRate: 0 });
    expect(s.curve.at(-1)!.equity).toBe(10_100);
  });

  it("nessuna perdita = profit factor infinito, nessun trade = valori nulli", () => {
    expect(computeStats([tr("2026-09-01", 50)], 1000).profitFactor).toBe(Infinity);
    const empty = computeStats([], 1000);
    expect(empty.winRate).toBeNull();
    expect(empty.profitFactor).toBeNull();
    expect(empty.expectancy).toBeNull();
  });

  it("MAE e MFE solo dai trade che li hanno, mai stimati", () => {
    const st = computeStats([tr("2026-09-01", 200, { maeR: -0.4, mfeR: 2.5 }), tr("2026-09-02", -100)], 10_000);
    expect(st.excursion.withMae).toBe(1);
    expect(st.excursion.avgMaeR).toBe(-0.4);
    expect(st.excursion.avgMfeR).toBe(2.5);
    expect(st.excursion.avgDurationMin).toBeNull();
  });
});

describe("validazione trade", () => {
  const ctx = { equityBefore: 10_000, maxDailyLossPct: 2, dayPnlBefore: 0, others: [] as Trade[], today: "2026-09-23" };
  const input = (p: Partial<TradeInput>): TradeInput => ({ ...base, date: "2026-09-22", outcome: "TP", pnl: 200, ...p });

  it("trade coerente col piano: nessun errore né avviso", () => {
    expect(validateTrade(input({}), ctx)).toEqual({ errors: {}, warnings: [] });
  });

  it("errori bloccanti", () => {
    expect(validateTrade(input({ date: "2026-09-24" }), ctx).errors.date).toBe("Data nel futuro");
    expect(validateTrade(input({ date: "2026-02-30" }), ctx).errors.date).toBe("Data non valida");
    expect(validateTrade(input({ pnl: -50 }), ctx).errors.pnl).toMatch(/Take profit/);
    expect(validateTrade(input({ outcome: "SL", pnl: 10 }), ctx).errors.pnl).toMatch(/Stop loss/);
    expect(validateTrade(input({ lots: 0 }), ctx).errors.lots).toBeDefined();
    expect(validateTrade(input({ riskPct: 0 }), ctx).errors.riskPct).toBeDefined();
    expect(validateTrade(input({ asset: "E" }), ctx).errors.asset).toBeDefined();
    expect(validateTrade(input({ time: "25:00" }), ctx).errors.time).toBeDefined();
    expect(validateTrade(input({ maeR: 0.5 }), ctx).errors.maeR).toBeDefined();
  });

  it("avviso se il P&L si allontana di oltre il 25% dal piano", () => {
    expect(validateTrade(input({ pnl: 160 }), ctx).warnings).toEqual([]); // -20%
    expect(validateTrade(input({ pnl: 140 }), ctx).warnings[0]).toMatch(/P&L 140,00 lontano dal piano 200,00/);
  });

  it("avvisi su rischio, limite giornaliero e doppioni", () => {
    expect(validateTrade(input({ riskPct: 3, pnl: 600 }), ctx).warnings.join()).toMatch(/oltre il limite giornaliero/);
    const w = validateTrade(input({ outcome: "SL", pnl: -100 }), { ...ctx, dayPnlBefore: -150 }).warnings.join();
    expect(w).toMatch(/perdita del giorno supera il limite/);
    const dup = tr("2026-09-22", 200);
    expect(validateTrade(input({}), { ...ctx, others: [dup] }).warnings.join()).toMatch(/doppio inserimento/);
  });

  it("contesto: capitale e P&L del giorno prima del trade", () => {
    const journal: Journal = { version: 9, profile: { name: "", capital: 10_000, currency: "€", maxDailyLossPct: 2 }, trades };
    const c = contextFor(journal, { date: "2026-09-02", time: "12:00" });
    expect(c.equityBefore).toBe(10_100); // +200 il 1/9, -100 alle 10:00 del 2/9
    expect(c.dayPnlBefore).toBe(-100);
  });

  it("audit: trova un take profit registrato in perdita", () => {
    const journal: Journal = {
      version: 9,
      profile: { name: "", capital: 10_000, currency: "€", maxDailyLossPct: 2 },
      trades: [...trades, tr("2026-09-08", -50, { outcome: "TP" })],
    };
    const issues = auditJournal(journal, "2026-09-23");
    expect(issues.filter((i) => i.level === "error")).toHaveLength(1);
    expect(issues.find((i) => i.level === "error")!.message).toMatch(/Take profit/);
  });
});

describe("migrazione dati v8", () => {
  const legacy = JSON.stringify({
    mattia: {
      pass: "Segreta!1",
      capital: 5000,
      currency: "$",
      maxLossPct: 1.5,
      trades: [
        { id: 1, date: "2026-03-01", time: "09:30", asset: "xauusd", session: "NY", type: "SCALP", direction: "SHORT", lots: "0.5", risk: "1", rr: "3", grade: "A", outcome: "TP", pnl: 150, notes: "ok", image: null },
        { id: 2, date: "2026-03-02", time: "", asset: "EURUSD", session: "LDN", type: "INTRA", direction: "LONG", lots: 0, risk: "", rr: "", grade: "B", outcome: "", pnl: -40, notes: "" },
        { id: 3, date: "", pnl: 10 },
        { id: 4, date: "2026-03-03", pnl: "abc" },
      ],
    },
  });

  it("elenca gli utenti v8", () => {
    expect(listLegacyUsers(legacy)).toEqual(["mattia"]);
    expect(listLegacyUsers("non json")).toEqual([]);
  });

  it("converte i campi e non importa la password", () => {
    const { journal, report } = migrateLegacy(legacy, "mattia", "2026-09-23");
    expect(journal.profile).toEqual({ name: "mattia", capital: 5000, currency: "$", maxDailyLossPct: 1.5 });
    expect(JSON.stringify(journal)).not.toContain("Segreta");
    expect(journal.trades[0]).toMatchObject({ asset: "XAUUSD", lots: 0.5, riskPct: 1, rr: 3, direction: "SHORT" });
    expect(report.imported).toBe(2);
  });

  it("dichiara ogni scarto e correzione", () => {
    const { journal, report } = migrateLegacy(legacy, "mattia", "2026-09-23");
    expect(report.rejected.map((r) => r.index)).toEqual([2, 3]);
    expect(journal.trades[1].outcome).toBe("SL");
    expect(report.corrections.join()).toMatch(/esito assente, dedotto dal P&L/);
    expect(report.corrections.join()).toMatch(/1 trade importati hanno dati incoerenti/);
  });
});


describe("Monte Carlo", () => {
  const base = { start: 10_000, rr: 2, riskPct: 1, trades: 10, runs: 1, ddThresholdPct: 5 };
  it("sempre vincente: capitale x (1 + 2%)^10, drawdown zero", () => {
    const r = monteCarlo({ ...base, winRate: 1 }, () => 0);
    expect(r.median).toBeCloseTo(10_000 * 1.02 ** 10, 6);
    expect(r.medianMaxDdPct).toBe(0);
    expect(r.probLoss).toBe(0);
  });
  it("sempre perdente: capitale x 0,99^10 e drawdown corrispondente", () => {
    const r = monteCarlo({ ...base, winRate: 0 }, () => 0.5);
    expect(r.median).toBeCloseTo(10_000 * 0.99 ** 10, 6);
    expect(r.medianMaxDdPct).toBeCloseTo((1 - 0.99 ** 10) * 100, 6);
    expect(r.probDd).toBe(1);
    expect(r.probLoss).toBe(1);
  });
});

describe("backup JSON", () => {
  const journal: Journal = { version: 9, profile: { name: "m", capital: 10_000, currency: "€", maxDailyLossPct: 2 }, trades };
  it("un backup esportato si ricarica identico", () => {
    expect(parseBackup(JSON.stringify(journal))).toEqual({ journal });
  });
  it("rifiuta file non validi per intero", () => {
    expect(parseBackup("{")).toHaveProperty("error");
    expect(parseBackup(JSON.stringify({ ...journal, version: 8 }))).toHaveProperty("error");
    const bad = { ...journal, trades: [...trades, { ...trades[0], id: "x", pnl: "100" }] };
    expect(parseBackup(JSON.stringify(bad))).toEqual({ error: "Trade 7 del backup non valido o duplicato" });
    const dup = { ...journal, trades: [...trades, trades[0]] };
    expect(parseBackup(JSON.stringify(dup))).toHaveProperty("error");
  });
});
