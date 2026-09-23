import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { CheckStatus } from "@/lib/cot/verify";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className = "", children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-surface p-5 md:p-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-medium text-fg">{children}</h2>
      {aside && <div className="text-xs text-subtle">{aside}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, valueClass = "" }: { label: string; value: ReactNode; hint?: ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-2 text-xl font-semibold tracking-[-0.02em] md:text-2xl ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

type Variant = "primary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover",
  ghost: "border border-line text-fg hover:border-line-strong",
  danger: "border border-neg/40 text-neg hover:border-neg",
};
const btn = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-ui)] px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40";

export function Button({ variant = "ghost", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${btn} ${variants[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({ variant = "ghost", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${btn} ${variants[variant]} ${className}`} {...rest} />;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">{label}</span>
        {children}
      </label>
      {error ? <span className="text-xs text-neg" role="alert">{error}</span> : hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </div>
  );
}

const STATUS: Record<CheckStatus, { label: string; cls: string }> = {
  pass: { label: "Verificato", cls: "border-pos/30 text-pos" },
  warn: { label: "Da controllare", cls: "border-warn/30 text-warn" },
  fail: { label: "Errore", cls: "border-neg/40 text-neg" },
  skip: { label: "Non verificabile", cls: "border-line text-subtle" },
};

export function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${s.cls}`}>{label ?? s.label}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
