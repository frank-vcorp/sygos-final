export function sanitizeIntegrationNotice(raw: string | null | undefined): string {
  let text = String(raw ?? "").trim();
  if (!text) return "";
  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      text = decodeURIComponent(text.replace(/\+/g, " ")).trim();
    } catch {
      // Already decoded or not a valid escape sequence.
    }
  }
  if (text === "NEXT_REDIRECT" || text.startsWith("NEXT_REDIRECT")) {
    return "No se pudo mostrar el resultado de SendGrid. Vuelve a intentar la verificación o el correo de prueba.";
  }
  return text;
}
