import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coordCompanyLabel,
  coordFilterChips,
  coordPageSubtitle,
  coordPageTitle,
  coordUsesSidebarNav,
} from "./coordination-ui";

describe("coordUsesSidebarNav", () => {
  it("solo aplica a Coordinación de Administración", () => {
    assert.equal(coordUsesSidebarNav("COORDINACION_ADMINISTRACION"), true);
    assert.equal(coordUsesSidebarNav("CEO"), false);
    assert.equal(coordUsesSidebarNav("ADMINISTRADOR"), false);
  });
});

describe("coord page shell", () => {
  it("prioriza título de sección y subtítulo por empresa", () => {
    assert.equal(coordPageTitle(true, "Ingresos", "Finanzas"), "Ingresos");
    assert.equal(coordPageTitle(false, "Ingresos", "Finanzas"), "Finanzas");
    assert.equal(
      coordPageSubtitle(true, "SYSTRON", "Texto largo legacy", "Captura del mes"),
      "SYSTRON · Captura del mes",
    );
    assert.equal(coordPageSubtitle(false, "SYSTRON", "Texto largo legacy", "Captura del mes"), "Texto largo legacy");
    assert.equal(coordCompanyLabel("SERVOMOTORES"), "Servomotores");
  });

  it("oculta chips de vista con menú lateral", () => {
    const chips = [{ label: "Por validar", clearHref: "/pagos" }];
    assert.deepEqual(coordFilterChips(true, chips), []);
    assert.deepEqual(coordFilterChips(false, chips), chips);
  });
});
