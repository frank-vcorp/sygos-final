import { NextResponse } from "next/server";
import { handleCancellationReceiptDownload } from "@/lib/billing-download-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  const { id, format } = await params;
  if (format !== "xml" && format !== "pdf") {
    return NextResponse.json({ message: "Formato no válido. Usa xml o pdf." }, { status: 400 });
  }
  return handleCancellationReceiptDownload(request, id, format);
}
