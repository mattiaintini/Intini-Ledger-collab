// Contratti monitorati nel report COT legacy (futures only).
// Il codice è il "CFTC Contract Market Code": identico nell'API Socrata e nei file grezzi CFTC.

export type MarketGroup = "Valute" | "Metalli" | "Energia" | "Indici" | "Crypto";

export interface CotMarket {
  key: string;
  code: string;
  label: string;
  symbol: string;
  group: MarketGroup;
}

export const COT_MARKETS: CotMarket[] = [
  { key: "eur", code: "099741", label: "Euro", symbol: "EURUSD", group: "Valute" },
  { key: "gbp", code: "096742", label: "Sterlina", symbol: "GBPUSD", group: "Valute" },
  { key: "jpy", code: "097741", label: "Yen", symbol: "USDJPY", group: "Valute" },
  { key: "aud", code: "232741", label: "Dollaro australiano", symbol: "AUDUSD", group: "Valute" },
  { key: "cad", code: "090741", label: "Dollaro canadese", symbol: "USDCAD", group: "Valute" },
  { key: "chf", code: "092741", label: "Franco svizzero", symbol: "USDCHF", group: "Valute" },
  { key: "dxy", code: "098662", label: "Dollar Index", symbol: "DXY", group: "Valute" },
  { key: "gold", code: "088691", label: "Oro", symbol: "XAUUSD", group: "Metalli" },
  { key: "silver", code: "084691", label: "Argento", symbol: "XAGUSD", group: "Metalli" },
  { key: "wti", code: "067651", label: "Petrolio WTI", symbol: "USOIL", group: "Energia" },
  { key: "es", code: "13874A", label: "S&P 500 E-mini", symbol: "US500", group: "Indici" },
  { key: "nq", code: "209742", label: "Nasdaq 100 E-mini", symbol: "US100", group: "Indici" },
  { key: "btc", code: "133741", label: "Bitcoin CME", symbol: "BTCUSD", group: "Crypto" },
];

export const MARKET_BY_CODE = new Map(COT_MARKETS.map((m) => [m.code, m]));
