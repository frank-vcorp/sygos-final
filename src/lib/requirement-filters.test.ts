import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requirementListHref, requirementStatusFilter } from "./requirement-filters";

describe("filtros de requerimientos", () => {
  it("crea enlaces compactos que preservan los filtros activos", () => {
    assert.equal(
      requirementListHref({ estado: "EN_LISTA", solicitante: " usr-1 ", fecha: "2026-10-27" }),
      "/compras/requerimientos?estado=EN_LISTA&solicitante=usr-1&fecha=2026-10-27",
    );
  });

  it("omite el estado predeterminado y normaliza estados no permitidos", () => {
    assert.equal(requirementListHref({ estado: "PENDIENTE" }), "/compras/requerimientos");
    assert.equal(requirementStatusFilter("DESCONOCIDO"), "PENDIENTE");
    assert.equal(requirementStatusFilter("ATENDIDO"), "ATENDIDO");
  });
});
