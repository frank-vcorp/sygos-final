import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back ? (
          <Link href={back.href} className="mb-1 inline-flex text-sm text-[var(--muted)] hover:text-[var(--accent)]">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a] md:text-[30px] md:leading-tight">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Cabecera operativa de detalle: identidad, estado, contexto y acción principal (guía §5.2–5.4). */
export function EntityDetailHeader({
  back,
  title,
  subtitle,
  status,
  meta,
  primaryAction,
  secondaryActions,
}: {
  back?: { href: string; label: string };
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  meta?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex text-sm text-[var(--muted)] hover:text-[var(--accent)]">
          ← {back.label}
        </Link>
      ) : null}
      <div className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-[0_1px_2px_rgba(20,37,30,0.05)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a] md:text-[28px]">{title}</h1>
              {status}
            </div>
            {subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{subtitle}</p> : null}
          </div>
        </div>
        {meta ? <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{meta}</div> : null}
        {primaryAction || secondaryActions ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">{primaryAction}</div>
            {secondaryActions ? <div className="flex flex-wrap items-center gap-3 text-sm">{secondaryActions}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function EntityMetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-0.5 text-[var(--ink)]">{children}</div>
    </div>
  );
}

/** Botón de ancla hacia el bloque de captura de la acción principal en la misma página. */
export function DetailAnchorButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      {children}
    </a>
  );
}

/** KPI accionable en panel (guía §11.2). */
export function KpiCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1f3a]">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-[var(--line)] bg-white p-4 outline-none transition-colors hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border border-[var(--line)] bg-white p-4">{body}</div>;
}

export function Button({
  children,
  tone = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" }) {
  const tones = {
    primary: "bg-[var(--accent)] text-white hover:opacity-90",
    ghost: "border border-[var(--line)] bg-white hover:bg-[#f7f8f9]",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${tones[tone]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function ActionLink({
  href,
  children,
  tone = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
  className?: string;
}) {
  const styles = tone === "primary"
    ? "bg-[var(--accent)] text-white"
    : "border border-[var(--line)] bg-white hover:bg-[#f7f8f9]";
  return <Link href={href} className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${styles} ${className}`}>{children}</Link>;
}

/** Clase compartida: folio o nombre principal en listados (§3.1 guía UX). */
export const recordLinkClass =
  "font-semibold text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

/** Relaciones navegables en detalle o texto corrido. */
export const inlineLinkClass =
  "font-medium text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

export function RecordLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${recordLinkClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${inlineLinkClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function ActiveFilters({
  items,
}: {
  items: Array<{ label: string; clearHref: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2" aria-label="Filtros activos">
      {items.map((item) => (
        <Link
          key={`${item.label}-${item.clearHref}`}
          href={item.clearHref}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        >
          <span>{item.label}</span>
          <span className="text-[var(--muted)]" aria-hidden>×</span>
        </Link>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const controlClass =
  "min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]";

export function FilterBar({ children, action, className = "" }: { children: React.ReactNode; action: string; className?: string }) {
  return <form className={`mb-4 flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`} action={action}>{children}</form>;
}

export function SegmentedNav({ items }: { items: Array<{ href: string; label: string; active: boolean }> }) {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Vistas">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium ${item.active ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"}`}>{item.label}</Link>
      ))}
    </nav>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[var(--line)] bg-white shadow-[0_1px_2px_rgba(20,37,30,0.05)] ${className}`}>{children}</section>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-white px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ListCap({ shown, cap = 100 }: { shown: number; cap?: number }) {
  if (shown < cap) return null;
  return <p className="mt-2 text-xs text-[var(--muted)]">Mostrando los primeros {cap}. Acota la búsqueda para ver el resto.</p>;
}

export function Alert({ tone, message }: { tone: "ok" | "error"; message: string }) {
  const styles =
    tone === "ok"
      ? "border-[#cfe0d6] bg-[var(--accent-soft)] text-[var(--ok)]"
      : "border-[#efd0d0] bg-[var(--danger-soft)] text-[var(--danger)]";
  return <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${styles}`}>{message}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-[#eef0f2] text-[#3d4650]",
    ok: "bg-[var(--accent-soft)] text-[var(--accent)]",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  };
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Table({ children, stickyHeader = false }: { children: React.ReactNode; stickyHeader?: boolean }) {
  return (
    <div
      className={
        stickyHeader
          ? "max-h-[calc(100dvh-11rem)] overflow-auto rounded-lg border border-[var(--line)] bg-white [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-white [&_thead_th]:shadow-[inset_0_-1px_0_var(--line)]"
          : "overflow-x-auto rounded-lg border border-[var(--line)] bg-white"
      }
    >
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function ResponsiveData({ table, cards }: { table: React.ReactNode; cards: React.ReactNode }) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="grid gap-3 md:hidden">{cards}</div>
    </>
  );
}

export function MobileCard({
  href,
  title,
  meta,
  children,
  footer,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  /** Fuera del enlace principal para permitir links anidados (p. ej. cliente). */
  footer?: React.ReactNode;
}) {
  const head = (
    <div className="flex min-h-6 items-start justify-between gap-3">
      <p className={href ? recordLinkClass : "font-semibold text-[#0b1f3a]"}>{title}</p>
      {meta}
    </div>
  );
  const body = children ? <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">{children}</div> : null;
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      {href ? (
        <Link href={href} className="block p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
          {head}
          {body}
        </Link>
      ) : (
        <div className="p-4">
          {head}
          {body}
        </div>
      )}
      {footer ? <div className="border-t border-[var(--line)] p-4 text-sm">{footer}</div> : null}
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">{children}</div>;
}

export function FormPanel({ children, className = "", ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props} className={`max-w-5xl overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_8px_30px_rgba(7,59,120,0.06)] ${className}`}>
      {children}
    </form>
  );
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const grids = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-2 xl:grid-cols-3" };
  return (
    <section className="border-b border-[var(--line)] p-5 md:p-7">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#0b1f3a]">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      <div className={`grid gap-4 ${grids[columns]}`}>{children}</div>
    </section>
  );
}

export function FormActions({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <footer className="flex flex-col-reverse gap-3 bg-[#f7fafc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
      {note ? <p className="text-xs text-[var(--muted)]">{note}</p> : <span />}
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </footer>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-[var(--line)] px-3 py-2 align-middle">{children}</td>;
}
