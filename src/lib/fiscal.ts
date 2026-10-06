import { inSandbox, prismaProd } from "./db";

export async function fiscalFailure(companyId: string) {
  if (await inSandbox()) return { fiscalStatus: "SIMULADA", fiscalError: "PRUEBA / SIN VALIDEZ. No se contactó a Facturapi." };
  const setting = await prismaProd.integrationSetting.findFirst({ where: { companyId, provider: "FACTURAPI" } });
  if (!setting?.secretEnc) return { fiscalStatus: "ERROR", fiscalError: "Facturapi no está configurado para esta empresa. El reintento usa este mismo documento." };
  return { fiscalStatus: "ERROR", fiscalError: "Facturapi no timbró este documento. Sigue siendo el mismo y el reintento no crea otro." };
}

export async function mailBlockedReason() {
  if (await inSandbox()) return "PRUEBA / SIN VALIDEZ. No se envió correo.";
  const setting = await prismaProd.integrationSetting.findFirst({ where: { provider: "SENDGRID", companyId: null } });
  if (!setting?.secretEnc) return "SendGrid no está configurado. No se envió correo y la operación no se marcó como enviada.";
  return "SendGrid no entregó el correo. La operación principal no se revirtió.";
}
