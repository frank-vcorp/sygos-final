import { prisma } from "./db";

export async function recordHistory(input: {
  companyId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  authorUserId?: string | null;
}) {
  await prisma.functionalHistory.create({
    data: {
      companyId: input.companyId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      authorUserId: input.authorUserId ?? null,
    },
  });
}

export async function historyFor(entityType: string, entityId: string) {
  return prisma.functionalHistory.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true, username: true } } },
  });
}
