import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPANY_THEME_SERVOMOTORES,
  COMPANY_THEME_SYSTRON,
  companyThemeDataAttribute,
} from "./company-theme";

describe("company-theme", () => {
  it("distingue Systron rojo-oro y Servomotores negro-gris", () => {
    assert.equal(COMPANY_THEME_SYSTRON.accent, "#A61E24");
    assert.equal(COMPANY_THEME_SYSTRON.accentSecondary, "#C9A227");
    assert.equal(COMPANY_THEME_SERVOMOTORES.accent, "#111827");
    assert.equal(COMPANY_THEME_SERVOMOTORES.accentSoft, "#f3f4f6");
    assert.notEqual(COMPANY_THEME_SYSTRON.accent, COMPANY_THEME_SERVOMOTORES.accent);
  });

  it("resuelve data-company", () => {
    assert.equal(companyThemeDataAttribute("SERVOMOTORES"), "SERVOMOTORES");
    assert.equal(companyThemeDataAttribute("SYSTRON"), "SYSTRON");
    assert.equal(companyThemeDataAttribute(null), "SYSTRON");
  });
});