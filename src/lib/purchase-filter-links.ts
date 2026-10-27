import { listHref } from "./list-url";

export type ShoppingListFilters = {
  estado?: string;
  proveedor?: string;
  fecha?: string;
};

export function shoppingListHref(filters: ShoppingListFilters) {
  return listHref("/compras/listas", {
    estado: filters.estado === "TODAS" ? undefined : filters.estado,
    proveedor: filters.proveedor?.trim() || undefined,
    fecha: filters.fecha || undefined,
  });
}

export type PurchaseFilters = {
  vista?: string;
  q?: string;
  estado?: string;
  fecha?: string;
  categoria?: string;
  proveedor?: string;
  solicitante?: string;
};

export function purchaseListHref(filters: PurchaseFilters) {
  return listHref("/compras", {
    vista: !filters.vista || filters.vista === "compras" ? undefined : filters.vista,
    q: filters.q?.trim() || undefined,
    estado: filters.estado || undefined,
    fecha: filters.fecha || undefined,
    categoria: filters.categoria?.trim() || undefined,
    proveedor: filters.proveedor?.trim() || undefined,
    solicitante: filters.solicitante?.trim() || undefined,
  });
}
