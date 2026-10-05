import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.activeCompanyId || !session.activeCompanyCode || !can(session.role, "inventory.operate", session.activeCompanyCode)) {
    return new Response("No autorizado", { status: 401 });
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company?.inventoryEnabled) return new Response("Inventario deshabilitado", { status: 404 });
  const parts = await prisma.part.findMany({
    where: { companyId: company.id, active: true },
    orderBy: { partNumber: "asc" },
  });
  const lines = ["numero,descripcion,existencia,minimo,maximo"];
  for (const part of parts) {
    lines.push([csv(part.partNumber), csv(part.description), String(part.qty), part.minQty ?? "", part.maxQty ?? ""].join(","));
  }
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inventario-${company.code.toLowerCase()}.csv"`,
    },
  });
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
