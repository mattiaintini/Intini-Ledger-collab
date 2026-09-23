import type { Currency } from "@/lib/journal/types";
import { money } from "@/lib/format";

/** P&L per strumento come lista (stile Tempo di utilizzo): nome, valore, barra proporzionale sotto. */
export function InstrumentList({ rows, currency }: { rows: { key: string; value: number; trades: number }[]; currency: Currency }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="-my-1">
      {rows.map((r, i) => (
        <li key={r.key} className={`py-2.5 ${i ? "border-t-[0.5px] border-line" : ""}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-medium">{r.key}</span>
            <span className={`num text-[15px] ${r.value < 0 ? "text-muted" : "font-semibold"}`}>{money(r.value, currency, { sign: true })}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full ${r.value < 0 ? "bg-transparent shadow-[inset_0_0_0_1px_var(--t-muted)]" : "bg-fg"}`}
                style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
              />
            </div>
            <span className="w-14 text-right text-[12px] text-muted">{r.trades} trade</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
