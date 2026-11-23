const FALLBACK_SERVICE_CLIENT = { id: "", name: "Cliente", isSystem: false } as const;

/** En Servomotores el cliente del caso es la empresa Systron, no el cliente final. */
export function serviceClientForCompany<T extends { id: string; name: string; isSystem: boolean }>(
  viewingCompanyId: string,
  attention: {
    originCompanyId: string;
    serviceCompanyId: string;
    adminClient: T | null;
  },
  equipmentClient: T | null,
): T {
  const base = equipmentClient ?? (FALLBACK_SERVICE_CLIENT as T);
  if (
    viewingCompanyId === attention.serviceCompanyId
    && attention.originCompanyId !== attention.serviceCompanyId
    && attention.adminClient
  ) {
    return attention.adminClient;
  }
  return base;
}
