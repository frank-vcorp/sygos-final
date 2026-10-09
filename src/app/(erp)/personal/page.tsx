import { redirect } from "next/navigation";
import { ActionLink, ActiveFilters, Badge, Empty, PageHeader, RecordLink, SegmentedNav, Table, Td, Th, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { vista } = await searchParams;
  const rows = await prisma.collaborator.findMany({
    where: { companyId: session.activeCompanyId },
    include: { user: true, boss: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader
        title="Personal"
        subtitle={vista === "documentos" ? "Abre cada colaborador para ver y cargar documentos laborales." : "Cada empresa tiene sus colaboradores. No hay alta rápida."}
        action={<ActionLink href="/personal/nuevo">Alta de colaborador</ActionLink>}
      />
      <SegmentedNav
        items={[
          { href: "/personal", label: "Colaboradores", active: vista !== "documentos" },
          { href: "/personal?vista=documentos", label: "Documentos", active: vista === "documentos" },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <TextLink href="/personal/asistencia">Asistencia</TextLink>
        <span className="text-[var(--muted)]">·</span>
        <TextLink href="/personal/horas">Horas extra</TextLink>
        <span className="text-[var(--muted)]">·</span>
        <TextLink href="/nomina">Nómina</TextLink>
      </div>
      <ActiveFilters items={vista === "documentos" ? [{ label: "Vista documentos", clearHref: "/personal" }] : []} />
      {rows.length === 0 ? <Empty title="Sin colaboradores" body="El alta pide empresa, tipo, ingreso, jefe y salario." /> : (
        <Table>
          <thead><tr><Th>Nombre</Th><Th>Puesto</Th><Th>Jefe</Th><Th>Salario diario</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><RecordLink href={`/personal/${row.id}`}>{row.user.name}</RecordLink></Td>
                <Td>{row.user.role}</Td>
                <Td>{row.boss?.name ?? "—"}</Td>
                <Td>{money(row.dailyStamped + row.dailyCash)}</Td>
                <Td><Badge>{row.status === "ACTIVO" ? "Activo" : "Baja"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
