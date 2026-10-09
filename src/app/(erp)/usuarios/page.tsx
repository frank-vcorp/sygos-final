import { redirect } from "next/navigation";
import {
  ActionLink,
  ActiveFilters,
  Badge,
  Button,
  controlClass,
  Empty,
  FilterBar,
  MobileCard,
  PageHeader,
  RecordLink,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { can, canSeeUser } from "@/lib/permissions";
import { isRole, ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireSession();
  if (!can(session.role, "user.manage")) redirect("/inicio");
  const { q, estado } = await searchParams;
  const query = (q ?? "").trim();
  const estadoFilter = estado === "inactivos" ? "inactivos" : "activos";
  const users = await prisma.user.findMany({
    where: {
      ...(estadoFilter === "inactivos" ? { active: false } : { active: true }),
      ...(query
        ? {
            OR: [{ name: { contains: query } }, { username: { contains: query } }],
          }
        : {}),
    },
    include: { company: true },
    orderBy: { name: "asc" },
  });
  const visible = users.filter((user) => isRole(user.role) && canSeeUser(session.role, user.role));

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Los roles son fijos. No hay editor de permisos." action={<ActionLink href="/usuarios/nuevo">Nuevo usuario</ActionLink>} />
      <FilterBar action="/usuarios">
        <input name="q" defaultValue={query} placeholder="Nombre o usuario" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="estado" defaultValue={estadoFilter} className={`${controlClass} sm:w-auto`}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(estadoFilter === "inactivos" ? [{ label: "Inactivos", clearHref: listHref("/usuarios", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/usuarios", { estado: estadoFilter === "inactivos" ? "inactivos" : undefined }) }] : []),
        ]}
      />
      {visible.length === 0 ? (
        <Empty title="Sin usuarios visibles" body="No hay cuentas que coincidan con el filtro." />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Nombre</Th><Th>Usuario</Th><Th>Rol</Th><Th>Empresa</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <Td><RecordLink href={`/usuarios/${user.id}`}>{user.name}</RecordLink></Td>
                    <Td>{user.username}</Td>
                    <Td>{isRole(user.role) ? ROLE_LABEL[user.role] : user.role}</Td>
                    <Td>{user.company?.name ?? "Ambas"}</Td>
                    <Td><Badge tone={user.active ? "ok" : "danger"}>{user.active ? "Activo" : "Inactivo"}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={visible.map((user) => (
            <MobileCard
              key={user.id}
              href={`/usuarios/${user.id}`}
              title={user.name}
              meta={<Badge tone={user.active ? "ok" : "danger"}>{user.active ? "Activo" : "Inactivo"}</Badge>}
            >
              <p>{user.username}</p>
              <p className="mt-1 text-[var(--muted)]">{isRole(user.role) ? ROLE_LABEL[user.role] : user.role} · {user.company?.name ?? "Ambas empresas"}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
