export function suggestCollaboratorUsername(fullName: string): string {
  const cleaned = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  if (parts.length >= 4) {
    return `${parts[0]}.${parts[2]}`;
  }
  return `${parts[0]}.${parts[1]}`;
}

export function generateCollaboratorPassword(seed?: number): string {
  const adjectives = ["Sygos", "Acceso", "Clave", "Portal", "Equipo"];
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const rand = (max: number, idx: number) => {
    if (seed != null) {
      return Math.abs(Math.floor(Math.sin(seed + idx * 17) * 10000)) % max;
    }
    return Math.floor(Math.random() * max);
  };
  const prefix = adjectives[rand(adjectives.length, 0)] ?? "Sygos";
  const digits = String(1000 + rand(9000, 1));
  const suffix =
    (chars[rand(chars.length, 2)] ?? "a") +
    (chars[rand(chars.length, 3)] ?? "b") +
    (chars[rand(chars.length, 4)] ?? "c");
  return `${prefix}-${digits}!${suffix}`;
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

export function formatCollaboratorCredentialsMessage(input: {
  name: string;
  username: string;
  password: string;
  roleLabel: string;
  companyName?: string | null;
}): string {
  const company = input.companyName?.trim() || "SYGOS";
  return [
    `Hola ${input.name.trim()}, bienvenido(a) a ${company} en SYGOS 3.0.`,
    "",
    "Tus credenciales de acceso al sistema son:",
    `• Usuario: ${input.username.trim()}`,
    `• Contraseña: ${input.password}`,
    `• Rol: ${input.roleLabel}`,
    "",
    "Ingresa con estos datos para comenzar tu operación.",
  ].join("\n");
}

export function buildCollaboratorWhatsAppUrl(input: {
  phone: string | null | undefined;
  name: string;
  username: string;
  password: string;
  roleLabel: string;
  companyName?: string | null;
}): string {
  const digits = normalizeWhatsAppPhone(input.phone);
  const message = formatCollaboratorCredentialsMessage(input);
  const encoded = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
