import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleNavHrefs } from "./nav-links";
import { SYSTRON_NAV, SYSTRON_NAV_FORBIDDEN } from "./role-nav-expectations";
import type { Role } from "./roles";

const CODE = "SYSTRON" as const;

describe("menú lateral por rol (SYSTRON)", () => {
  for (const [role, expected] of Object.entries(SYSTRON_NAV) as Array<[Role, readonly string[]]>) {
    it(`${role} muestra las entradas esperadas`, () => {
      const visible = visibleNavHrefs(role, CODE);
      for (const href of expected) {
        assert.equal(visible.includes(href), true, `${role} debería ver ${href}; visible: ${visible.join(", ")}`);
      }
      assert.equal(visible.length, expected.length, `${role} tiene entradas de más: ${visible.filter((h) => !expected.includes(h)).join(", ")}`);
    });
  }

  it("ningún rol ve el resumen global /inicio en el menú", () => {
    for (const role of Object.keys(SYSTRON_NAV) as Role[]) {
      const visible = visibleNavHrefs(role, CODE);
      assert.equal(visible.includes("/inicio"), false, `${role} no debería ver /inicio`);
    }
  });

  for (const [role, forbidden] of Object.entries(SYSTRON_NAV_FORBIDDEN) as Array<[Role, readonly string[]]>) {
    it(`${role} no muestra módulos prohibidos`, () => {
      const visible = visibleNavHrefs(role, CODE);
      for (const href of forbidden) {
        assert.equal(visible.includes(href), false, `${role} no debería ver ${href}`);
      }
    });
  }
});
