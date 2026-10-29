import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLinkActive, pickGlobalActiveNavHref } from "./side-nav-active";

const emptySearch = () => new URLSearchParams();
const noHash = "";

describe("side-nav active link selection", () => {
  it("activates exact path match for /compras", () => {
    assert.equal(isLinkActive("/compras", emptySearch(), "/compras", noHash), true);
    assert.equal(
      pickGlobalActiveNavHref("/compras", emptySearch(), ["/compras", "/compras/requerimientos"], noHash),
      "/compras",
    );
  });

  it("prefers /compras/requerimientos over /compras on requerimientos routes", () => {
    const hrefs = ["/compras", "/compras/requerimientos", "/compras/listas", "/compras?vista=oc"];
    assert.equal(
      pickGlobalActiveNavHref("/compras/requerimientos", emptySearch(), hrefs, noHash),
      "/compras/requerimientos",
    );
    assert.equal(
      pickGlobalActiveNavHref("/compras/requerimientos/nuevo", emptySearch(), hrefs, noHash),
      "/compras/requerimientos",
    );
    assert.equal(isLinkActive("/compras/requerimientos", emptySearch(), "/compras", noHash), true);
    assert.equal(isLinkActive("/compras/requerimientos", emptySearch(), "/compras/requerimientos", noHash), true);
  });

  it("keeps /compras active for purchase detail under /compras", () => {
    const hrefs = ["/compras", "/compras/requerimientos"];
    assert.equal(pickGlobalActiveNavHref("/compras/abc-123", emptySearch(), hrefs, noHash), "/compras");
  });

  it("prefers query-specific compras vista over plain /compras", () => {
    const hrefs = ["/compras", "/compras?vista=oc"];
    const search = new URLSearchParams("vista=oc");
    assert.equal(pickGlobalActiveNavHref("/compras", search, hrefs, noHash), "/compras?vista=oc");
    assert.equal(isLinkActive("/compras", search, "/compras", noHash), false);
    assert.equal(isLinkActive("/compras", search, "/compras?vista=oc", noHash), true);
  });

  it("does not treat /compras as active when only vista query is set without matching link", () => {
    const search = new URLSearchParams("vista=oc");
    assert.equal(isLinkActive("/compras", search, "/compras", noHash), false);
  });
});
