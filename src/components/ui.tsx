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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
      <div>
        {back ? (
          <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0a477e]">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[30px] md:leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
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
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0a477e]">
          ← {back.label}
        </Link>
      ) : null}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">{title}</h1>
              {status}
            </div>
            {subtitle ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
          </div>
        </div>
        {meta ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{meta}</div> : null}
        {primaryAction || secondaryActions ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200/80 pt-4">
            {primaryAction ? <div className="w-full min-w-0">{primaryAction}</div> : null}
            {secondaryActions ? (
              <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm">
                {secondaryActions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function EntityMetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-0.5 font-medium text-slate-900">{children}</div>
    </div>
  );
}

/** Botón de ancla hacia el bloque de captura de la acción principal en la misma página. */
const detailPrimaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-b from-[#0e5696] to-[#083d6e] hover:from-[#1162ab] hover:to-[#0a477e] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export function DetailAnchorButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={detailPrimaryButtonClass}>
      {children}
    </a>
  );
}

export function DetailFormSubmitButton({ form, children }: { form: string; children: React.ReactNode }) {
  return (
    <button type="submit" form={form} className={detailPrimaryButtonClass}>
      {children}
    </button>
  );
}

/** KPI accionable en panel (guía §11.2). */
export function KpiCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <div className="mb-3 h-1 w-8 rounded-full bg-gradient-to-r from-[#0e5696] to-sky-400" aria-hidden />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] outline-none transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]">{body}</div>;
}

export function Button({
  children,
  tone = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" }) {
  const tones = {
    primary:
      "bg-gradient-to-b from-[#0e5696] to-[#083d6e] hover:from-[#1162ab] hover:to-[#0a477e] text-white shadow-[0_1px_2px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.18)] font-semibold",
    ghost:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs font-medium",
    danger:
      "bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-[0_1px_2px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.16)] font-semibold",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${tones[tone]} ${props.className ?? ""}`}
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
  const styles =
    tone === "primary"
      ? "bg-gradient-to-b from-[#0e5696] to-[#083d6e] hover:from-[#1162ab] hover:to-[#0a477e] text-white shadow-[0_1px_2px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.18)] font-semibold"
      : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs font-medium";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Clase compartida: folio o nombre principal en listados (§3.1 guía UX). */
export const recordLinkClass =
  "font-semibold text-[#0a477e] hover:text-[#0d5ca1] hover:underline decoration-sky-500/40 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

/** Relaciones navegables en detalle o texto corrido. */
export const inlineLinkClass =
  "font-medium text-[#0a477e] hover:text-[#0d5ca1] hover:underline decoration-sky-500/40 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

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

/** Acción compacta para tablas; conserva el enlace semántico y un área táctil clara. */
export function TableActionLink({
  href,
  children,
  tone = "ghost",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
}) {
  const styles =
    tone === "primary"
      ? "bg-gradient-to-b from-[#0e5696] to-[#083d6e] hover:from-[#1162ab] hover:to-[#0a477e] text-white shadow-2xs"
      : "border border-slate-200/90 bg-white text-[#0a477e] shadow-2xs hover:border-sky-300 hover:bg-slate-50";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${styles}`}
    >
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
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-[#0a477e] hover:bg-sky-50/40 hover:text-[#0a477e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        >
          <span>{item.label}</span>
          <span className="text-slate-400" aria-hidden>×</span>
        </Link>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const controlClass =
  "min-h-11 w-full rounded-lg border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs outline-none focus:border-[#0a477e] focus:ring-3 focus:ring-[#0a477e]/15";

export { MoneyInput } from "@/components/money-input";

export function FilterBar({ children, action, className = "" }: { children: React.ReactNode; action: string; className?: string }) {
  return <form className={`mb-4 flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xs sm:flex-row sm:flex-wrap sm:items-center ${className}`} action={action}>{children}</form>;
}

export function SegmentedNav({ items }: { items: Array<{ href: string; label: string; active: boolean }> }) {
  return (
    <nav className="mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/70" aria-label="Vistas">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${
            item.active
              ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80"
              : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ${className}`}>{children}</section>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300/90 bg-white/90 px-6 py-11 text-center shadow-2xs">
      <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ListCap({ shown, cap = 100 }: { shown: number; cap?: number }) {
  if (shown < cap) return null;
  return <p className="mt-2 text-xs text-slate-500">Mostrando los primeros {cap}. Acota la búsqueda para ver el resto.</p>;
}

export function Alert({ tone, message }: { tone: "ok" | "error"; message: string }) {
  const styles =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
      : "border-rose-200 bg-rose-50/90 text-rose-800";
  return <div className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-2xs ${styles}`}>{message}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    warn: "bg-amber-50 text-amber-800 ring-amber-600/25",
    danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  const dots = {
    neutral: "bg-slate-400",
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    danger: "bg-rose-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export function Table({ children, stickyHeader = false }: { children: React.ReactNode; stickyHeader?: boolean }) {
  return (
    <div
      className={
        stickyHeader
          ? "max-h-[calc(100dvh-11rem)] overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50/95 [&_thead_th]:shadow-[inset_0_-1px_0_var(--line)]"
          : "overflow-x-auto overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      }
    >
      <table className="min-w-full text-left text-sm [&_tbody_tr:nth-child(even)]:bg-[#f8fafc] [&_tbody_tr:hover]:bg-[#eef6fb]">{children}</table>
    </div>
  );
}

export function ResponsiveData({ table, cards }: { table: React.ReactNode; cards: React.ReactNode }) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="grid gap-3 md:hidden [&>*:nth-child(even)]:!bg-[#f8fafc] [&>*:hover]:!bg-[#eef6fb]">{cards}</div>
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
      <p className={href ? recordLinkClass : "font-semibold text-slate-900"}>{title}</p>
      {meta}
    </div>
  );
  const body = children ? <div className="mt-2 space-y-1 text-sm text-slate-600">{children}</div> : null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
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
      {footer ? <div className="border-t border-slate-200/80 bg-slate-50/40 p-4 text-sm">{footer}</div> : null}
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">{children}</div>;
}

export function FormPanel({ children, className = "", ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props} data-form-panel="" className={`max-w-5xl overflow-visible rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ${className}`}>
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
    <section className="border-b border-slate-200/80 p-5 last:border-b-0 md:p-8">
      <div className="mb-6 border-l-[3px] border-[#0e5696] pl-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <div className={`grid gap-4 ${grids[columns]}`}>{children}</div>
    </section>
  );
}

/** Bloque temático dentro de un formulario (cliente, conceptos, etc.). */
export function FormBlock({
  title,
  description,
  children,
  columns = 2,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: 1 | 2;
  tone?: "default" | "muted";
}) {
  const grids = { 1: "", 2: "sm:grid-cols-2" };
  const surface =
    tone === "muted"
      ? "border-slate-200/80 bg-slate-50/70"
      : "border-slate-200/80 bg-white";
  return (
    <section className={`rounded-xl border ${surface} p-4 md:p-5`}>
      <header className="mb-4 border-l-[3px] border-[#0e5696] pl-3">
        <h3 className="text-sm font-bold tracking-tight text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p> : null}
      </header>
      <div className={`grid gap-4 ${grids[columns]}`}>{children}</div>
    </section>
  );
}

export function FormActions({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <footer data-form-actions className="sticky bottom-0 z-30 flex flex-col-reverse gap-2 rounded-b-xl border-t border-slate-200/80 bg-slate-50/95 px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:px-7 print:static print:shadow-none" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      {note ? <p className="text-xs text-slate-500">{note}</p> : <span />}
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </footer>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200/90 bg-slate-50/95 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">{children}</th>;
}

export function Td({
  children,
  colSpan,
  className,
}: {
  children: React.ReactNode;
  colSpan?: number;
  className?: string;
}) {
  const cellClass = ["border-b border-slate-200/70 px-4 py-3 align-middle text-slate-800", className].filter(Boolean).join(" ");
  return (
    <td colSpan={colSpan} className={cellClass}>
      {children}
    </td>
  );
}
