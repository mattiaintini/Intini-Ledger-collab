# Intini Journal Suite v9

Trading journal con statistiche verificate e report COT della CFTC controllato settimana per settimana.
Next.js 16 (App Router), deploy su Vercel.

## Sezioni

- **Dashboard, Journal, Analytics, Calendar**: journal dei trade salvato nel browser (localStorage, chiave `intini_journal_v9`). I dati della v8 (`intini_pro_v8`) si importano dall'onboarding o da Settings, con report di ogni correzione.
- **COT Report**: posizionamento Non-Commercial e Commercial per 13 mercati, COT Index a 26 settimane, 52 settimane e 3 anni.
- **Tools**: position size e Monte Carlo. **News**: calendario macro TradingView.

## Verifica dei dati

**COT** (`src/lib/cot/`). Fonte primaria: API CFTC Socrata (dataset `6dca-aqww`, Legacy Futures Only), 157 settimane per mercato. Ogni settimana deve superare:

1. **Confronto fonti**: ogni campo uguale al file grezzo ufficiale CFTC della stessa data (`deafut.txt` e archivi annuali `deacot{YYYY}.zip`).
2. **Continuità**: le variazioni pubblicate uguali alla differenza dalla settimana precedente.
3. **Bilancio**: OI = reportable + non reportable; reportable = speculativi + spreading + commercial.
4. **Calendario**: nessuna settimana mancante.
5. **Aggiornamento**: ultimo report uguale a quello atteso dal calendario di pubblicazione (venerdì 15:30 ET).

Le pagine COT si rigenerano ogni ora. Il cron `/api/cron/verify-cot` (sabato 07:00 UTC) ripete la verifica senza cache e risponde 500 se qualcosa non torna.

**Journal** (`src/lib/journal/validate.ts`). Errori bloccanti: data futura o invalida, take profit in perdita, stop loss in profitto, lotti o rischio non validi. Avvisi con conferma: P&L oltre il 25% dal piano (capitale × rischio × RR), rischio oltre il limite giornaliero, perdita del giorno oltre il limite, doppioni. Lo stesso controllo gira su tutto lo storico in Settings.

## Comandi

```bash
npm run dev          # sviluppo
npm test             # 40 test: parser, verifiche e statistiche su fixture reali CFTC
npm run verify:cot   # verifica completa sui dati CFTC live, exit 1 se una settimana non torna
npm run build
```

Opzionale: `CRON_SECRET` su Vercel protegge l'endpoint del cron.

La v8 (HTML singolo) resta in `legacy/index.html` come riferimento.
