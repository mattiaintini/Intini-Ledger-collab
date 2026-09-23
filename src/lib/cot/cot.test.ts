import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRawCotFile, parseSocrataRow, parseCsvLine, CotFormatError, type CotRow } from "./parse";
import { analyze, cotIndex, classifyPositioning } from "./analytics";
import { compareSources, expectedLatestReport, verifyMarket } from "./verify";

// Fixture reali: Euro FX (099741), API Socrata ultime 60 settimane + archivio CFTC 2026.
const dir = join(__dirname, "__fixtures__");
const socrata = (JSON.parse(readFileSync(join(dir, "eur-socrata.json"), "utf8")) as Record<string, unknown>[])
  .map(parseSocrataRow)
  .sort((a, b) => a.date.localeCompare(b.date));
const annualText = readFileSync(join(dir, "eur-annual-2026.txt"), "utf8");
const raw = new Map(parseRawCotFile(annualText, new Set(["099741"])).map((r) => [r.date, r]));
const NOW = new Date("2026-09-23T12:00:00Z");

const clone = (rows: CotRow[]) => rows.map((r) => ({ ...r }));

describe("parsing delle fonti CFTC", () => {
  it("legge 60 settimane dall'API e 37 dall'archivio 2026", () => {
    expect(socrata).toHaveLength(60);
    expect(raw.size).toBe(37);
  });

  it("API e file grezzo coincidono campo per campo su ogni settimana del 2026", () => {
    const in2026 = socrata.filter((r) => r.date >= "2026-01-01");
    expect(in2026).toHaveLength(37);
    for (const r of in2026) expect(compareSources(r, raw.get(r.date)!)).toEqual([]);
  });

  it("valori noti del report del 15/09/2026", () => {
    const last = socrata.at(-1)!;
    expect(last.date).toBe("2026-09-15");
    expect(last.oi).toBe(920035);
    expect(last.ncLong).toBe(209000);
    expect(last.ncShort).toBe(235993);
    expect(last.chgNcLong).toBe(10491);
    expect(last.chgNcShort).toBe(-5132);
  });

  it("rifiuta un file con colonne spostate invece di leggere numeri sbagliati", () => {
    const [header, ...rest] = annualText.split("\n");
    const cols = parseCsvLine(header);
    [cols[8], cols[9]] = [cols[9], cols[8]];
    const broken = [cols.map((c) => `"${c}"`).join(","), ...rest].join("\n");
    expect(() => parseRawCotFile(broken, new Set(["099741"]))).toThrow(CotFormatError);
  });

  it("rifiuta un campo numerico non intero dall'API", () => {
    expect(() => parseSocrataRow({ report_date_as_yyyy_mm_dd: "2026-09-15T00:00:00.000", open_interest_all: "12a" })).toThrow(CotFormatError);
  });
});

describe("verifica settimana per settimana", () => {
  it("dati reali: tutte le settimane passano ogni controllo", () => {
    const v = verifyMarket(socrata, raw, "2026-01-01", NOW);
    expect(v.counts.fail).toBe(0);
    expect(v.weeks.slice(1).every((w) => w.continuity === "pass" && w.calendar === "pass")).toBe(true);
    expect(v.weeks.every((w) => w.balance === "pass")).toBe(true);
    expect(v.weeks.filter((w) => w.source === "pass")).toHaveLength(37);
    expect(v.freshness.status).toBe("pass");
    expect(v.status).toBe("pass");
  });

  it("un numero alterato nell'API fa fallire continuità, bilancio e confronto fonti", () => {
    const rows = clone(socrata);
    const i = rows.findIndex((r) => r.date === "2026-06-09");
    rows[i].ncLong += 1000;
    const v = verifyMarket(rows, raw, "2026-01-01", NOW);
    const week = v.weeks[i];
    expect(week.continuity).toBe("fail"); // la variazione pubblicata non torna più
    expect(week.balance).toBe("fail"); // reportable != spec + spreading + commercial
    expect(week.source).toBe("fail"); // diverso dal file CFTC
    expect(v.weeks[i + 1].continuity).toBe("fail"); // e rompe anche la settimana dopo
    expect(v.status).toBe("fail");
  });

  it("una settimana mancante viene segnalata", () => {
    const rows = clone(socrata);
    const i = rows.findIndex((r) => r.date === "2026-06-09");
    rows.splice(i, 1);
    const v = verifyMarket(rows, raw, "2026-01-01", NOW);
    expect(v.weeks[i].calendar).toBe("fail");
  });

  it("una settimana presente nell'API ma assente dal file ufficiale fallisce", () => {
    const partial = new Map(raw);
    partial.delete("2026-06-09");
    const v = verifyMarket(socrata, partial, "2026-01-01", NOW);
    expect(v.weeks.find((w) => w.date === "2026-06-09")!.source).toBe("fail");
  });

  it("prima della copertura del file grezzo il confronto è 'skip', non 'pass'", () => {
    const v = verifyMarket(socrata, raw, "2026-01-01", NOW);
    expect(v.weeks.filter((w) => w.date < "2026-01-01").every((w) => w.source === "skip")).toBe(true);
  });

  it("dato vecchio di due settimane = fail di aggiornamento", () => {
    const v = verifyMarket(socrata.slice(0, -2), raw, "2026-01-01", NOW);
    expect(v.freshness.status).toBe("fail");
  });

  it("file CFTC più recente dell'API = avviso di ritardo", () => {
    const v = verifyMarket(socrata.slice(0, -1), raw, "2026-01-01", NOW);
    expect(v.apiLag.status).toBe("warn");
  });
});

describe("calendario di pubblicazione", () => {
  it("mercoledì: l'ultimo report atteso è il martedì della settimana prima", () => {
    expect(expectedLatestReport(new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-15");
  });
  it("venerdì prima delle 20:30 UTC il nuovo report non è ancora atteso", () => {
    expect(expectedLatestReport(new Date("2026-09-18T19:00:00Z"))).toBe("2026-09-08");
  });
  it("venerdì dopo la pubblicazione è atteso il martedì della stessa settimana", () => {
    expect(expectedLatestReport(new Date("2026-09-18T21:00:00Z"))).toBe("2026-09-15");
  });
});

describe("analisi", () => {
  it("net, variazione e quote dal report reale del 15/09/2026", () => {
    const a = analyze(socrata);
    expect(a.specNet).toBe(209000 - 235993);
    expect(a.specNetChange).toBe(10491 - -5132);
    // la variazione pubblicata coincide con la differenza tra le net
    expect(a.specNetChange).toBe(a.specNet - (socrata.at(-2)!.ncLong - socrata.at(-2)!.ncShort));
    expect(a.specLongPct).toBeCloseTo((209000 / (209000 + 235993)) * 100, 10);
    expect(a.specNetPctOi).toBeCloseTo((-26993 / 920035) * 100, 10);
    expect(a.cotIndex156).toBeNull(); // 60 settimane non bastano per 3 anni
  });

  it("COT Index: estremi inclusi, range piatto = 50, storico corto = null", () => {
    expect(cotIndex([0, 10, 5], 3)).toBe(50);
    expect(cotIndex([0, 10, 10], 3)).toBe(100);
    expect(cotIndex([0, 10, 0], 3)).toBe(0);
    expect(cotIndex([7, 7, 7], 3)).toBe(50);
    expect(cotIndex([1, 2], 3)).toBeNull();
    // usa solo le ultime N settimane
    expect(cotIndex([1000, 0, 10, 5], 3)).toBe(50);
  });

  it("COT Index 52 settimane calcolato a mano sui dati reali", () => {
    const nets = socrata.map((r) => r.ncLong - r.ncShort).slice(-52);
    const expected = ((nets[51] - Math.min(...nets)) / (Math.max(...nets) - Math.min(...nets))) * 100;
    expect(analyze(socrata).cotIndex52).toBeCloseTo(expected, 10);
  });

  it("classificazione del posizionamento sulle soglie dichiarate", () => {
    expect(classifyPositioning(85)).toBe("long estremo");
    expect(classifyPositioning(80)).toBe("long estremo");
    expect(classifyPositioning(60)).toBe("long");
    expect(classifyPositioning(50)).toBe("neutrale");
    expect(classifyPositioning(20)).toBe("short estremo");
    expect(classifyPositioning(null)).toBe("storico insufficiente");
  });
});
