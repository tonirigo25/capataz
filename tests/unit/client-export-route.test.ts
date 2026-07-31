import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  resolveAuthorization: vi.fn(),
  resolveScopedEntityIds: vi.fn(),
  getClientList: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/platform/request-boundary", () => ({
  publicRequestContext: (
    _name: string,
    _request: Request,
    callback: () => unknown,
  ) => callback(),
}));

vi.mock("@/lib/commercial/authorization", () => ({
  requireCapability: mocks.requireCapability,
  resolveAuthorization: mocks.resolveAuthorization,
  resolveScopedEntityIds: mocks.resolveScopedEntityIds,
}));

vi.mock("@/lib/client-crm", () => ({
  getClientList: mocks.getClientList,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findMany: mocks.findMany } },
}));

import { GET } from "@/app/(app)/clientes/export/route";

const auth = {
  companyId: "company-a",
  userId: "user-a",
  membershipId: "membership-a",
  role: "OWNER",
};

describe("GET /clientes/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapability.mockResolvedValue(auth);
    mocks.resolveScopedEntityIds.mockResolvedValue(null);
    mocks.resolveAuthorization.mockResolvedValue({
      allowed: true,
      reason: "allowed",
      scope: "COMPANY",
    });
    mocks.findMany.mockResolvedValue([]);
  });

  it("requires clients.export, preserves current filters and neutralizes CSV formulas", async () => {
    mocks.resolveScopedEntityIds.mockResolvedValue(["client-1"]);
    mocks.getClientList.mockResolvedValue({
      items: [fullClient({ displayName: "=HYPERLINK(\"https://bad\")" })],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      typeOptions: [],
      activeFilters: [],
    });

    const response = await GET(
      new Request(
        "https://app.orqenatech.com/clientes/export?vista=todos&buscar=Rigo&estado=nuevo&tipo=Empresa&archivo=todos&ordenar=nombre_desc&filtro=datos_incompletos&filtro=sin_actividad_reciente",
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireCapability).toHaveBeenCalledWith("clients.export");
    expect(mocks.resolveScopedEntityIds).toHaveBeenCalledWith(
      auth,
      "clients.view",
      "Client",
    );
    expect(mocks.getClientList).toHaveBeenCalledWith(
      expect.objectContaining({
        vista: "todos",
        buscar: "Rigo",
        estado: "nuevo",
        tipo: "Empresa",
        archivo: "todos",
        ordenar: "nombre_desc",
        filtros: "datos_incompletos,sin_actividad_reciente",
        pagina: "1",
      }),
      "company-a",
      ["client-1"],
    );
    expect(body).toContain("\"'=HYPERLINK(\"\"https://bad\"\")\"");
    expect(body).not.toContain("\"=HYPERLINK");
    expect(body).toContain("\"Saldo pendiente\"");
  });

  it("keeps company and client scope while excluding unauthorized economic fields", async () => {
    mocks.resolveAuthorization.mockImplementation(
      async (_context: unknown, capability: string) =>
        capability === "clients.view"
          ? { allowed: true, reason: "allowed", scope: "SELECTED_CLIENTS" }
          : { allowed: false, reason: "permission", scope: "COMPANY" },
    );
    mocks.resolveScopedEntityIds.mockResolvedValue(["client-a"]);
    mocks.findMany.mockResolvedValue([
      {
        id: "client-a",
        nombre: "Rigo Asociados",
        nombreComercial: "+SUM(1,1)",
        razonSocial: "Rigo Asociados",
        nifCif: "B12345678",
        telefono: "600000000",
        email: "demo@example.test",
        tipo: "empresa",
        estado: "pendiente_cobro",
        contactoPrincipalNombre: "Marta",
        contactoPrincipalEmail: null,
        contactoPrincipalTelefono: null,
        ultimaInteraccion: new Date("2026-07-29T12:00:00.000Z"),
      },
    ]);

    const response = await GET(
      new Request(
        "https://app.orqenatech.com/clientes/export?vista=accion&ordenar=nombre_desc&buscar=Rigo",
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.getClientList).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-a",
          id: { in: ["client-a"] },
          archivadoAt: null,
          estado: { in: expect.arrayContaining(["pendiente_cobro"]) },
        }),
        orderBy: { nombre: "desc" },
      }),
    );
    expect(body).toContain("\"'+SUM(1,1)\"");
    expect(body).not.toContain("Saldo pendiente");
    expect(body).not.toContain("Facturado");
    expect(body).not.toContain("Presupuestado");
    expect(body).toContain("\"Abrir ficha\"");
  });

  it("refuses export when the caller cannot view clients", async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce({
      allowed: false,
      reason: "permission",
      scope: "COMPANY",
    });

    const response = await GET(
      new Request("https://app.orqenatech.com/clientes/export"),
    );

    expect(response.status).toBe(403);
    expect(mocks.resolveScopedEntityIds).not.toHaveBeenCalled();
    expect(mocks.getClientList).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

function fullClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    displayName: "Cliente uno",
    fiscalName: "Cliente Uno SL",
    fiscalId: "B12345678",
    typeLabel: "Empresa",
    status: "nuevo",
    primaryContact: "Marta Ruiz",
    phone: "600000000",
    email: "marta@example.test",
    lastActivityAt: new Date("2026-07-29T10:00:00.000Z"),
    nextAction: "Registrar próxima acción",
    activeWorksCount: 1,
    totalWorksCount: 2,
    budgetedTotal: 1000,
    billedTotal: 800,
    paidTotal: 500,
    pendingTotal: 300,
    pendingInvoicesCount: 1,
    overdueInvoicesCount: 0,
    pendingBudgetsCount: 1,
    ...overrides,
  };
}
