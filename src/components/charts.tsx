"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Colori dai token CSS: seguono tema chiaro/scuro e restano in scala di grigi.
const FG = "var(--t-fg)";
const LOSS = "var(--t-muted)";
const AXIS = { stroke: "var(--t-muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "var(--t-grid)", strokeWidth: 0.5, vertical: false } as const;
const TOOLTIP = {
  contentStyle: { background: "var(--t-surface-2)", border: "1px solid var(--t-line-strong)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--t-muted)" },
  itemStyle: { color: "var(--t-fg)" },
} as const;

const it = (v: unknown, digits = 0) =>
  Number(v).toLocaleString("it-IT", { useGrouping: "always", minimumFractionDigits: digits, maximumFractionDigits: digits } as Intl.NumberFormatOptions);
const compact = (v: number) => v.toLocaleString("it-IT", { notation: "compact", maximumFractionDigits: 1 });
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" });

export function CotNetChart({ data }: { data: { date: string; specNet: number; commNet: number }[] }) {
  return (
    <div className="h-72 w-full md:h-80">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={48} {...AXIS} />
          <YAxis orientation="right" tickCount={5} tickFormatter={compact} width={48} {...AXIS} />
          <ReferenceLine y={0} stroke="var(--t-muted)" />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => shortDate(String(d))} formatter={(v, n) => [it(v), n === "specNet" ? "Speculativi" : "Commercial"]} />
          <Line type="linear" dataKey="commNet" stroke="var(--t-muted)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="specNet" stroke={FG} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EquityChart({ data, capital }: { data: { index: number; equity: number; date: string }[]; capital: number }) {
  return (
    <div className="h-64 w-full md:h-72">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FG} stopOpacity={0.14} />
              <stop offset="100%" stopColor={FG} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="index" {...AXIS} minTickGap={40} tickFormatter={(i) => (data[i]?.date ? shortDay(data[i].date) : "")} />
          <YAxis domain={["auto", "auto"]} tickFormatter={compact} width={52} {...AXIS} />
          <ReferenceLine y={capital} stroke="var(--t-line-strong)" strokeDasharray="4 4" />
          <Tooltip {...TOOLTIP} labelFormatter={(i) => (Number(i) === 0 ? "Capitale iniziale" : `Trade ${i}, ${data[Number(i)]?.date ? shortDay(data[Number(i)].date) : ""}`)} formatter={(v) => [it(v, 2), "Capitale"]} />
          <Area type="monotone" dataKey="equity" stroke={FG} strokeWidth={1.5} fill="url(#eq)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barre verdi o rosse. `negative` forza il colore quando il valore e' un conteggio (sempre positivo). */
/**
 * Barre verdi/rosse sostituite dal monocromo: guadagni pieni, perdite a contorno sotto lo zero.
 * `negative` forza lo stile di perdita quando il valore è un conteggio (sempre positivo).
 */
export function PnlBars({ data, height = 240, label = "Valore" }: { data: { key: string; value: number; negative?: boolean }[]; height?: number; label?: string }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="key" {...AXIS} interval={data.length <= 8 ? 0 : "preserveStartEnd"} minTickGap={8} tickFormatter={(k) => String(k).replace(".", ",").replace(/^-/, "\u2212")} />
          <YAxis orientation="right" tickCount={4} tickFormatter={compact} width={44} {...AXIS} />
          <ReferenceLine y={0} stroke="var(--t-muted)" strokeWidth={1} />
          <Tooltip {...TOOLTIP} cursor={{ fill: "var(--t-grid)" }} formatter={(v) => [it(v, Number.isInteger(Number(v)) ? 0 : 2), label]} />
          <Bar dataKey="value" maxBarSize={28} radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((d) => {
              const loss = d.negative ?? d.value < 0;
              return <Cell key={d.key} fill={loss ? "transparent" : FG} fillOpacity={loss ? 1 : 0.9} stroke={loss ? FG : "none"} strokeWidth={loss ? 1.25 : 0} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimulationChart({ paths, start }: { paths: number[][]; start: number }) {
  const data = paths[0]?.map((_, i) => Object.fromEntries([["i", i], ...paths.map((p, k) => [`p${k}`, p[i]])])) ?? [];
  return (
    <div className="h-72 w-full md:h-96">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="i" {...AXIS} minTickGap={32} />
          <YAxis orientation="right" tickFormatter={compact} width={48} {...AXIS} />
          <ReferenceLine y={start} stroke="var(--t-line-strong)" strokeDasharray="4 4" />
          {paths.map((_, k) => (
            <Line key={k} dataKey={`p${k}`} stroke={FG} strokeOpacity={0.25} strokeWidth={1} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** P&L per strumento a barre orizzontali: i nomi dei simboli non si sovrappongono mai. */
export function InstrumentBars({ data }: { data: { key: string; value: number }[] }) {
  const height = Math.max(160, data.length * 34 + 30);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--t-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={compact} {...AXIS} />
          <YAxis type="category" dataKey="key" width={64} {...AXIS} />
          <ReferenceLine x={0} stroke="var(--t-line-strong)" />
          <Tooltip {...TOOLTIP} cursor={{ fill: "var(--t-grid)" }} formatter={(v) => [it(v, 2), "P&L"]} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.value < 0 ? LOSS : FG} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
