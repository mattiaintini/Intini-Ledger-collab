import type { Trade } from "./types";

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  // RFC 4180: virgolette su ogni campo con virgole, virgolette o a capo
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = ["date", "time", "asset", "session", "type", "direction", "lots", "risk_pct", "rr", "grade", "outcome", "pnl", "mae_r", "mfe_r", "duration_min", "notes"];

export function tradesToCsv(trades: Trade[]): string {
  const rows = trades.map((t) =>
    [t.date, t.time, t.asset, t.session, t.type, t.direction, t.lots, t.riskPct, t.rr, t.grade, t.outcome, t.pnl, t.maeR, t.mfeR, t.durationMin, t.notes].map(cell).join(","),
  );
  return [CSV_HEADER.join(","), ...rows].join("\n");
}

export function download(filename: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
