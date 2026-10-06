import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { linkWhatsApp, reconnectWhatsApp, whatsAppStatus } from "@/lib/whatsapp";

async function admin() {
  const session = await getSession();
  if (!session || session.realRole !== "ADMINISTRADOR" || session.impersonating) return null;
  return session;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ message: "Solo el administrador vincula WhatsApp." }, { status: 403 });
  return NextResponse.json(whatsAppStatus());
}

export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ message: "Solo el administrador vincula WhatsApp." }, { status: 403 });
  const body = await request.json() as { action?: string };
  try {
    if (body.action === "unlink") return NextResponse.json(await linkWhatsApp(true));
    if (body.action === "reconnect") return NextResponse.json(await reconnectWhatsApp());
    return NextResponse.json(await linkWhatsApp(false));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "WhatsApp no respondió." }, { status: 400 });
  }
}
