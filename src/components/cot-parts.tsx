import Link from "next/link";
import type { CotMarket } from "@/lib/cot/markets";
import type { CotAnalytics } from "@/lib/cot/analytics";
import type { CheckStatus } from "@/lib/cot/verify";
import { num, pct, tone } from "@/lib/format";
import { StatusBadge } from "./ui";

export function IndexBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-subtle">n/d</span>;
  const extreme = value >= 80 || value <= 20;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 w-12 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${extreme ? "bg-fg" : "bg-muted"}`} style={{ width: `${Math.max(value, 3)}%` }} />
      </div>
      <span className={`num w-7 text-right text-[13px] ${extreme ? "font-semibold" : "text-muted"}`}>{num(value)}</span>
    </div>
  );
}

export function Positioning({ label }: { label: string }) {
  const extreme = label.includes("estremo");
  return <span className={`whitespace-nowrap text-sm ${extreme ? "font-semibold text-fg" : label === "neutrale" || label.includes("insufficiente") ? "text-muted" : "text-fg"}`}>{label}</span>;
}

/** Riga della panoramica COT: solo quello che serve alla tabella, non tutto lo storico di verifica. */
export interface CotRowView {
  market: CotMarket;
  analytics: CotAnalytics;
  status: CheckStatus;
}

/** Il badge compare solo se qualcosa non torna: "verificato" è la norma e lo dice già il riepilogo. */
const Flag = ({ status }: { status: CheckStatus }) => (status === "pass" ? null : <StatusBadge status={status} />);

export function CotTable({ markets }: { markets: CotRowView[] }) {
  return (
    <>
      {/* Desktop: tabella */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] bg-surface px-2 md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[18%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[7%]" />
            <col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[14%]" />
          </colgroup>
          <thead className="text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Market</th>
              <th className="px-4 py-3 text-right font-normal">Spec net</th>
              <th className="px-4 py-3 text-right font-normal">1w change</th>
              <th className="px-4 py-3 text-right font-normal">4w change</th>
              <th className="px-4 py-3 text-right font-normal">Long %</th>
              <th className="px-3 py-2.5 font-medium">Index 26w</th>
              <th className="px-3 py-2.5 font-medium">Index 52w</th>
              <th className="px-3 py-2.5 font-medium">Index 3y</th>
              <th className="px-3 py-2.5 font-medium">Positioning</th>
            </tr>
          </thead>
          <tbody>
            {markets.map(({ market, analytics: a, status }) => (
              <tr key={market.key} className="border-t-[0.5px] border-line">
                <td className="px-3 py-2.5">
                  <Link href={`/cot/${market.key}`} className="font-medium underline-offset-4 hover:underline">
                    {market.label}
                  </Link>{" "}
                  <Flag status={status} />
                  <div className="text-xs text-subtle">{market.symbol}</div>
                </td>
                <td className={`num px-3 py-2.5 text-right ${(a.specNet ?? 0) < 0 ? "text-muted" : ""}`}>{num(a.specNet, 0, { sign: true })}</td>
                <td className={`num px-3 py-2.5 text-right ${(a.specNetChange ?? 0) < 0 ? "text-muted" : ""}`}>{num(a.specNetChange, 0, { sign: true })}</td>
                <td className={`num px-3 py-2.5 text-right ${(a.specNetChange4w ?? 0) < 0 ? "text-muted" : ""}`}>{num(a.specNetChange4w, 0, { sign: true })}</td>
                <td className="num px-3 py-2.5 text-right">{pct(a.specLongPct, 0)}</td>
                <td className="px-3 py-2.5"><IndexBar value={a.cotIndex26} /></td>
                <td className="px-3 py-2.5"><IndexBar value={a.cotIndex52} /></td>
                <td className="px-3 py-2.5"><IndexBar value={a.cotIndex156} /></td>
                <td className="px-3 py-2.5"><Positioning label={a.positioning} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: schede */}
      <div className="flex flex-col gap-3 md:hidden">
        {markets.map(({ market, analytics: a, status }) => (
          <Link key={market.key} href={`/cot/${market.key}`} className="rounded-[var(--radius-card)] bg-surface p-4 active:opacity-80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{market.label}</p>
                <p className="text-xs text-subtle">{market.symbol}</p>
              </div>
              <Flag status={status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Spec net</p>
                <p className={`num ${tone(a.specNet)}`}>{num(a.specNet, 0, { sign: true })}</p>
              </div>
              <div>
                <p className="text-xs text-muted">1w change</p>
                <p className={`num ${tone(a.specNetChange)}`}>{num(a.specNetChange, 0, { sign: true })}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Index 52w</p>
                <IndexBar value={a.cotIndex52} />
              </div>
              <div>
                <p className="text-xs text-muted">Positioning</p>
                <Positioning label={a.positioning} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
