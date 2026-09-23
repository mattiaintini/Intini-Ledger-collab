// E2E sull'app di produzione locale: npm run build && npm run e2e
// Avvia `next start`, usa Chrome di sistema (CHROME_PATH per cambiarlo), esce con 1 al primo controllo fallito.
// SHOTS=<cartella> salva gli screenshot di ogni pagina.
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

// E2E_BASE=https://... prova un deploy già online invece di avviare il server locale.
const PORT = 3999;
const REMOTE = process.env.E2E_BASE;
const BASE = REMOTE ?? `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = process.env.SHOTS;
const legacy = readFileSync(new URL("./fixtures/legacy-v8.json", import.meta.url), "utf8");

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
};

const server = REMOTE ? null : spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore" });
const stop = () => server?.kill("SIGTERM");
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

    check((await page.getByRole("heading", { name: /Your markets/ }).count()) === 1, `${tag} COT: i mercati del journal in testa`);
    const firstMine = (await page.locator("section", { hasText: "Your markets" }).locator(tag === "desktop" ? "tbody tr" : "a").first().innerText()).split("\n")[0];
    check(firstMine.startsWith("Oro"), `${tag} COT: primo mercato = il più tradato (oro)`, firstMine);
    check((await page.getByText("Verificato", { exact: true }).count()) === 1, `${tag} COT: un solo badge (il riepilogo) quando tutto torna`);

    // 4. Proposte del QA UX
    await page.goto(BASE + "/journal");
    check((await page.getByRole("img", { name: "Da correggere" }).count()) === 2, `${tag} journal: trade incoerenti marcati`);
    await page.goto(BASE + "/tools");
    const eq = await page.getByLabel("Equity attuale", { exact: true }).inputValue();
    check(eq === "11729", `${tag} position size sull'equity attuale, non sul capitale iniziale`, eq);
    await page.goto(BASE + "/calendar");
    await page.getByRole("button", { name: "Mese precedente" }).click();
    const cal = await page.locator("main").innerText();
    check(!cal.includes("…") && /[+-]\d/.test(cal), `${tag} calendario: P&L leggibile nelle celle`);
    await page.goto(BASE + "/news");
    const newsRows = await page.locator("main li").count();
    const newsFallback = await page.getByText("non ha risposto").count();
    check(newsRows > 0 || newsFallback === 1, `${tag} news: eventi in tabella o messaggio di fonte non disponibile`, `${newsRows} eventi`);
    if (newsRows === 0) console.log(`WARN ${tag} news: ForexFactory non disponibile in questo momento (rate limit), tabella non verificata`);
    await page.goto(BASE + "/settings");
    await page.getByRole("button", { name: "Reimporta profilo mattia" }).click();
    check((await page.getByRole("button", { name: /Conferma: sostituisce 31 trade/ }).count()) === 1, `${tag} reimport: il primo click chiede conferma`);
    const stillSame = await page.evaluate(() => JSON.parse(localStorage.getItem("intini_journal_v9")).trades.length);
    check(stillSame === 31, `${tag} reimport: nessuna sostituzione senza conferma`);

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
  await form.getByRole("group", { name: "Esito" }).getByRole("button", { name: "Take profit" }).click();
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
  await form.getByRole("group", { name: "Esito" }).getByRole("button", { name: "Stop loss" }).click();
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
  await page.getByRole("link", { name: /Take profit con P&L non positivo/ }).click();
  await page.getByText("Problemi trovati dal controllo dati").waitFor();
  const editForm = page.locator("form").first();
  check((await editForm.getByLabel("P&L (€)", { exact: true }).inputValue()) === "-120,00", "modifica: P&L registrato precompilato");
  await editForm.getByRole("group", { name: "Esito" }).getByRole("button", { name: "Stop loss" }).click();
  await editForm.getByRole("button", { name: "Salva modifiche" }).click();
  await page.waitForURL(/\/settings/);
  await page.getByText(/errori su 1 trade/).waitFor();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("intini_journal_v9")).trades);
  const fixed = after.find((t) => t.id === "30");
  check(after.length === 31 && fixed.outcome === "SL" && fixed.pnl === -120, "modifica salvata sullo stesso trade, nessun duplicato");

  // 6. Password: il journal viene cifrato nel browser e si riapre solo con la password o la recovery key
  await page.goto(BASE + "/settings");
  await page.getByLabel("Nuova password", { exact: true }).fill("Prova#2026");
  await page.getByLabel("Ripeti password", { exact: true }).fill("Prova#2026");
  await page.getByRole("button", { name: "Proteggi con password" }).click();
  await page.getByText("Recovery key, conservala ora").waitFor({ timeout: 20000 });
  const recovery = (await page.locator("p.select-all").innerText()).trim();
  const raw = await page.evaluate(() => localStorage.getItem("intini_journal_v9"));
  check(!raw.includes("XAUUSD") && !raw.includes("trades") && raw.includes('"vault":1'), "dati cifrati nel browser, nessun trade in chiaro");
  await page.reload();
  await page.getByText("Journal bloccato").waitFor();
  check(true, "alla riapertura il journal è bloccato");
  await page.getByLabel("Password", { exact: true }).fill("sbagliata");
  await page.getByRole("button", { name: "Sblocca" }).click();
  await page.getByText("Password errata").waitFor({ timeout: 20000 });
  check(true, "password errata rifiutata");
  await page.getByRole("button", { name: /recovery key/ }).click();
  await page.getByLabel("Recovery key", { exact: true }).fill(recovery.toLowerCase());
  await page.getByRole("button", { name: "Sblocca" }).click();
  await page.getByText("Sicurezza").waitFor({ timeout: 20000 });
  const unlocked = await page.evaluate(() => document.body.innerText.includes("31 trade"));
  check(unlocked, "sbloccato con la recovery key, 31 trade intatti");

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
