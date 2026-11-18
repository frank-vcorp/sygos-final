import { handleBillingDocumentDownload } from "@/lib/billing-download-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleBillingDocumentDownload(request, id, "xml");
}
