import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import {
  getWhatsAppFullStatus,
  linkWhatsApp,
  reconnectWhatsApp,
  saveWhatsAppSettings,
  sendWhatsAppMessage,
  unlinkWhatsApp,
} from "@/lib/whatsapp";

async function requireIntegrationsActor() {
  const session = await getSession();
  if (!session || !can(session.role, "config.integrations")) return null;
  return session;
}

export async function GET() {
  const session = await requireIntegrationsActor();
  if (!session) {
    return NextResponse.json(
      { message: "Solo el CEO o el Administrador pueden administrar WhatsApp." },
      { status: 403 },
    );
  }
  return NextResponse.json(await getWhatsAppFullStatus(session.activeCompanyId));
}

export async function POST(request: Request) {
  const session = await requireIntegrationsActor();
  if (!session) {
    return NextResponse.json(
      { message: "Solo el CEO o el Administrador pueden administrar WhatsApp." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    fresh?: boolean;
    phone?: string;
    text?: string;
    enabled?: boolean;
    defaultCountryCode?: string;
  };

  try {
    if (body.action === "unlink" || body.action === "logout") {
      return NextResponse.json(await unlinkWhatsApp());
    }
    if (body.action === "reconnect") {
      return NextResponse.json(await reconnectWhatsApp());
    }
    if (body.action === "settings") {
      const updated = await saveWhatsAppSettings(
        {
          enabled: body.enabled !== false,
          defaultCountryCode: body.defaultCountryCode ?? "52",
        },
        session.activeCompanyId,
      );
      return NextResponse.json(updated);
    }
    if (body.action === "send" || body.action === "test") {
      const result = await sendWhatsAppMessage({
        companyId: session.activeCompanyId,
        phone: String(body.phone ?? ""),
        text: String(body.text ?? ""),
      });
      const status = await getWhatsAppFullStatus(session.activeCompanyId);
      return NextResponse.json(
        {
          ...status,
          sendResult: result,
          message: result.message,
        },
        { status: result.ok ? 200 : 400 },
      );
    }
    const fresh = body.action === "fresh" || body.fresh === true;
    return NextResponse.json(await linkWhatsApp(fresh));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "WhatsApp no respondió.";
    return NextResponse.json(
      { message: message === "NEXT_REDIRECT" ? "WhatsApp no respondió." : message },
      { status: 400 },
    );
  }
}
