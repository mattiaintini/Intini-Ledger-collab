// E2E sull'app di produzione locale: npm run build && npm run e2e
// Avvia `next start`, usa Chrome di sistema (CHROME_PATH per cambiarlo), esce con 1 al primo controllo fallito.
// SHOTS=<cartella> salva gli screenshot di ogni pagina.
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = process.env.SHOTS;
const legacy = readFileSync(new URL("./fixtures/legacy-v8.json", import.meta.url), "utf8");

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
};

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore" });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("next start non risponde");
}

const PAGES = ["/", "/journal", "/journal/new", "/analytics", "/calendar", "/cot", "/cot/gold", "/cot/verification", "/tools", "/news", "/settings", "/more"];

async function run() {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: CHROME });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  for (const [tag, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("tradingview") && errors.push(m.text()));

    // 1. Import dei dati v8
    await page.goto(BASE);
    await page.evaluate((l) => {
      localStorage.clear();
      localStorage.setItem("intini_pro_v8", l);
    }, legacy);
    await page.reload();
    await page.getByRole("button", { name: "Importa profilo mattia" }).click();
    await page.getByText("31 trade importati").waitFor();
    const stored = await page.evaluate(() => localStorage.getItem("intini_journal_v9"));
    check(JSON.parse(stored).trades.length === 31, `${tag} import v8`, "31 trade");
    check(!stored.includes("Test!2345") && !stored.includes("KEY-XXXX"), `${tag} password e recovery key non importate`);
    check(await page.getByText("2 trade importati hanno dati incoerenti").isVisible(), `${tag} report import coerente con l'audit`);
    check(await page.getByText("2 trade con dati incoerenti").isVisible(), `${tag} banner errori conta i trade, non i messaggi`);

    // 2. Tutte le pagine: nessun errore, nessuno scroll orizzontale
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.waitForTimeout(700); // idratazione e lettura del localStorage
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `${tag} ${path} senza overflow orizzontale`, overflow > 0 ? `${overflow}px` : "");
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}${path.replaceAll("/", "_") || "_home"}.png`, fullPage: true });
    }

    // 3. COT: dati verificati mostrati, nessun mercato mancante
    await page.goto(BASE + "/cot");
    const cotText = await page.locator("main").innerText();
    check(/nessuna discrepanza/.test(cotText), `${tag} COT senza discrepanze`);
    check(!/Nessun dato CFTC/.test(cotText), `${tag} COT senza mercati mancanti`);

    check(errors.length === 0, `${tag} nessun errore in console`, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  // 4. Form: validazione, avvisi, formato italiano, accessibilità delle etichette
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/journal/new");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Capitale iniziale", { exact: true }).fill("10.000");
  await page.getByRole("button", { name: "Inizia" }).click();
  const form = page.locator("form").first();
  const field = (l) => form.getByLabel(l, { exact: true });
  for (const l of ["Data", "Ora", "Strumento", "Sessione", "Tipo", "Setup", "Lotti", "Rischio %", "RR", "Esito", "P&L (€)", "Note"]) {
    check((await field(l).count()) === 1, `campo "${l}" raggiungibile per etichetta esatta`);
  }
  check((await form.getByRole("group", { name: "Direzione" }).count()) === 1, `gruppo "Direzione" etichettato`);

  await form.getByRole("button", { name: "Registra trade" }).click();
  const emptyErrors = await form.getByRole("alert").allTextContents();
  check(emptyErrors.length >= 3, "form vuoto bloccato", emptyErrors.join(" | "));

  await field("Strumento").fill("xauusd");
  await field("Lotti").fill("0,5");
  await field("Esito").selectOption("TP");
  check((await field("P&L (€)").inputValue()) === "200,00", "P&L suggerito dal piano con la virgola", await field("P&L (€)").inputValue());

  await field("P&L (€)").fill("-50");
  await form.getByRole("button", { name: "Registra trade" }).click();
  check(await form.getByText("Take profit con P&L non positivo").isVisible(), "take profit in perdita bloccato");

  await field("P&L (€)").fill("120");
  await form.getByRole("button", { name: "Registra trade" }).click();
  check(await form.getByText(/P&L 120,00 lontano dal piano 200,00/).isVisible(), "avviso scostamento dal piano");
  await form.getByRole("button", { name: "Salva comunque" }).click();
  await form.getByText("Trade registrato.").waitFor();

  await field("Strumento").fill("EURUSD");
  await field("Lotti").fill("1");
  await field("Esito").selectOption("SL");
  await form.getByRole("button", { name: "Registra trade" }).click();
  await form.getByText("Trade registrato.").waitFor();
  const trades = await page.evaluate(() => JSON.parse(localStorage.getItem("intini_journal_v9")).trades);
  check(trades.length === 2 && trades[0].pnl === 120 && trades[0].lots === 0.5, "trade confermato salvato con i numeri scritti");
  check(Math.abs(trades[1].pnl - -101.2) < 1e-9, "stop loss sul capitale dopo il trade precedente", String(trades[1].pnl));

  // 5. Correzione in place di un trade segnalato dal controllo dati
  await page.evaluate((l) => {
    localStorage.clear();
    localStorage.setItem("intini_pro_v8", l);
  }, legacy);
  await page.goto(BASE);
  await page.getByRole("button", { name: "Importa profilo mattia" }).click();
  await page.goto(BASE + "/settings");
  await page.getByText(/errori su 2 trade/).waitFor();
  const row = page.locator("li", { hasText: "Take profit con P&L non positivo" });
  await row.getByRole("link", { name: "Correggi" }).click();
  await page.getByText("Problemi trovati dal controllo dati").waitFor();
  const editForm = page.locator("form").first();
  check((await editForm.getByLabel("P&L (€)", { exact: true }).inputValue()) === "-120,00", "modifica: P&L registrato precompilato");
  await editForm.getByLabel("Esito", { exact: true }).selectOption("SL");
  await editForm.getByRole("button", { name: "Salva modifiche" }).click();
  await page.waitForURL(/\/settings/);
  await page.getByText(/errori su 1 trade/).waitFor();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("intini_journal_v9")).trades);
  const fixed = after.find((t) => t.id === "30");
  check(after.length === 31 && fixed.outcome === "SL" && fixed.pnl === -120, "modifica salvata sullo stesso trade, nessun duplicato");

  await browser.close();
}

run()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(() => {
    stop();
    console.log(failures ? `\n${failures} controlli falliti` : "\nE2E ok");
    process.exit(failures ? 1 : 0);
  });
