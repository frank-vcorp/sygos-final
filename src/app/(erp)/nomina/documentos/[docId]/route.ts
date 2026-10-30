import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    return new NextResponse("No autorizado", { status: 403 });
  }
  const { docId } = await params;
  const doc = await prisma.payrollDocument.findFirst({
    where: { id: docId, period: { companyId: session.activeCompanyId } },
    include: { period: true },
  });
  if (!doc) {
    return new NextResponse("Documento no encontrado", { status: 404 });
  }

  const safeTitle = (doc.fileName || doc.title || "documento-nomina").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (doc.fileDataUrl && doc.fileDataUrl.startsWith("data:")) {
    const commaIdx = doc.fileDataUrl.indexOf(",");
    if (commaIdx > 0) {
      const base64 = doc.fileDataUrl.slice(commaIdx + 1);
      const buffer = Buffer.from(base64, "base64");
      const contentType = doc.mimeType || "application/octet-stream";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${safeTitle}"`,
        },
      });
    }
  }

  const fallbackText = `Documento: ${doc.title}\nNómina: ${doc.period.folio}\nFecha: ${doc.createdAt.toISOString().slice(0, 10)}\n`;
  return new NextResponse(fallbackText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${safeTitle.endsWith(".txt") ? safeTitle : `${safeTitle}.txt`}"`,
    },
  });
}
