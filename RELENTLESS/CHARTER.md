# CHARTER, relentless/v9-hardening

## Goal
Portare la v9 (branch `rebuild`) da "funziona" a "verificata end to end": ogni flusso che tocca i dati
(COT e journal) ha un controllo automatico riproducibile, e gli errori trovati dal controllo dati si
possono correggere dentro l'app.

## Definition of Done
1. **Gate unico**: `npm run gate` (typecheck + lint + test + build) esce con 0.
2. **E2E nel repo**: `npm run e2e` (playwright-core + Chrome di sistema, server di produzione locale)
   esce con 0: tutte le pagine desktop e mobile senza errori console e senza overflow orizzontale,
   import v8 con conteggi attesi, flusso di validazione del form.
3. **COT live**: `npm run verify:cot` esce con 0 sui dati CFTC attuali.
4. **Modifica trade**: un trade segnalato dal controllo dati si corregge in place con le stesse regole
   dell'inserimento; l'e2e corregge il TP registrato in perdita e verifica che gli errori scendano.
5. **Numeri in formato italiano**: parser unico che accetta `1.234,56`, `1234,56`, `1234.56`;
   P&L suggerito mostrato con la virgola. Coperto da unit test.
6. **Accessibilità dei campi**: ogni campo ha nome accessibile uguale all'etichetta (label/htmlFor);
   l'e2e usa `getByLabel(..., { exact: true })` su tutti i campi.
7. **Resilienza COT**: con file grezzi CFTC irraggiungibili il report si genera con stato `warn`
   e confronto `skip`; con API irraggiungibile la generazione fallisce (nessun dato non verificato).
   Coperto da unit test con fetch simulato.

## Verification Gate
`npm run gate && npm run e2e && npm run verify:cot`

## Scope (allowlist)
`src/`, `scripts/`, `e2e/`, `package.json`, `package-lock.json`, `README.md`, `vercel.json`,
`vitest.config.mts`, `RELENTLESS/` nel repo `~/intini-journal-suite`.

## Off-limits
- `legacy/` (riferimento della v8, non si tocca).
- `git push`, merge su `main`, qualsiasi deploy di produzione, impostazioni dei progetti Vercel.
- Nessuna scrittura su servizi esterni: la CFTC si legge soltanto.

## Stop conditions
Tutti i goal verificati dal gate; oppure goal bloccato da azione irreversibile/credenziale mancante
(si parcheggia e si prosegue); oppure 3 iterazioni consecutive senza miglioramento del gate.

## Parcheggiati in partenza
- **Deploy di produzione** (merge `rebuild` su `main`): azione su stato condiviso, serve l'ok di Mattia.
- **Verifica live della preview Vercel**: le preview rispondono 302 (Vercel Authentication sul team
  `mattias-projects-656cb1e8`, account non collegato a questa sessione).
