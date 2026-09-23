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

/** Settimane dalla più recente. Le prime 12 visibili, le altre espandibili. */
export function WeekTable({ weeks }: { weeks: WeekVerification[] }) {
  const ordered = [...weeks].reverse();
  const head = ordered.slice(0, 12);
  const rest = ordered.slice(12);
  const table = (rows: WeekVerification[], withHead: boolean) => (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-sm">
        {withHead && (
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">Settimana</th>
              {COLS.map(([k, l]) => <th key={k} className="px-3 py-2 font-normal">{l}</th>)}
              <th className="px-3 py-2 font-normal">Dettaglio</th>
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-line"><Rows weeks={rows} /></tbody>
      </table>
    </div>
  );
  return (
    <div>
      {table(head, true)}
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer px-3 py-2 text-sm text-muted">Mostra altre {rest.length} settimane</summary>
          {table(rest, false)}
        </details>
      )}
      <p className="mt-4 text-xs text-subtle">
        Continuità: le variazioni pubblicate coincidono con la differenza dalla settimana prima. Bilancio OI: open interest uguale a reportable più non reportable, e reportable uguale a speculativi più spreading più commercial. Calendario: nessuna settimana mancante. File CFTC: ogni campo coincide con il file ufficiale della stessa data.
      </p>
    </div>
  );
}
