import Link from "next/link";
import type { ReactNode } from "react";

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return flattenText(props?.children);
  }
  return "";
}

function ColumnHeaderIcon({ label }: { label: string }) {
  const key = label.toLowerCase().trim();
  const baseProps = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-3.5 w-3.5 shrink-0 text-slate-400",
    "aria-hidden": true as const,
  };
  if (!key || key === "acción" || key === "acciones" || key === "opciones") {
    return null;
  }
  if (
    key.includes("cliente") ||
    key.includes("proveedor") ||
    key.includes("colaborador") ||
    key.includes("ejecutor") ||
    key.includes("vendedor") ||
    key.includes("técnico") ||
    key.includes("tecnico") ||
    key.includes("jefe") ||
    key.includes("solicitante") ||
    key.includes("responsable") ||
    key.includes("usuario") ||
    key.includes("contacto") ||
    key.includes("creado")
  ) {
    return (
      <svg {...baseProps}>
        <circle cx="8" cy="5.25" r="2.25" />
        <path d="M3.5 13.25c.55-2.1 2.2-3.25 4.5-3.25s3.95 1.15 4.5 3.25" />
      </svg>
    );
  }
  if (
    key.includes("fecha") ||
    key.includes("mes") ||
    key.includes("periodo") ||
    key.includes("vencimiento") ||
    key.includes("vence") ||
    key.includes("emisión") ||
    key.includes("registrado") ||
    key.includes("seguimiento") ||
    key.includes("crédito") ||
    key.includes("vacaciones") ||
    key.includes("sla") ||
    key.includes("horario") ||
    key.includes("día") ||
    key.includes("dia") ||
    key.includes("visita") ||
    key.includes("edición")
  ) {
    return (
      <svg {...baseProps}>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.25l2.25 1.25" />
      </svg>
    );
  }
  if (
    key.includes("importe") ||
    key.includes("saldo") ||
    key.includes("original") ||
    key.includes("total") ||
    key.includes("monto") ||
    key.includes("precio") ||
    key.includes("salario") ||
    key.includes("moneda") ||
    key.includes("cxc") ||
    key.includes("cxp") ||
    key.includes("valor") ||
    key.includes("costo") ||
    key.includes("transferencia") ||
    key.includes("comisión") ||
    key.includes("efectivo")
  ) {
    return (
      <svg {...baseProps}>
        <path d="M8 2.5v11M10.5 5H6.75a1.75 1.75 0 1 0 0 3.5h2.5a1.75 1.75 0 1 1 0 3.5H5.5" />
      </svg>
    );
  }
  if (
    key.includes("equipo") ||
    key.includes("motor") ||
    key.includes("identificación") ||
    key.includes("serie")
  ) {
    return (
      <svg {...baseProps}>
        <path d="M8 2.25 13.25 5.25v5.5L8 13.75 2.75 10.75v-5.5L8 2.25Z" />
        <path d="M2.75 5.25 8 8.25l5.25-3M8 8.25v5.5" />
      </svg>
    );
  }
  if (
    key.includes("estado") ||
    key.includes("tipo") ||
    key.includes("etapa") ||
    key.includes("prioridad") ||
    key.includes("dirección") ||
    key.includes("fuente") ||
    key.includes("rol")
  ) {
    return (
      <svg {...baseProps}>
        <circle cx="8" cy="8" r="5.25" />
        <circle cx="8" cy="8" r="1.75" fill="currentColor" />
      </svg>
    );
  }
  if (
    key.includes("folio") ||
    key.includes("factura") ||
    key === "os" ||
    key === "dx" ||
    key.includes("comprobante") ||
    key.includes("lista") ||
    key.includes("nombre") ||
    key.includes("concepto") ||
    key.includes("documento") ||
    key.includes("cotización") ||
    key.includes("nota") ||
    key.includes("descripción") ||
    key.includes("parte")
  ) {
    return (
      <svg {...baseProps}>
        <path d="M4.5 2.5h4.75L12.5 5.75v7.25a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z" />
        <path d="M9 2.5v3.5h3.5M6 8.5h4M6 11h2.5" />
      </svg>
    );
  }
  return (
    <svg {...baseProps}>
      <path d="M3 4.5h10M3 8h10M3 11.5h6.5" />
    </svg>
  );
}

function SegmentedTabIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  const baseProps = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-3.5 w-3.5 shrink-0 opacity-80",
    "aria-hidden": true as const,
  };
  if (key.includes("resumen") || key.includes("reciente") || key.includes("todas") || key.includes("todos")) {
    return (
      <svg {...baseProps}>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.25l2 1.25" />
      </svg>
    );
  }
  if (key.includes("ingreso")) {
    return (
      <svg {...baseProps}>
        <path d="M4.5 11.5 11.5 4.5M11.5 4.5H6M11.5 4.5V10" />
      </svg>
    );
  }
  if (key.includes("egreso") || key.includes("gasto")) {
    return (
      <svg {...baseProps}>
        <path d="M4.5 4.5 11.5 11.5M11.5 11.5H6M11.5 11.5V6" />
      </svg>
    );
  }
  if (key.includes("cuenta") || key.includes("banco") || key.includes("cxp") || key.includes("cxc")) {
    return (
      <svg {...baseProps}>
        <rect x="2.25" y="3.75" width="11.5" height="8.5" rx="1.5" />
        <path d="M2.25 6.75h11.5" />
      </svg>
    );
  }
  return (
    <svg {...baseProps}>
      <rect x="2.75" y="3" width="10.5" height="10" rx="1.5" />
      <path d="M5.25 6.5h5.5M5.25 9.5h3.5" />
    </svg>
  );
}

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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-800">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[30px] md:leading-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 max-w-3xl text-xs font-medium text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-800">
          ← {back.label}
        </Link>
      ) : null}
      <div className="border-b border-slate-200/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">{title}</h1>
              {status}
            </div>
            {subtitle ? <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {meta ? (
          <div className="mt-4 grid gap-x-8 gap-y-1.5 border-t border-slate-100 pt-3.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {meta}
          </div>
        ) : null}
        {primaryAction || secondaryActions ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3.5">
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
    <div className="flex items-baseline gap-2.5 rounded-md py-1">
      <span className="inline-flex min-w-[7.5rem] shrink-0 items-center gap-1.5 text-xs font-medium text-slate-400">
        <ColumnHeaderIcon label={label} />
        <span className="truncate">{label}</span>
      </span>
      <div className="min-w-0 flex-1 text-[13.5px] font-medium text-slate-800">{children}</div>
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

function KpiIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  const baseProps = {
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4 shrink-0",
    "aria-hidden": true as const,
  };
  if (key.includes("cobrado") || key.includes("ingreso") || key.includes("utilidad") || key.includes("flujo") || key.includes("valor")) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
        <svg {...baseProps}>
          <path d="M5 13 13 5M13 5H7M13 5v6" />
        </svg>
      </span>
    );
  }
  if (key.includes("egreso") || key.includes("cxp") || key.includes("deuda") || key.includes("compra")) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
        <svg {...baseProps}>
          <path d="M5 5l8 8M13 13H7M13 13V7" />
        </svg>
      </span>
    );
  }
  if (key.includes("vencid") || key.includes("sla") || key.includes("pendiente") || key.includes("por ") || key.includes("cxc")) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[#0a477e] ring-1 ring-sky-200/70">
        <svg {...baseProps}>
          <circle cx="9" cy="9" r="6.25" />
          <path d="M9 5.5v3.75l2.5 1.5" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
      <svg {...baseProps}>
        <path d="M3 13.5 7 9.5l2.75 2.75L15 6.5" />
        <path d="M11.5 6.5H15V10" />
      </svg>
    </span>
  );
}

/** KPI accionable en panel (guía §11.2). */
export function KpiCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <KpiIcon label={label} />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">{body}</div>;
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
  "inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-[#0a477e] underline decoration-slate-300/80 underline-offset-4 hover:decoration-[#0a477e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

/** Relaciones navegables en detalle o texto corrido. */
export const inlineLinkClass =
  "font-medium text-slate-800 hover:text-[#0a477e] underline decoration-slate-300/80 underline-offset-4 hover:decoration-[#0a477e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 rounded-sm";

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
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden>
        <path d="M4.5 2.5h4.75L12.5 5.75v7.25a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z" />
        <path d="M9 2.5v3.5h3.5" />
      </svg>
      <span>{children}</span>
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
  return (
    <form
      className={`mb-3 flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-center ${className} [&_input]:min-h-8 [&_input]:rounded-full [&_input]:border-slate-200/90 [&_input]:bg-slate-100/70 [&_input]:px-3.5 [&_input]:py-1 [&_input]:text-xs [&_input]:font-medium [&_input]:shadow-none [&_input:hover]:bg-slate-100 [&_input:focus]:bg-white [&_select]:min-h-8 [&_select]:rounded-full [&_select]:border-slate-200/90 [&_select]:bg-slate-100/70 [&_select]:px-3 [&_select]:py-1 [&_select]:text-xs [&_select]:font-medium [&_select]:shadow-none [&_select:hover]:bg-slate-100`}
      action={action}
    >
      {children}
    </form>
  );
}

export function SegmentedNav({ items }: { items: Array<{ href: string; label: string; active: boolean }> }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 overflow-x-auto py-1" aria-label="Vistas">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
            item.active
              ? "bg-slate-900/[0.07] font-semibold text-slate-900 ring-1 ring-slate-300/80"
              : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          <SegmentedTabIcon label={item.label} />
          <span>{item.label}</span>
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
    <div className="border-y border-slate-200/80 py-12 text-center">
      <div className="mx-auto mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100/80 text-slate-400" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
          <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M14 4v6h6M8 13h8M8 17h5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mx-auto mt-0.5 max-w-md text-xs text-slate-400">{body}</p>
      {action ? <div className="mt-3.5">{action}</div> : null}
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
          ? "max-h-[calc(100dvh-11rem)] overflow-auto border-b border-slate-200/80 bg-white [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-white [&_thead_th]:shadow-[inset_0_-1px_0_#e2e8f0]"
          : "overflow-x-auto border-b border-slate-200/80 bg-white"
      }
    >
      <table className="min-w-full text-left text-[13.5px] [&_tbody_tr:hover]:bg-slate-50/90">{children}</table>
    </div>
  );
}

export function ResponsiveData({ table, cards }: { table: React.ReactNode; cards: React.ReactNode }) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="divide-y divide-slate-200/80 border-y border-slate-200/80 md:hidden [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&>*:hover]:!bg-slate-50/90">{cards}</div>
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
    <footer data-form-actions className="sticky bottom-0 z-30 flex flex-col-reverse gap-2 rounded-b-xl border-t border-slate-200/80 bg-slate-50/80 px-5 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:px-7 print:static print:shadow-none" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      {note ? <p className="text-xs text-slate-500">{note}</p> : <span />}
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </footer>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  const label = flattenText(children);
  return (
    <th className="border-b border-slate-200/80 px-3 py-2.5 text-xs font-medium text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <ColumnHeaderIcon label={label} />
        <span>{children}</span>
      </span>
    </th>
  );
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
  const cellClass = ["border-b border-slate-100 px-3 py-2.5 align-middle text-[13.5px] text-slate-700", className].filter(Boolean).join(" ");
  return (
    <td colSpan={colSpan} className={cellClass}>
      {children}
    </td>
  );
}
