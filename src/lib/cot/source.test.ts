import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { buildCotReport } from "./source";
import type { CotMarket } from "./markets";

// Pipeline completa con fetch simulato: dati reali Euro FX (API 07/2025-09/2026, archivi CFTC 2025 e 2026),
// con ogni fonte che risponde o fallisce a comando.
const dir = join(__dirname, "__fixtures__");
const socrataJson = readFileSync(join(dir, "eur-socrata.json"), "utf8");
const annual: Record<number, string> = {
  2025: readFileSync(join(dir, "eur-annual-2025.txt"), "utf8"),
  2026: readFileSync(join(dir, "eur-annual-2026.txt"), "utf8"),
};
const weeklyText = annual[2026].split("\n")[1]; // il file della settimana non ha intestazione
const EUR: CotMarket = { key: "eur", code: "099741", label: "Euro", symbol: "EURUSD", group: "Valute" };
const GBP: CotMarket = { key: "gbp", code: "096742", label: "Sterlina", symbol: "GBPUSD", group: "Valute" };
const NOW = new Date("2026-09-23T12:00:00Z");

function mockFetch(fail: { socrata?: number; weekly?: number; annual?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const status = url.includes("publicreporting") ? fail.socrata : url.includes("deafut") ? fail.weekly : fail.annual;
      if (status) return new Response("errore", { status });
      if (url.includes("publicreporting")) return new Response(socrataJson);
      if (url.includes("deafut")) return new Response(weeklyText);
      const year = Number(url.match(/deacot(\d{4})/)![1]);
      return new Response(zipSync({ "annual.txt": strToU8(annual[year]) }));
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("buildCotReport con fonti simulate", () => {
  it("tutte le fonti rispondono: ogni settimana confrontata col file CFTC, esito verificato", async () => {
    mockFetch();
    const r = await buildCotReport({ now: NOW, markets: [EUR] });
    expect(r.status).toBe("pass");
    expect(r.sources.map((s) => [s.id, s.ok])).toEqual([["socrata", true], ["weekly", true], ["annual-2025", true], ["annual-2026", true]]);
    expect(r.summary).toEqual({ weeksChecked: 60, weeksFailed: 0, crossChecked: 60 });
    expect(r.markets[0].analytics.specNet).toBe(209000 - 235993);
  });

  it("file grezzi CFTC irraggiungibili: report generato, confronto 'skip', stato da controllare", async () => {
    mockFetch({ weekly: 503, annual: 503 });
    const r = await buildCotReport({ now: NOW, markets: [EUR] });
    expect(r.status).toBe("warn");
    expect(r.summary.crossChecked).toBe(0);
    expect(r.markets[0].verification.weeks.every((w) => w.source === "skip")).toBe(true);
    // i controlli interni restano attivi anche senza la seconda fonte
    expect(r.markets[0].verification.weeks.slice(1).every((w) => w.continuity === "pass" && w.balance === "pass")).toBe(true);
    expect(r.sources.filter((s) => !s.ok).map((s) => s.id)).toEqual(["weekly", "annual-2025", "annual-2026"]);
  });

  it("solo l'archivio dell'anno scorso manca: il confronto parte dall'anno corrente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("deacot2025")) return new Response("errore", { status: 503 });
        if (url.includes("publicreporting")) return new Response(socrataJson);
        if (url.includes("deafut")) return new Response(weeklyText);
        return new Response(zipSync({ "annual.txt": strToU8(annual[2026]) }));
      }),
    );
    const r = await buildCotReport({ now: NOW, markets: [EUR] });
    const weeks = r.markets[0].verification.weeks;
    expect(weeks.filter((w) => w.date < "2026-01-01").every((w) => w.source === "skip")).toBe(true);
    expect(weeks.filter((w) => w.date >= "2026-01-01").every((w) => w.source === "pass")).toBe(true);
    expect(r.status).toBe("warn");
  });

  it("API CFTC irraggiungibile: nessun report, meglio nessun dato che dati non verificati", async () => {
    mockFetch({ socrata: 500 });
    await expect(buildCotReport({ now: NOW, markets: [EUR] })).rejects.toThrow(/API CFTC/);
  });

  it("un mercato senza dati nell'API viene escluso e il report va in errore", async () => {
    mockFetch();
    const r = await buildCotReport({ now: NOW, markets: [EUR, GBP] });
    expect(r.markets.map((m) => m.market.key)).toEqual(["eur"]);
    expect(r.missing.map((m) => m.key)).toEqual(["gbp"]);
    expect(r.status).toBe("fail");
  });

  it("un numero diverso tra API e archivio CFTC fa fallire la verifica", async () => {
    const tampered = JSON.parse(socrataJson) as Record<string, string>[];
    const row = tampered.find((x) => x.report_date_as_yyyy_mm_dd.startsWith("2026-03-10"))!;
    row.open_interest_all = String(Number(row.open_interest_all) + 1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("publicreporting")) return new Response(JSON.stringify(tampered));
        if (url.includes("deafut")) return new Response(weeklyText);
        const year = Number(url.match(/deacot(\d{4})/)![1]);
        return new Response(zipSync({ "annual.txt": strToU8(annual[year]) }));
      }),
    );
    const r = await buildCotReport({ now: NOW, markets: [EUR] });
    const week = r.markets[0].verification.weeks.find((w) => w.date === "2026-03-10")!;
    expect(week.source).toBe("fail");
    expect(week.issues.join()).toMatch(/Campo oi/);
    expect(r.status).toBe("fail");
  });
});
