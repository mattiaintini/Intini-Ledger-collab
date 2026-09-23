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

const AXIS = { stroke: "#71717a", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "rgba(255,255,255,0.06)", vertical: false } as const;
const TOOLTIP = {
  contentStyle: { background: "#141416", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#fff" },
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
          <YAxis tickFormatter={compact} width={52} {...AXIS} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => shortDate(String(d))} formatter={(v, n) => [it(v), n === "specNet" ? "Speculativi" : "Commercial"]} />
          <Line type="monotone" dataKey="commNet" stroke="#71717a" strokeWidth={1.25} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="specNet" stroke="#ffffff" strokeWidth={2} dot={false} isAnimationActive={false} />
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
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="index" {...AXIS} minTickGap={40} tickFormatter={(i) => (data[i]?.date ? shortDay(data[i].date) : "")} />
          <YAxis domain={["auto", "auto"]} tickFormatter={compact} width={52} {...AXIS} />
          <ReferenceLine y={capital} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
          <Tooltip {...TOOLTIP} labelFormatter={(i) => (Number(i) === 0 ? "Capitale iniziale" : `Trade ${i}, ${data[Number(i)]?.date ? shortDay(data[Number(i)].date) : ""}`)} formatter={(v) => [it(v, 2), "Capitale"]} />
          <Area type="monotone" dataKey="equity" stroke="#ffffff" strokeWidth={1.5} fill="url(#eq)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barre verdi o rosse. `negative` forza il colore quando il valore e' un conteggio (sempre positivo). */
export function PnlBars({ data, height = 240, label = "Valore" }: { data: { key: string; value: number; negative?: boolean }[]; height?: number; label?: string }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="key" {...AXIS} interval="preserveStartEnd" minTickGap={8} tickFormatter={(k) => String(k).replace(".", ",")} />
          <YAxis tickFormatter={compact} width={52} {...AXIS} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [it(v, Number.isInteger(Number(v)) ? 0 : 2), label]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={(d.negative ?? d.value < 0) ? "#ef5350" : "#5bc08a"} />
            ))}
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
          <YAxis tickFormatter={compact} width={52} {...AXIS} />
          <ReferenceLine y={start} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
          {paths.map((_, k) => (
            <Line key={k} dataKey={`p${k}`} stroke="rgba(255,255,255,0.28)" strokeWidth={1} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
