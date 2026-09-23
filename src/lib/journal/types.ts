export const SESSIONS = ["ASIA", "LDN", "NY"] as const;
export const TRADE_TYPES = ["SCALP", "INTRA", "SWING"] as const;
export const DIRECTIONS = ["LONG", "SHORT"] as const;
export const GRADES = ["A", "B", "C"] as const;
export const OUTCOMES = ["TP", "SL", "BE"] as const;
export const CURRENCIES = ["€", "$", "£"] as const;

export type Session = (typeof SESSIONS)[number];
export type TradeType = (typeof TRADE_TYPES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Grade = (typeof GRADES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Currency = (typeof CURRENCIES)[number];

export const SESSION_LABEL: Record<Session, string> = { ASIA: "Asia", LDN: "Londra", NY: "New York" };
export const TYPE_LABEL: Record<TradeType, string> = { SCALP: "Scalping", INTRA: "Intraday", SWING: "Swing" };
export const OUTCOME_LABEL: Record<Outcome, string> = { TP: "Take profit", SL: "Stop loss", BE: "Break even" };

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM oppure ""
  asset: string;
  session: Session;
  type: TradeType;
  direction: Direction;
  lots: number;
  /** Rischio in % del capitale al momento del trade. */
  riskPct: number;
  /** Rapporto rischio/rendimento pianificato. */
  rr: number;
  grade: Grade;
  outcome: Outcome;
  pnl: number;
  notes: string;
  /** Immagine compressa in data URL (facoltativa). */
  image?: string;
  /** Massima escursione avversa e favorevole in R, inserite a mano (facoltative, mai stimate). */
  maeR?: number;
  mfeR?: number;
  /** Durata in minuti (facoltativa). */
  durationMin?: number;
  createdAt: number;
}

export interface Profile {
  name: string;
  capital: number;
  currency: Currency;
  maxDailyLossPct: number;
}

export interface Journal {
  version: 9;
  profile: Profile;
  trades: Trade[];
}

export const STORAGE_KEY = "intini_journal_v9";
export const LEGACY_STORAGE_KEY = "intini_pro_v8";

export const DEFAULT_PROFILE: Profile = { name: "", capital: 10000, currency: "€", maxDailyLossPct: 2 };
