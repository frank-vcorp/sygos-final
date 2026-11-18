import { handlePayrollLineDownload } from "@/lib/billing-download-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePayrollLineDownload(request, id, "pdf");
}
