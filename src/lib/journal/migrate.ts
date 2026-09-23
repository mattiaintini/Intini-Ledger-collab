import { auditJournal } from "./validate";
import {
  CURRENCIES,
  DEFAULT_PROFILE,
  DIRECTIONS,
  GRADES,
  OUTCOMES,
  SESSIONS,
  TRADE_TYPES,
  type Currency,
  type Journal,
  type Trade,
} from "./types";

// Importa i dati della v8 (chiave localStorage "intini_pro_v8", un oggetto per utente).
// Nessun trade viene scartato in silenzio: ogni correzione o scarto finisce nel report.

interface LegacyTrade {
  id?: unknown;
  date?: unknown;
  time?: unknown;
  asset?: unknown;
  session?: unknown;
  type?: unknown;
  direction?: unknown;
  lots?: unknown;
  risk?: unknown;
  rr?: unknown;
  grade?: unknown;
  outcome?: unknown;
  pnl?: unknown;
  notes?: unknown;
  image?: unknown;
}

interface LegacyUser {
  capital?: unknown;
  currency?: unknown;
  maxLossPct?: unknown;
  trades?: LegacyTrade[];
}

export interface MigrationReport {
  imported: number;
  rejected: { index: number; reason: string }[];
  corrections: string[];
}

export function listLegacyUsers(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Record<string, LegacyUser>;
    return Object.keys(data).filter((k) => typeof data[k] === "object" && data[k] !== null);
  } catch {
    return [];
  }
}

const num = (v: unknown) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) =>
  allowed.includes(String(v).toUpperCase() as T) ? (String(v).toUpperCase() as T) : fallback;

export function migrateLegacy(raw: string, user: string, today?: string): { journal: Journal; report: MigrationReport } {
  const data = JSON.parse(raw) as Record<string, LegacyUser>;
  const u = data[user];
  if (!u) throw new Error(`Utente ${user} non trovato nei dati v8`);

  const capital = num(u.capital);
  const report: MigrationReport = { imported: 0, rejected: [], corrections: [] };
  const profile = {
    ...DEFAULT_PROFILE,
    name: user,
    capital: Number.isFinite(capital) && capital > 0 ? capital : DEFAULT_PROFILE.capital,
    currency: (CURRENCIES.includes(u.currency as Currency) ? u.currency : "€") as Currency,
    maxDailyLossPct: Number.isFinite(num(u.maxLossPct)) && num(u.maxLossPct) > 0 ? num(u.maxLossPct) : DEFAULT_PROFILE.maxDailyLossPct,
  };
  if (profile.capital !== capital) report.corrections.push(`Capitale iniziale non valido, impostato a ${profile.capital}`);

  const trades: Trade[] = [];
  (u.trades ?? []).forEach((lt, index) => {
    const label = `Trade ${index + 1}${lt.date ? ` del ${String(lt.date)}` : ""}`;
    const date = String(lt.date ?? "");
    const pnl = num(lt.pnl);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return report.rejected.push({ index, reason: `${label}: data mancante o non valida` });
    if (!Number.isFinite(pnl)) return report.rejected.push({ index, reason: `${label}: P&L non numerico` });

    const lots = num(lt.lots);
    const riskPct = num(lt.risk);
    const rr = num(lt.rr);
    const t: Trade = {
      id: String(lt.id ?? `${Date.parse(date)}-${index}`),
      date,
      time: /^\d{2}:\d{2}$/.test(String(lt.time ?? "")) ? String(lt.time) : "",
      asset: String(lt.asset ?? "").toUpperCase().trim() || "N/D",
      session: pick(lt.session, SESSIONS, "LDN"),
      type: pick(lt.type, TRADE_TYPES, "INTRA"),
      direction: pick(lt.direction, DIRECTIONS, "LONG"),
      lots: Number.isFinite(lots) ? lots : 0,
      riskPct: Number.isFinite(riskPct) ? riskPct : 0,
      rr: Number.isFinite(rr) ? rr : 0,
      grade: pick(lt.grade, GRADES, "B"),
      // senza esito lo si deduce dal segno del risultato, e lo si dichiara
      outcome: OUTCOMES.includes(lt.outcome as Trade["outcome"])
        ? (lt.outcome as Trade["outcome"])
        : pnl > 0 ? "TP" : pnl < 0 ? "SL" : "BE",
      pnl,
      notes: typeof lt.notes === "string" ? lt.notes : "",
      image: typeof lt.image === "string" && lt.image.startsWith("data:image/") ? lt.image : undefined,
      createdAt: Number.isFinite(num(lt.id)) ? num(lt.id) : index,
    };
    if (!OUTCOMES.includes(lt.outcome as Trade["outcome"])) report.corrections.push(`${label}: esito assente, dedotto dal P&L (${t.outcome})`);
    if (!SESSIONS.includes(String(lt.session).toUpperCase() as Trade["session"])) report.corrections.push(`${label}: sessione assente, impostata Londra`);
    trades.push(t);
  });

  const journal: Journal = { version: 9, profile, trades };
  // I dati importati passano dalle stesse regole dell'inserimento: gli errori restano visibili nel controllo dati.
  const flagged = new Set(auditJournal(journal, today).filter((i) => i.level === "error").map((i) => i.tradeId)).size;
  if (flagged) report.corrections.push(`${flagged} trade importati hanno dati incoerenti: li trovi in Impostazioni, controllo dati`);
  report.imported = trades.length;
  return { journal, report };
}
