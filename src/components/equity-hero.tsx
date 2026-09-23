"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Currency } from "@/lib/journal/types";
import { money, pct } from "@/lib/format";
import { Segmented } from "./ui";

// Intestazione in stile Borsa: valore grande, variazione del periodo, grafico da "strofinare".
// Durante lo scrub il valore in alto diventa quello del punto e la variazione diventa la data:
// nessun riquadro tooltip sopra il grafico.

type Range = "1W" | "1M" | "3M" | "YTD" | "ALL";
const RANGES = [
  ["1W", "1S"],
  ["1M", "1M"],
  ["3M", "3M"],
  ["YTD", "YTD"],
  ["ALL", "Tutto"],
] as const;
const RANGE_LABEL: Record<Range, string> = { "1W": "Ultima settimana", "1M": "Ultimo mese", "3M": "Ultimi 3 mesi", YTD: "Da inizio anno", ALL: "Da sempre" };

interface Point {
  index: number;
  date: string;
  equity: number;
}

function cutoff(range: Range, last: string): string {
  if (range === "ALL") return "";
  const d = new Date(`${last}T12:00:00Z`);
  if (range === "YTD") return `${d.getUTCFullYear()}-01-01`;
  d.setUTCDate(d.getUTCDate() - (range === "1W" ? 7 : range === "1M" ? 30 : 91));
  return d.toISOString().slice(0, 10);
}

const dayLabel = (d: string, withYear = false) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

const AXIS = { stroke: "var(--t-muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

export function EquityHero({ curve, capital, currency }: { curve: Point[]; capital: number; currency: Currency }) {
  const [range, setRange] = useState<Range>("ALL");
  const [hover, setHover] = useState<number | null>(null);

  const { points, base } = useMemo(() => {
    const trades = curve.slice(1); // il punto 0 è il capitale iniziale
    if (!trades.length) return { points: curve, base: capital };
    const from = cutoff(range, trades[trades.length - 1].date);
    const inRange = from ? trades.filter((p) => p.date >= from) : curve;
    const firstIdx = inRange[0]?.index ?? 0;
    // base del periodo: capitale subito prima del primo trade del periodo
    const before = curve[Math.max(0, firstIdx - 1)];
    const pts = from ? [{ ...before, date: before.date }, ...inRange] : inRange;
    return { points: pts, base: from ? before.equity : capital };
  }, [curve, capital, range]);

  const last = points[points.length - 1];
  const shown = hover !== null && points[hover] ? points[hover] : last;
  const diff = shown.equity - base;
  const diffPct = base > 0 ? (diff / base) * 100 : 0;
  const scrubbing = hover !== null && points[hover];
  const values = points.map((p) => p.equity);
  const min = Math.min(...values, base);
  const max = Math.max(...values, base);
  const pad = (max - min) * 0.08 || max * 0.01;

  return (
    <section className="rounded-[var(--radius-card)] bg-surface px-4 pb-3 pt-5 md:px-6 md:pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-muted">Equity</p>
          <p className="num mt-1 text-[40px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[48px]" aria-live="polite">
            {money(shown.equity, currency)}
          </p>
          <p className="mt-1.5 text-[17px] font-semibold">
            <span className={diff < 0 ? "text-muted" : ""}>
              {money(diff, currency, { sign: true })} ({pct(diffPct, 2, { sign: true })})
            </span>{" "}
            <span className="font-normal text-muted">
              {scrubbing ? `${dayLabel(shown.date, true)} · trade ${shown.index}` : RANGE_LABEL[range]}
            </span>
          </p>
        </div>
        <Segmented<Range> label="Periodo" value={range} options={RANGES} onChange={(r) => { setRange(r); setHover(null); }} size="sm" className="self-start" />
      </div>

      <div className="mt-4 h-60 w-full select-none md:h-72" onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
        <ResponsiveContainer>
          <AreaChart
            data={points}
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            onMouseMove={(s) => setHover(s.activeTooltipIndex === undefined || s.activeTooltipIndex === null ? null : Number(s.activeTooltipIndex))}
          >
            <defs>
              <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--t-fg)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--t-fg)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--t-grid)" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="index" {...AXIS} minTickGap={56} tickFormatter={(i) => { const p = points.find((x) => x.index === i); return p ? dayLabel(p.date) : ""; }} />
            <YAxis orientation="right" domain={[min - pad, max + pad]} tickCount={4} width={56} {...AXIS} tickFormatter={(v) => Number(v).toLocaleString("it-IT", { notation: "compact", maximumFractionDigits: 1 })} />
            <ReferenceLine y={base} stroke="var(--t-subtle)" strokeWidth={1} label={{ value: range === "ALL" ? "Inizio" : "Base", position: "insideTopLeft", fill: "var(--t-muted)", fontSize: 11 }} />
            <Tooltip content={() => null} cursor={{ stroke: "var(--t-subtle)", strokeWidth: 1 }} isAnimationActive={false} />
            <Area
              type="linear"
              dataKey="equity"
              stroke="var(--t-fg)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#hero-area)"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: "var(--t-fg)", stroke: "var(--t-surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
