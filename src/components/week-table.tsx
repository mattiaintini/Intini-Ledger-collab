import type { CheckStatus, WeekVerification } from "@/lib/cot/verify";
import { dateIT } from "@/lib/format";

const MARK: Record<CheckStatus, { t: string; cls: string; title: string }> = {
  pass: { t: "ok", cls: "text-pos", title: "Controllo superato" },
  fail: { t: "errore", cls: "text-neg", title: "Controllo fallito" },
  warn: { t: "avviso", cls: "text-warn", title: "Da controllare" },
  skip: { t: "n/a", cls: "text-subtle", title: "Non verificabile" },
};

function Mark({ s }: { s: CheckStatus }) {
  const m = MARK[s];
  return <span title={m.title} className={`text-xs ${m.cls}`}>{m.t}</span>;
}

const COLS = [
  ["continuity", "Continuità"],
  ["balance", "Bilancio OI"],
  ["calendar", "Calendario"],
  ["source", "File CFTC"],
] as const;

function Rows({ weeks }: { weeks: WeekVerification[] }) {
  return (
    <>
      {weeks.map((w) => (
        <tr key={w.date} className="align-top">
          <td className="num whitespace-nowrap px-3 py-2">{dateIT(w.date)}</td>
          {COLS.map(([k]) => (
            <td key={k} className="px-3 py-2"><Mark s={w[k]} /></td>
          ))}
          <td className="px-3 py-2 text-xs text-neg">{w.issues.join("; ")}</td>
        </tr>
      ))}
    </>
  );
}

/**
 * Riepilogo in una riga; le settimane con errori sono sempre visibili, le altre si aprono a richiesta.
 */
export function WeekTable({ weeks }: { weeks: WeekVerification[] }) {
  const ordered = [...weeks].reverse();
  const failed = ordered.filter((w) => w.status === "fail");
  const crossChecked = weeks.filter((w) => w.source === "pass").length;
  const table = (rows: WeekVerification[]) => (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-normal">Settimana</th>
            {COLS.map(([k, l]) => <th key={k} className="px-3 py-2 font-normal">{l}</th>)}
            <th className="px-3 py-2 font-normal">Dettaglio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line"><Rows weeks={rows} /></tbody>
      </table>
    </div>
  );
  return (
    <div>
      <p className="text-sm">
        {weeks.length} settimane controllate, <span className={failed.length ? "text-neg" : ""}>{failed.length} con errori</span>, {crossChecked} confrontate col file CFTC.
      </p>
      {failed.length > 0 && <div className="mt-4">{table(failed)}</div>}
      <details className="mt-3">
        <summary className="cursor-pointer py-2 text-sm text-muted">Dettaglio di tutte le settimane</summary>
        {table(ordered)}
      </details>
      <p className="mt-4 text-xs text-subtle">
        Continuità: le variazioni pubblicate coincidono con la differenza dalla settimana prima. Bilancio OI: open interest uguale a reportable più non reportable, e reportable uguale a speculativi più spreading più commercial. Calendario: nessuna settimana mancante. File CFTC: ogni campo coincide con il file ufficiale della stessa data.
      </p>
    </div>
  );
}
