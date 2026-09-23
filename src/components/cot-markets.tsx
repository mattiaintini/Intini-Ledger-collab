"use client";

import { useMemo } from "react";
import { useJournal } from "@/lib/journal/store";
import { CotTable, type CotRowView } from "./cot-parts";
import type { MarketGroup } from "@/lib/cot/markets";

const GROUPS: [MarketGroup, string][] = [
  ["Valute", "FX"],
  ["Metalli", "Metals"],
  ["Energia", "Energy"],
  ["Indici", "Indices"],
  ["Crypto", "Crypto"],
];

// Nomi con cui i broker chiamano gli stessi strumenti.
const ALIASES: Record<string, string[]> = {
  XAUUSD: ["GOLD", "XAU"],
  XAGUSD: ["SILVER", "XAG"],
  US500: ["SPX500", "SP500", "SPX", "ES", "US500.CASH"],
  US100: ["NAS100", "NDX", "USTEC", "NQ", "US100.CASH"],
  USOIL: ["WTI", "XTIUSD", "CL", "USOUSD"],
  BTCUSD: ["BTC", "BTCUSDT"],
  DXY: ["USDX", "DX"],
};

/** Quante volte uno strumento del journal corrisponde al mercato COT, cambi incrociati inclusi (EURJPY conta per Euro e Yen). */
export function tradeCount(symbol: string, assets: Map<string, number>): number {
  const names = [symbol, ...(ALIASES[symbol] ?? [])];
  let n = 0;
  for (const [asset, count] of assets) {
    if (names.includes(asset)) n += count;
    else if (symbol.length === 6 && asset.length === 6 && /^[A-Z]{6}$/.test(asset)) {
      const ccy = symbol.startsWith("USD") ? symbol.slice(3) : symbol.slice(0, 3);
      if (ccy !== "USD" && (asset.startsWith(ccy) || asset.endsWith(ccy)) && !names.includes(asset)) n += count;
    }
  }
  return n;
}

export function CotMarkets({ rows }: { rows: CotRowView[] }) {
  const { journal } = useJournal();
  const mine = useMemo(() => {
    if (!journal) return [];
    const assets = new Map<string, number>();
    for (const t of journal.trades) assets.set(t.asset, (assets.get(t.asset) ?? 0) + 1);
    return rows
      .map((r) => ({ r, n: tradeCount(r.market.symbol, assets) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.r);
  }, [journal, rows]);
  const mineKeys = new Set(mine.map((r) => r.market.key));

  return (
    <div className="flex flex-col gap-10">
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 text-[20px] font-bold">Your markets <span className="text-[15px] font-normal text-muted">dagli strumenti del journal</span></h2>
          <CotTable markets={mine} />
        </section>
      )}
      {GROUPS.map(([g, label]) => {
        const list = rows.filter((r) => r.market.group === g && !mineKeys.has(r.market.key));
        return list.length ? (
          <section key={g}>
            <h2 className="mb-2 text-[20px] font-bold">{label}</h2>
            <CotTable markets={list} />
          </section>
        ) : null;
      })}
    </div>
  );
}
