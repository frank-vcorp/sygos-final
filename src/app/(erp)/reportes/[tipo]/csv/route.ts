import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { reportTable, visibleReports } from "@/lib/reports";
import type { Role } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ tipo: string }> }) {
  const session = await getSession();
  if (!session?.activeCompanyId || !session.activeCompanyCode || !can(session.role, "report.view", session.activeCompanyCode)) {
    return new NextResponse("No autorizado", { status: 403 });
  }
  const { tipo } = await context.params;
  if (!visibleReports(session.role as Role).some((report) => report.id === tipo)) {
    return new NextResponse("No autorizado", { status: 403 });
  }
  const url = new URL(request.url);
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  const table = await reportTable(session.activeCompanyId, Boolean(company?.inventoryEnabled) || session.activeCompanyCode === "SYSTRON", tipo, url.searchParams.get("desde"), url.searchParams.get("hasta"));
  const lines = [table.headers, ...table.rows.map((row) => row.cells)].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}.csv"`,
    },
  });
}
