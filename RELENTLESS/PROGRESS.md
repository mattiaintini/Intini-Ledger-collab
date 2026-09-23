# Progress

| # | Iterazione | Gate | Note |
|---|---|---|---|
| 0 | Baseline (branch da `rebuild` 6ddcce6) | gate 0, 40 test | e2e e verify:cot live gia' verdi a mano, non ancora nel repo |
| 1 | G1 gate unico | gate 0, 40 test | `npm run gate` = tsc + eslint + vitest + next build |
| 2 | G5 parser numeri italiano | gate 0, 60 test | parseNum in tutti i form, P&L suggerito e avvisi con la virgola |
| 3 | G6 label/htmlFor | gate 0, 60 test | verifica a11y demandata all'e2e (getByLabel exact) |
| 4 | G7 resilienza COT | gate 0, 66 test | mercato mancante non blocca piu' il report: escluso e segnalato come errore |
| 5 | G4 modifica trade + fix e2e | gate 0, 73 test | e2e ha trovato capitale "10.000" letto come 10: corretto con parseNum money |
| 6 | Rilievi verificatore (journal) | gate 0, 73 test | drawdown % reale, BE per esito, ordine per inserimento nel contesto |
| 7 | Rilievi verificatore (COT) | gate 0, 73 test | copertura per anno, archivio non pubblicato, conflitto settimanale/annuale, shutdown = avviso |
| 8 | G2 e2e nel repo | e2e 59/59 (x2) | import v8, 12 pagine x 2 viewport, validazione form, etichette esatte, correzione in place |
