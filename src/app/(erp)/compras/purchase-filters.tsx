"use client";

import { CompactFilterBar, useAutoFilters } from "@/components/auto-filter-bar";
import { controlClass } from "@/components/ui";
import { purchaseListHref } from "@/lib/purchase-filter-links";

type Option = { id: string; name: string };

export function PurchaseFilters({
  vista,
  q,
  estado,
  fecha,
  categoria,
  proveedor,
  solicitante,
  suppliers,
  categories,
  requesters,
  showPurchaseFilters,
  showOrderFilters,
}: {
  vista: string;
  q: string;
  estado: string;
  fecha: string;
  categoria: string;
  proveedor: string;
  solicitante: string;
  suppliers: Option[];
  categories: Option[];
  requesters: Option[];
  showPurchaseFilters: boolean;
  showOrderFilters: boolean;
}) {
  const { filters, update, apply } = useAutoFilters({
    initialFilters: { vista, q, estado, fecha, categoria, proveedor, solicitante },
    toHref: purchaseListHref,
    debouncedKeys: ["q"],
  });

  return (
    <CompactFilterBar onSubmit={apply} className="lg:[&>select]:max-w-[13rem]">
      {showPurchaseFilters || showOrderFilters ? (
        <>
          <select name="estado" value={filters.estado} className={`${controlClass} sm:w-auto sm:min-w-[12rem]`} aria-label="Estado" onChange={(event) => update("estado", event.target.value)}>
            {showOrderFilters ? (
              <>
                <option value="PENDIENTE_AUTORIZACION">Pendiente de autorización</option>
                <option value="AUTORIZADA">Autorizada</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="PROCESADA">Procesada</option>
                <option value="CANCELADA">Cancelada</option>
              </>
            ) : (
              <option value="PENDIENTE_VALIDAR">Pendiente de validación</option>
            )}
          </select>
          <input name="fecha" type="date" value={filters.fecha} className={`${controlClass} sm:w-auto`} aria-label="Fecha" onChange={(event) => update("fecha", event.target.value)} />
          <select name="proveedor" value={filters.proveedor} className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} aria-label="Proveedor" onChange={(event) => update("proveedor", event.target.value)}>
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select name="categoria" value={filters.categoria} className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} aria-label="Categoría de egreso" onChange={(event) => update("categoria", event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select name="solicitante" value={filters.solicitante} className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} aria-label="Solicitante" onChange={(event) => update("solicitante", event.target.value)}>
            <option value="">Todos los solicitantes</option>
            {requesters.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </>
      ) : null}
      <input type="hidden" name="vista" value={filters.vista} />
      <input
        name="q"
        value={filters.q}
        placeholder="Folio o descripción"
        className={`${controlClass} sm:min-w-[14rem] sm:flex-1`}
        aria-label="Buscar por folio o descripción"
        onChange={(event) => update("q", event.target.value)}
      />
    </CompactFilterBar>
  );
}
