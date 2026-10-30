import { Suspense } from "react";
import { redirect } from "next/navigation";
import { logoutAction, switchCompanyAction, viewAsAction } from "@/app/auth-actions";
import { FlashBanner } from "@/components/flash-banner";
import { ErpShell } from "@/components/erp-shell";
import { SideNav } from "@/components/side-nav";
import { prisma, sandboxFor } from "@/lib/db";
import { takeFlash } from "@/lib/flash";
import { navLabel } from "@/lib/nav-labels";
import { navGroupsForRole } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import { ROLE_LABEL, isRole } from "@/lib/roles";
import { getSession } from "@/lib/session";

type NavLink = {
  href: string;
  label: string | ((code: string | null) => string);
  show: (role: Parameters<typeof can>[0], code: string | null) => boolean;
  createHref?: string;
  showCreate?: (role: Parameters<typeof can>[0], code: string | null) => boolean;
};

const LABELS: Record<string, string | ((code: string | null) => string)> = {
  "/panel": "Inicio",
  "/clientes": "Clientes",
  "/prospectos": "Prospectos",
  "/cotizaciones": "Cotizaciones",
  "/ventas": "Ventas",
  "/agenda": "Agenda",
  "/facturacion": "Facturación",
  "/cobranza": "Cobranza",
  "/pagos": "Pagos",
  "/compras": "Compras",
  "/compras/requerimientos": "Requerimientos",
  "/compras/listas": "Listas de compras",
  "/finanzas": "Finanzas",
  "/personal": "Colaboradores",
  "/personal/asistencia": "Asistencia",
  "/personal/horas": "Horas extra",
  "/personal/vacaciones": "Vacaciones",
  "/nomina": "Nómina",
  "/comisiones": "Comisiones",
  "/produccion": "Producción",
  "/reportes": "Reportes",
  "/kiosco": "Kiosco",
  "/servicios": "Servicios",
  "/servicios/activos": "Activos",
  "/servicios/historial": "Historial",
  "/servicios/diagnostico": "Diagnósticos",
  "/servicios/reparacion": "Reparaciones",
  "/servicios/garantia": "Garantías",
  "/operacion": "En proceso",
  "/equipos": "Equipos",
  "/motores": "Motores",
  "/custodia": (code) => (code === "SERVOMOTORES" ? "Custodia" : "Almacén"),
  "/inventario": "Inventario",
  "/proveedores": "Proveedores",
  "/usuarios": "Usuarios",
  "/configuracion": "Configuración",
  "/pruebas": "Modo de pruebas",
};

const CREATE: Partial<Record<string, { href: string; show: NavLink["showCreate"] }>> = {
  "/clientes": { href: "/clientes/nuevo", show: (role, code) => can(role, "client.create", code) },
  "/prospectos": { href: "/prospectos/nuevo", show: (role, code) => can(role, "prospect.operate", code) },
  "/cotizaciones": { href: "/cotizaciones/nuevo", show: (role, code) => can(role, "quote.create", code) },
  "/ventas": { href: "/ventas/nuevo", show: (role, code) => can(role, "quote.create", code) },
  "/facturacion": { href: "/facturacion/nuevo", show: (role, code) => can(role, "invoice.issue", code) },
  "/pagos": { href: "/pagos?nuevo=1", show: (role, code) => can(role, "payment.register", code) },
  "/compras": { href: "/compras/nueva", show: (role, code) => can(role, "purchase.operate", code) },
  "/personal": { href: "/personal?nuevo=1", show: (role) => can(role, "personnel.authorize") },
  "/servicios/activos": { href: "/servicios/nuevo", show: (role, code) => can(role, "attention.create", code) },
  "/equipos": { href: "/equipos/nuevo", show: (role, code) => can(role, "equi.create", code) },
  "/motores": { href: "/motores/nuevo", show: (role, code) => can(role, "mot.create", code) },
  "/proveedores": { href: "/proveedores/nuevo", show: (role, code) => can(role, "supplier.operate", code) },
  "/compras/requerimientos": { href: "/compras/requerimientos/nuevo", show: (role, code) => can(role, "purchase.requirement.create", code) },
  "/compras/listas": { href: "/compras/listas/nueva", show: (role, code) => can(role, "purchase.operate", code) },
};

function erpNavGroups(role: Parameters<typeof can>[0]): Array<{ title: string | null; direct?: boolean; links: NavLink[] }> {
  return navGroupsForRole(role).map((group) => ({
    title: group.title,
    direct: group.direct,
    links: group.links.map((link) => {
      const base = link.href.split("?")[0]!.split("#")[0]!;
      const fromCatalog = LABELS[base];
      const label = link.label ?? (typeof fromCatalog === "function" ? fromCatalog : fromCatalog ?? base);
      const create = link.href.includes("vista=oc")
        ? { href: "/compras?vista=oc&nueva=1", show: (role: Parameters<typeof can>[0], code: string | null) => can(role, "purchase.operate", code) }
        : CREATE[base];
      return {
        href: link.href,
        label,
        show: link.show,
        createHref: create?.href,
        showCreate: create?.show,
      };
    }),
  }));
}

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const flash = await takeFlash();
  const companies = session.homeCompanyId
    ? await prisma.company.findMany({ where: { id: session.homeCompanyId } })
    : await prisma.company.findMany({ orderBy: { name: "asc" } });
  const business = can(session.role, "nav.business");
  const viewAsUsers = session.realRole === "ADMINISTRADOR"
    ? await prisma.user.findMany({
        where: { active: true, role: { not: "ADMINISTRADOR" } },
        include: { company: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    : [];

  const initials =
    session.name
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2 || session.name.trim().split(/\s+/).length <= 2)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "SY";

  const isServomotores = session.activeCompanyCode === "SERVOMOTORES";
  const companyDotClass = isServomotores
    ? "bg-amber-500 ring-2 ring-amber-500/20"
    : "bg-[#0284c7] ring-2 ring-sky-500/20";
  const companyBadgeToneClass = isServomotores
    ? "border-amber-200/90 bg-amber-50/70 text-amber-900"
    : "border-sky-200/90 bg-sky-50/70 text-sky-950";

  const sidebar = (
    <>
        <div className="mb-3 border-b border-slate-200/80 px-4 pb-4 pt-5">
          <div className="flex items-center gap-2.5 pr-10">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a477e] text-white shadow-2xs ring-1 ring-[#0a477e]/15">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M10 2.5 16.5 6.25v7.5L10 17.5 3.5 13.75v-7.5L10 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M10 6.5 13.5 8.5v3L10 13.5 6.5 11.5v-3L10 6.5Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-slate-900">SYGOS</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sistema Operativo</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-2xs ring-1 ring-slate-200/80">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold tracking-tight text-[#0a477e] ring-1 ring-sky-200/80"
              aria-hidden
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{session.name}</p>
              <span className="mt-0.5 inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {ROLE_LABEL[session.role]}
              </span>
            </div>
          </div>
        </div>
        <Suspense fallback={<nav className="px-3 pb-5 text-sm text-slate-500">Menú…</nav>}>
          <SideNav
            accordionGroups={
              session.role !== "VENTAS"
              && session.role !== "ALMACEN"
              && session.role !== "SUPERVISOR_TECNICO"
              && session.role !== "TECNICO"
              && session.role !== "GERENTE_OPERATIVO_SYSTRON"
            }
            groups={[
              ...erpNavGroups(session.role).map((group) => ({
                title: group.title,
                direct: group.direct,
                links: group.links
                  .filter((link) => link.show(session.role, session.activeCompanyCode))
                  .map((link) => {
                    const base = typeof link.label === "function" ? link.label(session.activeCompanyCode) : link.label;
                    const label = navLabel(link.href, session.role, session.activeCompanyCode) ?? base;
                    return {
                      href: link.href,
                      label,
                      createHref: link.showCreate?.(session.role, session.activeCompanyCode) ? link.createHref : undefined,
                    };
                  }),
              })).filter((group) => group.links.length > 0),
              ...(session.role === "VENTAS"
                || session.role === "SUPERVISOR_TECNICO"
                || session.role === "TECNICO"
                || session.role === "AYUDANTE_GENERAL"
                || session.role === "KIOSCO_ASISTENCIA"
                ? []
                : [{ title: null, links: [{ href: "/cuenta", label: "Cuenta" }] }]),
            ]}
          />
        </Suspense>
    </>
  );
  const toolbar = (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-2 backdrop-blur-md md:px-10 md:py-2.5">
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="hidden text-[11px] font-medium text-slate-400 xl:inline">Empresa</span>
            {companies.length > 1 ? (
              <form action={switchCompanyAction} className="flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/70 py-0.5 pl-2.5 pr-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${companyDotClass}`} aria-hidden />
                <select
                  key={session.activeCompanyId ?? "none"}
                  name="companyId"
                  defaultValue={session.activeCompanyId ?? ""}
                  className="min-h-6 min-w-0 max-w-48 rounded-md border-0 bg-transparent pr-1 text-xs font-semibold text-slate-800 focus:outline-none"
                  aria-label="Empresa activa"
                >
                  <option value="" disabled>Selecciona empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                <button className="min-h-6 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs ring-1 ring-slate-200/80 hover:bg-slate-100 hover:text-slate-900" type="submit">Cambiar</button>
              </form>
            ) : (
              <strong className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${companyBadgeToneClass}`}>
                <span className={`h-2 w-2 rounded-full ${companyDotClass}`} aria-hidden />
                {session.activeCompanyName ?? "Sin empresa"}
              </strong>
            )}
          </div>
          <details className="relative md:hidden">
            <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Opciones</summary>
            <div className="absolute right-0 top-11 z-30 grid w-[min(88vw,340px)] gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xl">
              {session.realRole === "ADMINISTRADOR" ? (
                <form action={viewAsAction} className="grid gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="view-as-mobile">Ver como</label>
                  <select id="view-as-mobile" name="userId" defaultValue={session.impersonating ? session.userId : ""} className="min-h-9 w-full rounded-lg border border-slate-300/90 bg-white px-2.5 text-sm">
                    <option value="">Administrador</option>
                    {viewAsUsers.filter((user) => isRole(user.role)).map((user) => <option key={user.id} value={user.id}>{user.name}{user.company ? ` · ${user.company.name}` : ""}</option>)}
                  </select>
                  <button className="min-h-9 rounded-lg bg-[#0d5ca1] px-3 text-xs font-semibold text-white">Aplicar</button>
                </form>
              ) : null}
              {can(session.role, "search.global") && session.activeCompanyId ? (
                <form action="/buscar"><input name="q" placeholder="Buscar en esta empresa" className="min-h-9 w-full rounded-lg border border-slate-300/90 bg-slate-50/70 px-3 text-sm focus:bg-white" /></form>
              ) : null}
              <form action={logoutAction}><button className="min-h-9 w-full rounded-lg border border-slate-200/90 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">Salir</button></form>
            </div>
          </details>
          <div className="hidden items-center gap-2.5 md:flex">
            {session.realRole === "ADMINISTRADOR" ? (
              <form action={viewAsAction} className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-slate-400" htmlFor="view-as">Ver como</label>
                <select
                  id="view-as"
                  name="userId"
                  key={session.impersonating ? session.userId : "admin"}
                  defaultValue={session.impersonating ? session.userId : ""}
                  className="min-h-7 rounded-md border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <option value="">Administrador</option>
                  {viewAsUsers.filter((user) => isRole(user.role)).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}{user.company ? ` · ${user.company.name}` : ""}
                    </option>
                  ))}
                </select>
                <button className="min-h-7 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="submit">Aplicar</button>
              </form>
            ) : null}
            {can(session.role, "search.global") && session.activeCompanyId ? (
              <form action="/buscar" className="flex">
                <input name="q" placeholder="Buscar…" className="min-h-7 w-44 rounded-md border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-800 focus:border-[#0a477e] focus:bg-white focus:ring-2 focus:ring-[#0a477e]/15 md:w-56" />
              </form>
            ) : null}
            <form action={logoutAction}>
              <button className="inline-flex min-h-7 items-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="submit">Salir</button>
            </form>
          </div>
      </div>
    </header>
  );

  return (
    <ErpShell sidebar={sidebar} toolbar={toolbar}>
        <main className="w-full max-w-[1600px] px-5 py-6 sm:px-8 md:px-10 md:py-8 print:max-w-none print:p-0">
          {session.impersonating ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-900 print:hidden">
              <p className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden>
                  <path d="M1.5 8s2.25-4.25 6.5-4.25S14.5 8 14.5 8s-2.25 4.25-6.5 4.25S1.5 8 1.5 8Z" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
                <span>Viendo como <strong>{session.name}</strong> · {ROLE_LABEL[session.role]}. Lo que guardes queda a nombre de esta cuenta.</span>
              </p>
              <form action={viewAsAction}>
                <input type="hidden" name="userId" value="" />
                <button className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs ring-1 ring-amber-300/80 hover:bg-amber-100/60" type="submit">
                  Volver a Administrador
                </button>
              </form>
            </div>
          ) : null}
          {sandboxFor(session.userId, session.role) ? (
            <p className="mb-4 rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium print:hidden">MODO DE PRUEBAS — Los cambios realizados en este contexto serán descartados y no afectan la operación real.</p>
          ) : null}
          {!business ? (
            <p className="mb-4 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
              Esta cuenta no opera módulos de negocio.
            </p>
          ) : null}
          {flash ? <FlashBanner flash={flash} /> : null}
          {children}
        </main>
    </ErpShell>
  );
}
