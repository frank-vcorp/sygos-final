import { cookies } from "next/headers";

export type Flash = { tone: "ok" | "error"; message: string };

export async function setFlash(flash: Flash) {
  const jar = await cookies();
  jar.set("sygos_flash", JSON.stringify(flash), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 20,
  });
}

export async function takeFlash(): Promise<Flash | null> {
  const jar = await cookies();
  const raw = jar.get("sygos_flash")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Flash;
    if ((parsed.tone === "ok" || parsed.tone === "error") && typeof parsed.message === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
