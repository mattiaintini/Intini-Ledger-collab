import Link from "next/link";
import { Children, cloneElement, isValidElement, useId, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { CheckStatus } from "@/lib/cot/verify";

/** Titolo grande (large title), sottotitolo di una riga, azioni della toolbar allineate sulla stessa linea. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.011em] md:text-[28px] md:leading-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Superficie raggruppata: separata dallo sfondo per riempimento, mai per bordo. */
export function Card({ className = "", children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={`rounded-[var(--radius-card)] bg-surface p-4 md:p-5 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {aside && <div className="text-[13px] text-muted">{aside}</div>}
    </div>
  );
}

/** Riquadro riassuntivo in stile Salute: etichetta, numero arrotondato grande, nota. */
export function Stat({ label, value, unit, hint, valueClass = "" }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] bg-surface p-4">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={`mt-1.5 truncate text-[28px] leading-[34px] tracking-[-0.01em] rounded-num ${valueClass}`} title={typeof value === "string" ? value : undefined}>
        {value}
        {unit && <span className="ml-1 text-[17px] font-semibold text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 truncate text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * primary: azione principale (pieno col colore del testo). tinted: pulsante di toolbar a riempimento.
 * plain: solo testo. danger: testo rosso, senza contorno.
 */
type Variant = "primary" | "solid" | "tinted" | "ghost" | "plain" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg active:opacity-80",
  solid: "bg-fg text-bg active:opacity-80",
  tinted: "bg-surface-3 text-fg active:bg-[var(--t-fill-2)]",
  ghost: "bg-surface-3 text-fg active:bg-[var(--t-fill-2)]",
  plain: "text-fg active:opacity-60",
  danger: "text-alert active:opacity-60",
};
type Size = "sm" | "md" | "lg";
const sizes: Record<Size, string> = {
  sm: "h-8 rounded-[8px] px-3 text-[13px]",
  md: "h-9 rounded-[10px] px-4 text-[15px]",
  lg: "h-[50px] rounded-[12px] px-5 text-[17px] font-semibold",
};
const btn = "inline-flex items-center justify-center gap-1.5 font-medium transition-[opacity,background-color] duration-150 disabled:opacity-35";

export function Button({ variant = "ghost", size = "md", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={`${btn} ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({ variant = "ghost", size = "md", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={`${btn} ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />;
}

/**
 * Etichetta collegata al controllo con htmlFor/id: il nome accessibile è esattamente `label`.
 * Errore e suggerimento sono collegati con aria-describedby. Per un gruppo di pulsanti usare `group`.
 */
export function Field({ label, error, hint, group, children }: { label: string; error?: string; hint?: string; group?: boolean; children: ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const msg = error ?? hint;
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, "aria-describedby": msg ? msgId : undefined })
    : children;
  return (
    <div className="flex flex-col gap-1.5" role={group ? "group" : undefined} aria-labelledby={group ? `${id}-label` : undefined}>
      {group ? (
        <span id={`${id}-label`} className="text-[13px] text-muted">{label}</span>
      ) : (
        <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      )}
      {control}
      {msg && (
        <span id={msgId} className={`text-[13px] ${error ? "text-alert" : "text-muted"}`} role={error ? "alert" : undefined}>
          {msg}
        </span>
      )}
    </div>
  );
}

/** Lista raggruppata inset (Impostazioni iOS/macOS): intestazione, righe separate da hairline, nota in fondo. */
export function Group({ header, footer, children, className = "" }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <section className={className}>
      {header && <h3 className="mb-1.5 px-4 text-[13px] text-muted">{header}</h3>}
      <div className="overflow-hidden rounded-[var(--radius-ui)] bg-surface">
        {rows.map((r, i) => (
          <div key={i} className={i > 0 ? "border-t-[0.5px] border-line ml-4" : ""}>
            <div className={i > 0 ? "-ml-4" : ""}>{r}</div>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 px-4 text-[13px] text-muted">{footer}</div>}
    </section>
  );
}

/**
 * Riga di una lista raggruppata: etichetta a sinistra, controllo a destra, altezza minima 44px.
 * Il controllo riceve id e aria-describedby come in Field.
 */
export function Row({ label, error, children, stacked = false }: { label: string; error?: string; children: ReactNode; stacked?: boolean }) {
  const id = useId();
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, "aria-describedby": error ? `${id}-err` : undefined })
    : children;
  return (
    <div className={`px-4 ${stacked ? "py-3" : "flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-1.5"}`}>
      <label htmlFor={id} className={`shrink-0 text-[15px] ${stacked ? "mb-2 block" : ""}`}>{label}</label>
      <div className={stacked ? "" : "flex min-w-0 flex-1 justify-end"}>{control}</div>
      {error && (
        <p id={`${id}-err`} role="alert" className={`text-[13px] text-alert ${stacked ? "mt-1" : "basis-full pb-1 text-right"}`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Controllo segmentato (UISegmentedControl): binario riempito, cursore in rilievo. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  className = "",
}: {
  label: string;
  value: T | "";
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-grid rounded-[9px] bg-surface-3 p-[2px] ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={`whitespace-nowrap rounded-[7px] px-3 transition-[background-color,box-shadow] duration-300 ease-[var(--ease-snappy)] ${size === "sm" ? "h-7 text-[13px]" : "h-8 text-[13px]"} ${
              on ? "bg-[var(--t-thumb)] font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : "font-medium text-fg"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

const STATUS: Record<CheckStatus, { label: string; dot: string }> = {
  pass: { label: "Verificato", dot: "bg-fg" },
  warn: { label: "Da controllare", dot: "bg-warn" },
  fail: { label: "Errore", dot: "bg-alert" },
  skip: { label: "Non verificabile", dot: "bg-subtle" },
};

export function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {label ?? s.label}
    </span>
  );
}

/** Stato vuoto (ContentUnavailableView): simbolo, titolo, spiegazione, eventuale azione. */
export function Empty({ title, children, icon: Icon = Inbox, action }: { title: string; children?: ReactNode; icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon size={40} strokeWidth={1.5} className="text-subtle" />
      <p className="mt-3 text-[17px] font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-[320px] text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
