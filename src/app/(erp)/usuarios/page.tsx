import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can, canSeeUser } from "@/lib/permissions";
import { isRole, ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function UsuariosPage() {
  const session = await requireSession();
  if (!can(session.role, "user.manage")) redirect("/inicio");
  const users = await prisma.user.findMany({ include: { company: true }, orderBy: { name: "asc" } });
  const visible = users.filter((user) => isRole(user.role) && canSeeUser(session.role, user.role));
  return (
    <>
      <PageHeader title="Usuarios" subtitle="Los roles son fijos. No hay editor de permisos." action={<Link href="/usuarios/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo usuario</Link>} />
      {visible.length === 0 ? <Empty title="Sin usuarios visibles" body="No hay cuentas que puedas administrar." /> : (
        <Table>
          <thead><tr><Th>Nombre</Th><Th>Usuario</Th><Th>Rol</Th><Th>Empresa</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id}>
                <Td><Link className="font-medium text-[var(--accent)]" href={`/usuarios/${user.id}`}>{user.name}</Link></Td>
                <Td>{user.username}</Td>
                <Td>{isRole(user.role) ? ROLE_LABEL[user.role] : user.role}</Td>
                <Td>{user.company?.name ?? "Ambas"}</Td>
                <Td>{user.active ? "Activo" : "Inactivo"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
