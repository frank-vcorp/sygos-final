import { NextResponse } from "next/server";
import { getBillingDocumentDownload } from "./billing-artifacts";
import { canDownloadBillingDocument } from "./billing-delivery";
import { prisma } from "./db";
import { getSession } from "./session";

export async function handleBillingDocumentDownload(
  request: Request,
  documentId: string,
  format: "xml" | "pdf" | "zip",
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      companyId: true,
      kind: true,
      client: { select: { ownerUserId: true } },
      payable: { select: { companyId: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ message: "Documento no encontrado." }, { status: 404 });
  }

  const allowed = canDownloadBillingDocument(session, {
    companyId: doc.companyId,
    kind: doc.kind,
    clientOwnerUserId: doc.client.ownerUserId,
    payableCompanyId: doc.payable?.companyId ?? null,
  });

  if (!allowed) {
    return NextResponse.json({ message: "No tienes permiso para descargar este documento." }, { status: 403 });
  }

  const file = await getBillingDocumentDownload(doc.id, format);
  if (!file) {
    return NextResponse.json(
      { message: `El archivo ${format.toUpperCase()} aún no está disponible.` },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const disposition =
    format === "pdf" && url.searchParams.get("download") !== "1"
      ? `inline; filename="${file.filename}"`
      : `attachment; filename="${file.filename}"`;

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
