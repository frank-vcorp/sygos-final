import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction, switchCompanyAction } from "@/app/auth-actions";
import { FlashBanner } from "@/components/flash-banner";
import { prisma } from "@/lib/db";
import { takeFlash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { getSession } from "@/lib/session";

const LINKS: Array<{
  href: string;
  label: string | ((code: string | null) => string);
  show: (role: Parameters<typeof can>[0], code: string | null) => boolean;
}> = [
  { href: "/inicio", label: "Inicio", show: () => true },
  { href: "/clientes", label: "Clientes", show: (role, code) => can(role, "client.create", code) || can(role, "client.edit", code) },
  { href: "/prospectos", label: "Prospectos", show: (role, code) => can(role, "prospect.operate", code) },
  { href: "/equipos", label: "Equipos", show: (role, code) => can(role, "equi.view", code) },
  { href: "/motores", label: "Motores", show: (role, code) => can(role, "mot.view", code) },
  { href: "/operacion", label: "Operación", show: (role, code) => role !== "ALMACEN" && (can(role, "equi.view", code) || can(role, "mot.view", code)) },
  { href: "/custodia", label: (code) => (code === "SERVOMOTORES" ? "Custodia" : "Almacén"), show: (role, code) => can(role, "custody.confirm", code) },
  { href: "/inventario", label: "Inventario", show: (role, code) => can(role, "inventory.operate", code) },
  { href: "/proveedores", label: "Proveedores", show: (role, code) => can(role, "supplier.operate", code) },
  { href: "/usuarios", label: "Usuarios", show: (role) => can(role, "user.manage") },
  { href: "/configuracion", label: "Configuración", show: (role) => can(role, "config.company") || can(role, "config.integrations") },
];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const flash = await takeFlash();
  const companies = session.homeCompanyId
    ? await prisma.company.findMany({ where: { id: session.homeCompanyId } })
    : await prisma.company.findMany({ orderBy: { name: "asc" } });
  const business = can(session.role, "nav.business");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-[var(--line)] bg-white md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">SYGOS 3.0</p>
          <p className="mt-1 text-sm font-medium">{session.name}</p>
          <p className="text-xs text-[var(--muted)]">{ROLE_LABEL[session.role]}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:px-2">
          {LINKS.filter((link) => link.show(session.role, session.activeCompanyCode)).map((link) => (
            <Link key={link.href} href={link.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-[#f3f5f6]">
              {typeof link.label === "function" ? link.label(session.activeCompanyCode) : link.label}
            </Link>
          ))}
          <Link href="/cuenta" className="block whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-[#f3f5f6]">Cuenta</Link>
        </nav>
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
