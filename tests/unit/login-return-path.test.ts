import { describe, expect, it } from "vitest";
import { normalizeLoginReturnPath } from "../../lib/auth/return-path";

describe("normalizeLoginReturnPath", () => {
  it("preserves an internal route, query and fragment", () => {
    expect(normalizeLoginReturnPath("/clientes?tab=activos#lista")).toBe("/clientes?tab=activos#lista");
  });

  it.each([
    "",
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/login",
    "/recuperar-contrasena"
  ])("fails closed for %s", (candidate) => {
    expect(normalizeLoginReturnPath(candidate)).toBe("/hoy");
  });
});
