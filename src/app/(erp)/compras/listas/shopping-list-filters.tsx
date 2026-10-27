"use client";

import { CompactFilterBar, useAutoFilters } from "@/components/auto-filter-bar";
import { controlClass } from "@/components/ui";
import { shoppingListHref } from "@/lib/purchase-filter-links";

export function ShoppingListFilters({
  estado,
  proveedor,
  fecha,
  suppliers,
}: {
  estado: string;
  proveedor: string;
  fecha: string;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const { filters, update, apply } = useAutoFilters({
    initialFilters: { estado, proveedor, fecha },
    toHref: shoppingListHref,
  });

  return (
    <CompactFilterBar onSubmit={apply}>
      <select
        name="estado"
        value={filters.estado}
        className={`${controlClass} sm:w-auto sm:min-w-[13rem]`}
        aria-label="Estado de lista de compras"
        onChange={(event) => update("estado", event.target.value)}
      >
        <option value="ABIERTA">Listas abiertas</option>
        <option value="CONVERTIDA">Listas convertidas en compra</option>
        <option value="TODAS">Todas las listas</option>
      </select>
      <select
        name="proveedor"
        value={filters.proveedor}
        className={`${controlClass} sm:min-w-[12rem] sm:flex-1`}
        aria-label="Proveedor"
        onChange={(event) => update("proveedor", event.target.value)}
      >
        <option value="">Todos los proveedores</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <input
        name="fecha"
        type="date"
        value={filters.fecha}
        className={`${controlClass} sm:w-auto`}
        aria-label="Fecha de creación"
        onChange={(event) => update("fecha", event.target.value)}
      />
    </CompactFilterBar>
  );
}
