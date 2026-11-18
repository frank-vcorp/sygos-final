import { NextResponse } from "next/server";
import { processFacturapiWebhook } from "@/lib/facturapi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyCode: string }> },
) {
  const { companyCode } = await params;
  const rawBody = await request.text();
  const signature = request.headers.get("facturapi-signature");

  const result = await processFacturapiWebhook({
    companyCode,
    rawBody,
    signature,
  });

  return NextResponse.json(result.body, { status: result.status });
}
