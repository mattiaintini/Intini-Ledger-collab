// Calendario macro della settimana dal feed pubblico di ForexFactory (nessuna chiave).
// Limite noto del feed: solo la settimana corrente e nessun valore "actual".

export const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export type Impact = "High" | "Medium" | "Low" | "Holiday";

export interface MacroEvent {
  title: string;
  currency: string;
  /** Istante in ISO UTC. */
  at: string;
  impact: Impact;
  forecast: string;
  previous: string;
}

const IMPACTS: Impact[] = ["High", "Medium", "Low", "Holiday"];

/** Valida e normalizza il feed: gli eventi malformati vengono scartati e contati, non indovinati. */
export function parseCalendar(data: unknown): { events: MacroEvent[]; dropped: number } {
  if (!Array.isArray(data)) throw new Error("Feed ForexFactory in formato inatteso");
  const events: MacroEvent[] = [];
  let dropped = 0;
  for (const e of data as Record<string, unknown>[]) {
    const t = Date.parse(String(e?.date ?? ""));
    if (!e || typeof e.title !== "string" || typeof e.country !== "string" || !IMPACTS.includes(e.impact as Impact) || Number.isNaN(t)) {
      dropped++;
      continue;
    }
    events.push({
      title: e.title,
      currency: e.country,
      at: new Date(t).toISOString(),
      impact: e.impact as Impact,
      forecast: typeof e.forecast === "string" ? e.forecast : "",
      previous: typeof e.previous === "string" ? e.previous : "",
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return { events, dropped };
}

export async function fetchCalendar(): Promise<{ events: MacroEvent[]; dropped: number }> {
  const res = await fetch(FF_URL, { headers: { "User-Agent": "Mozilla/5.0 (IntiniJournalSuite)" }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`ForexFactory ha risposto ${res.status}`);
  return parseCalendar(await res.json());
}
