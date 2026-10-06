import { redirect } from "next/navigation";
import { logoutAction, switchCompanyAction, viewAsAction } from "@/app/auth-actions";
import { FlashBanner } from "@/components/flash-banner";
import { SideNav } from "@/components/side-nav";
import { prisma, sandboxFor } from "@/lib/db";
import { cookies } from "next/headers";
import { takeFlash } from "@/lib/flash";
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

const seesService = (role: Parameters<typeof can>[0], code: string | null) =>
  role !== "ALMACEN" && (can(role, "equi.view", code) || can(role, "mot.view", code));

const GROUPS: Array<{ title: string | null; links: NavLink[] }> = [
  { title: null, links: [
    { href: "/inicio", label: "Inicio", show: () => true },
    { href: "/panel", label: "Panel", show: (role) => can(role, "panel.view") },
  ] },
  {
    title: "Comercial",
    links: [
      { href: "/clientes", label: "Clientes", show: (role, code) => can(role, "client.create", code) || can(role, "client.edit", code), createHref: "/clientes/nuevo", showCreate: (role, code) => can(role, "client.create", code) },
      { href: "/prospectos", label: "Prospectos", show: (role, code) => can(role, "prospect.operate", code), createHref: "/prospectos/nuevo", showCreate: (role, code) => can(role, "prospect.operate", code) },
      { href: "/cotizaciones", label: "Cotizaciones", show: (role, code) => can(role, "quote.create", code) || can(role, "quote.price", code), createHref: "/cotizaciones/nuevo", showCreate: (role, code) => can(role, "quote.create", code) },
      { href: "/ventas", label: "Ventas", show: (role, code) => can(role, "agenda.use", code) || can(role, "quote.follow", code) },
      { href: "/agenda", label: "Agenda", show: (role, code) => can(role, "agenda.use", code) },
      { href: "/facturacion", label: "Facturación", show: (role, code) => can(role, "invoice.request", code) || can(role, "invoice.issue", code), createHref: "/facturacion/nuevo", showCreate: (role, code) => can(role, "invoice.issue", code) },
      { href: "/cobranza", label: "Cobranza", show: (role, code) => can(role, "receivable.view", code) },
      { href: "/pagos", label: "Pagos", show: (role, code) => can(role, "payment.register", code) || can(role, "payment.validate", code), createHref: "/pagos/nuevo", showCreate: (role, code) => can(role, "payment.register", code) },
      { href: "/compras", label: "Compras", show: (role, code) => can(role, "purchase.operate", code), createHref: "/compras/nueva", showCreate: (role, code) => can(role, "purchase.operate", code) },
      { href: "/finanzas", label: "Finanzas", show: (role, code) => can(role, "finance.view", code) },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/personal", label: "Colaboradores", show: (role) => can(role, "personnel.manage"), createHref: "/personal/nuevo", showCreate: (role) => can(role, "personnel.manage") },
      { href: "/personal/asistencia", label: "Asistencia", show: (role) => can(role, "personnel.manage") },
      { href: "/personal/horas", label: "Horas extra", show: (role, code) => can(role, "overtime.capture", code) || can(role, "personnel.authorize") },
      { href: "/nomina", label: "Nómina", show: (role) => can(role, "personnel.manage") },
      { href: "/comisiones", label: "Comisiones", show: (role) => can(role, "personnel.manage") },
      { href: "/produccion", label: "Producción", show: (role) => can(role, "production.view") },
      { href: "/reportes", label: "Reportes", show: (role) => can(role, "report.view") },
      { href: "/kiosco", label: "Kiosco", show: (role) => role === "KIOSCO_ASISTENCIA" },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/diagnostico", label: "Diagnóstico", show: seesService, createHref: "/servicios/diagnostico/nuevo", showCreate: (role, code) => can(role, "attention.create", code) },
      { href: "/servicios/reparacion", label: "Reparación", show: seesService, createHref: "/servicios/reparacion/nuevo", showCreate: (role, code) => can(role, "attention.create", code) },
      { href: "/servicios/garantia", label: "Diagnóstico de Garantía", show: seesService, createHref: "/servicios/garantia/nuevo", showCreate: (role, code) => can(role, "attention.create", code) },
      { href: "/operacion", label: "En proceso", show: seesService },
    ],
  },
  {
    title: "Taller",
    links: [
      { href: "/equipos", label: "Equipos", show: (role, code) => can(role, "equi.view", code), createHref: "/equipos/nuevo", showCreate: (role, code) => can(role, "equi.create", code) },
      { href: "/motores", label: "Motores", show: (role, code) => can(role, "mot.view", code), createHref: "/motores/nuevo", showCreate: (role, code) => can(role, "mot.create", code) },
      { href: "/custodia", label: (code) => (code === "SERVOMOTORES" ? "Custodia" : "Almacén"), show: (role, code) => can(role, "custody.confirm", code) },
      { href: "/inventario", label: "Inventario", show: (role, code) => can(role, "inventory.operate", code) },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/proveedores", label: "Proveedores", show: (role, code) => can(role, "supplier.operate", code), createHref: "/proveedores/nuevo", showCreate: (role, code) => can(role, "supplier.operate", code) },
      { href: "/usuarios", label: "Usuarios", show: (role) => can(role, "user.manage") },
      { href: "/configuracion", label: "Configuración", show: (role) => can(role, "config.company") || can(role, "config.integrations") },
      { href: "/pruebas", label: "Modo de pruebas", show: (role) => role === "ADMINISTRADOR" },
    ],
  },
];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const jar = await cookies();
  if (sandboxFor(session.userId, session.role)) {
    jar.set("sygos_sandbox", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  } else {
    jar.set("sygos_sandbox", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  }
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

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--line)] bg-white md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">SYGOS 3.0</p>
          <p className="mt-1 text-sm font-medium">{session.name}</p>
          <p className="text-xs text-[var(--muted)]">{ROLE_LABEL[session.role]}</p>
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
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Empresa activa</span>
            {companies.length > 1 ? (
              <form action={switchCompanyAction}>
                <select
                  key={session.activeCompanyId ?? "none"}
                  name="companyId"
                  defaultValue={session.activeCompanyId ?? ""}
                  className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm font-semibold"
                  aria-label="Empresa activa"
                >
                  <option value="" disabled>Selecciona empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                <button className="ml-2 text-sm font-medium text-[var(--accent)]" type="submit">Cambiar</button>
              </form>
            ) : (
              <strong className="text-sm">{session.activeCompanyName ?? "Sin empresa"}</strong>
            )}
          </div>
          <div className="flex items-center gap-3">
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
        </header>
        <div className="px-4 py-6 md:px-8">
          {session.impersonating ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ead9a8] bg-[var(--warn-soft)] px-3 py-2 text-sm">
              <p>Viendo como <strong>{session.name}</strong> · {ROLE_LABEL[session.role]}. Lo que guardes queda a nombre de esta cuenta.</p>
              <form action={viewAsAction}>
                <input type="hidden" name="userId" value="" />
                <button className="font-medium text-[var(--accent)]" type="submit">Volver a Administrador</button>
              </form>
            </div>
          ) : null}
          {sandboxFor(session.userId, session.role) ? (
            <p className="mb-4 rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium">MODO DE PRUEBAS — Los cambios realizados en este contexto serán descartados y no afectan la operación real.</p>
          ) : null}
          {!business ? (
            <p className="mb-4 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
              Esta cuenta no opera módulos de negocio.
            </p>
          ) : null}
          {flash ? <FlashBanner flash={flash} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
