import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCalendar } from "./forexfactory";

const sample = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "ff-week.json"), "utf8"));

describe("feed ForexFactory", () => {
  it("normalizza gli eventi reali in UTC e in ordine di tempo", () => {
    const { events, dropped } = parseCalendar(sample);
    expect(dropped).toBe(0);
    expect(events).toHaveLength(sample.length);
    const first = sample[0];
    const e = events.find((x) => x.title === first.title && x.currency === first.country)!;
    expect(e.at).toBe(new Date(first.date).toISOString());
    expect(events.every((x, i) => i === 0 || events[i - 1].at <= x.at)).toBe(true);
  });

  it("scarta e conta gli eventi malformati", () => {
    const { events, dropped } = parseCalendar([
      { title: "CPI m/m", country: "USD", date: "2026-09-24T08:30:00-04:00", impact: "High", forecast: "0.3%", previous: "0.2%" },
      { title: "senza data", country: "USD", date: "", impact: "High" },
      { title: "impatto ignoto", country: "EUR", date: "2026-09-24T08:30:00-04:00", impact: "Huge" },
      null,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].at).toBe("2026-09-24T12:30:00.000Z");
    expect(dropped).toBe(3);
  });

  it("rifiuta un feed che non è una lista", () => {
    expect(() => parseCalendar({ error: "rate limited" })).toThrow();
  });
});
