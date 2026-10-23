import { prisma } from "@/lib/db";
import { INVENTORY_AUTOCOMPLETE_LIMIT, INVENTORY_SEARCH_MIN_LEN, searchInventoryParts } from "@/lib/inventory-search";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.activeCompanyId || !session.activeCompanyCode || !can(session.role, "inventory.search", session.activeCompanyCode)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company?.inventoryEnabled) {
    return Response.json({ error: "Inventario deshabilitado" }, { status: 404 });
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < INVENTORY_SEARCH_MIN_LEN) {
    return Response.json({ items: [] as const });
  }
  const limit = Math.min(INVENTORY_AUTOCOMPLETE_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || INVENTORY_AUTOCOMPLETE_LIMIT));
  const items = await searchInventoryParts(prisma, company.id, q, limit);
  return Response.json({ items });
}
