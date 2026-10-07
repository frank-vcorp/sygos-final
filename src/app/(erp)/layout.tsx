import { redirect } from "next/navigation";
import { logoutAction, switchCompanyAction, viewAsAction } from "@/app/auth-actions";
import { CompanyLogo, SygosLogo } from "@/components/brand-logo";
import { FlashBanner } from "@/components/flash-banner";
import { ErpShell } from "@/components/erp-shell";
import { SideNav } from "@/components/side-nav";
import { prisma, sandboxFor } from "@/lib/db";
import { takeFlash } from "@/lib/flash";
import { NAV_GROUPS } from "@/lib/nav-links";
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
  "/inicio": "Inicio",
  "/panel": "Panel",
  "/clientes": "Clientes",
  "/prospectos": "Prospectos",
  "/cotizaciones": "Cotizaciones",
  "/ventas": "Ventas",
  "/agenda": "Agenda",
  "/facturacion": "Facturación",
  "/cobranza": "Cobranza",
  "/pagos": "Pagos",
  "/compras": "Compras",
  "/finanzas": "Finanzas",
  "/personal": "Colaboradores",
  "/personal/asistencia": "Asistencia",
  "/personal/horas": "Horas extra",
  "/nomina": "Nómina",
  "/comisiones": "Comisiones",
  "/produccion": "Producción",
  "/reportes": "Reportes",
  "/kiosco": "Kiosco",
  "/servicios/diagnostico": "Diagnóstico",
  "/servicios/reparacion": "Reparación",
  "/servicios/garantia": "Diagnóstico de Garantía",
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
  "/facturacion": { href: "/facturacion/nuevo", show: (role, code) => can(role, "invoice.issue", code) },
  "/pagos": { href: "/pagos/nuevo", show: (role, code) => can(role, "payment.register", code) },
  "/compras": { href: "/compras/nueva", show: (role, code) => can(role, "purchase.operate", code) },
  "/personal": { href: "/personal/nuevo", show: (role) => can(role, "personnel.manage") },
  "/servicios/diagnostico": { href: "/servicios/diagnostico/nuevo", show: (role, code) => can(role, "attention.create", code) },
  "/servicios/reparacion": { href: "/servicios/reparacion/nuevo", show: (role, code) => can(role, "attention.create", code) },
  "/servicios/garantia": { href: "/servicios/garantia/nuevo", show: (role, code) => can(role, "attention.create", code) },
  "/equipos": { href: "/equipos/nuevo", show: (role, code) => can(role, "equi.create", code) },
  "/motores": { href: "/motores/nuevo", show: (role, code) => can(role, "mot.create", code) },
  "/proveedores": { href: "/proveedores/nuevo", show: (role, code) => can(role, "supplier.operate", code) },
};

const GROUPS: Array<{ title: string | null; links: NavLink[] }> = NAV_GROUPS.map((group) => ({
  title: group.title,
  links: group.links.map((link) => {
    const label = LABELS[link.href];
    const create = CREATE[link.href];
    return {
      href: link.href,
      label: typeof label === "function" ? label : label ?? link.href,
      show: link.show,
      createHref: create?.href,
      showCreate: create?.show,
    };
  }),
}));

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

  const sidebar = (
    <>
        <div className="mb-3 border-b border-[#dce4ed] px-5 pb-5 pt-6">
          <SygosLogo />
          <div className="mt-5 rounded-lg bg-white px-3 py-2.5 ring-1 ring-[#dce4ed]">
            <p className="text-sm font-semibold">{session.name}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{ROLE_LABEL[session.role]}</p>
          </div>
        </div>
        <SideNav
          groups={[
            ...GROUPS.map((group) => ({
              title: group.title,
              links: group.links
                .filter((link) => link.show(session.role, session.activeCompanyCode))
                .map((link) => ({
                  href: link.href,
                  label: typeof link.label === "function" ? link.label(session.activeCompanyCode) : link.label,
                  createHref: link.showCreate?.(session.role, session.activeCompanyCode) ? link.createHref : undefined,
                })),
            })).filter((group) => group.links.length > 0),
            { title: null, links: [{ href: "/cuenta", label: "Cuenta" }] },
          ]}
        />
    </>
  );
  const toolbar = (
    <header className="border-b border-[var(--line)] bg-white px-4 py-3 md:px-8 md:py-4">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <CompanyLogo code={session.activeCompanyCode} className="hidden lg:inline-flex" />
            <span className="hidden text-xs font-semibold uppercase tracking-wide text-[var(--muted)] xl:inline">Empresa activa</span>
            {companies.length > 1 ? (
              <form action={switchCompanyAction} className="flex min-w-0 items-center">
                <select
                  key={session.activeCompanyId ?? "none"}
                  name="companyId"
                  defaultValue={session.activeCompanyId ?? ""}
                  className="min-h-10 min-w-0 max-w-44 rounded-md border border-[var(--line)] bg-white px-2 text-sm font-semibold"
                  aria-label="Empresa activa"
                >
                  <option value="" disabled>Selecciona empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                <button className="ml-1 min-h-10 rounded-md px-2 text-sm font-medium text-[var(--accent)]" type="submit">Cambiar</button>
              </form>
            ) : (
              <strong className="text-sm">{session.activeCompanyName ?? "Sin empresa"}</strong>
            )}
          </div>
          <details className="relative md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-[var(--line)] px-3 text-sm font-medium">Opciones</summary>
            <div className="absolute right-0 top-12 z-30 grid w-[min(88vw,340px)] gap-3 rounded-lg border border-[var(--line)] bg-white p-3">
              {session.realRole === "ADMINISTRADOR" ? (
                <form action={viewAsAction} className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]" htmlFor="view-as-mobile">Ver como</label>
                  <select id="view-as-mobile" name="userId" defaultValue={session.impersonating ? session.userId : ""} className="min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-2 text-sm">
                    <option value="">Administrador</option>
                    {viewAsUsers.filter((user) => isRole(user.role)).map((user) => <option key={user.id} value={user.id}>{user.name}{user.company ? ` · ${user.company.name}` : ""}</option>)}
                  </select>
                  <button className="min-h-11 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-white">Aplicar</button>
                </form>
              ) : null}
              {can(session.role, "search.global") && session.activeCompanyId ? (
                <form action="/buscar"><input name="q" placeholder="Buscar en esta empresa" className="min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm" /></form>
              ) : null}
              <form action={logoutAction}><button className="min-h-11 w-full rounded-md border border-[var(--line)] text-sm">Salir</button></form>
            </div>
          </details>
          <div className="hidden items-center gap-4 md:flex">
            {session.realRole === "ADMINISTRADOR" ? (
              <form action={viewAsAction} className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]" htmlFor="view-as">Ver como</label>
                <select
                  id="view-as"
                  name="userId"
                  key={session.impersonating ? session.userId : "admin"}
                  defaultValue={session.impersonating ? session.userId : ""}
                  className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm"
                >
                  <option value="">Administrador</option>
                  {viewAsUsers.filter((user) => isRole(user.role)).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}{user.company ? ` · ${user.company.name}` : ""}
                    </option>
                  ))}
                </select>
                <button className="text-sm font-medium text-[var(--accent)]" type="submit">Aplicar</button>
              </form>
            ) : null}
            {can(session.role, "search.global") && session.activeCompanyId ? (
              <form action="/buscar" className="flex">
                <input name="q" placeholder="Buscar en esta empresa" className="w-48 rounded-md border border-[var(--line)] px-2 py-1 text-sm md:w-64" />
              </form>
            ) : null}
            <form action={logoutAction}>
              <button className="text-sm text-[var(--muted)]" type="submit">Salir</button>
            </form>
          </div>
      </div>
    </header>
  );

  return (
    <ErpShell sidebar={sidebar} toolbar={toolbar}>
        <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 md:px-8 md:py-9 lg:px-10 print:max-w-none print:p-0">
          {session.impersonating ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ead9a8] bg-[var(--warn-soft)] px-3 py-2 text-sm print:hidden">
              <p>Viendo como <strong>{session.name}</strong> · {ROLE_LABEL[session.role]}. Lo que guardes queda a nombre de esta cuenta.</p>
              <form action={viewAsAction}>
                <input type="hidden" name="userId" value="" />
                <button className="font-medium text-[var(--accent)]" type="submit">Volver a Administrador</button>
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
