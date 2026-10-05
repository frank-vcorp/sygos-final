"use server";

import { cookies } from "next/headers";

export async function clearFlashAction() {
  const jar = await cookies();
  jar.delete("sygos_flash");
}
