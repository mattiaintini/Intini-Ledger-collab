"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Impact, MacroEvent } from "@/lib/news/forexfactory";

const ZONES = [
  ["Europe/Rome", "Roma"],
  ["Europe/London", "Londra"],
  ["America/New_York", "New York"],
  ["UTC", "UTC"],
] as const;

const IMPACT_LABEL: Record<Impact, string> = { High: "Alto", Medium: "Medio", Low: "Basso", Holiday: "Festivo" };
// Minuto corrente solo nel browser: sul server (pagina rigenerata ogni ora) nessun evento risulta passato,
// così l'idratazione non trova differenze.
const noSubscribe = () => () => {};
const clientMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverMinute = () => 0;

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY"];

export function NewsTable({ events }: { events: MacroEvent[] }) {
  const [tz, setTz] = useState<string>("Europe/Rome");
  const [minImpact, setMinImpact] = useState<"High" | "Medium">("Medium");
  const [ccy, setCcy] = useState<string[]>(["USD", "EUR", "GBP"]);

  const list = useMemo(
    () => events.filter((e) => (minImpact === "High" ? e.impact === "High" : e.impact === "High" || e.impact === "Medium") && ccy.includes(e.currency)),
    [events, minImpact, ccy],
  );
  const days = useMemo(() => {
    const byDay = new Map<string, MacroEvent[]>();
    for (const e of list) {
      const day = new Date(e.at).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
    return [...byDay];
  }, [list, tz]);
  const now = useSyncExternalStore(noSubscribe, clientMinute, serverMinute);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <select className="field md:w-40" value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Fuso orario">
          {ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="field md:w-44" value={minImpact} onChange={(e) => setMinImpact(e.target.value as "High" | "Medium")} aria-label="Impatto">
          <option value="Medium">Impatto medio e alto</option>
          <option value="High">Solo impatto alto</option>
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Valute">
          {CURRENCIES.map((c) => {
            const on = ccy.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCcy(on ? ccy.filter((x) => x !== c) : [...ccy, c])}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-line-strong bg-surface-3 text-fg" : "border-line text-subtle"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {days.length === 0 && <p className="py-10 text-center text-sm text-muted">Nessun evento con questi filtri.</p>}
      <div className="flex flex-col gap-6">
        {days.map(([day, evs]) => (
          <section key={day}>
            <h3 className="mb-2 text-sm font-medium capitalize text-muted">{day}</h3>
            <ul className="divide-y divide-line rounded-[var(--radius-ui)] border border-line">
              {evs.map((e) => {
                const past = now > 0 && Date.parse(e.at) < now;
                return (
                  <li key={`${e.at}${e.currency}${e.title}`} className={`grid grid-cols-[3.5rem_3rem_1fr] items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm md:grid-cols-[4rem_3.5rem_1fr_7rem_7rem] ${past ? "opacity-50" : ""}`}>
                    <span className="num text-muted">{new Date(e.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: tz })}</span>
                    <span className="font-medium">{e.currency}</span>
                    <span>
                      {e.title}
                      <span className={`ml-2 text-xs ${e.impact === "High" ? "text-neg" : "text-warn"}`}>{IMPACT_LABEL[e.impact]}</span>
                    </span>
                    <span className="num col-start-3 text-xs text-muted md:col-start-auto md:text-right md:text-sm">
                      <span className="md:hidden">Previsto </span>{e.forecast || "n/d"}
                    </span>
                    <span className="num col-start-3 text-xs text-subtle md:col-start-auto md:text-right md:text-sm">
                      <span className="md:hidden">Precedente </span>{e.previous || "n/d"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
