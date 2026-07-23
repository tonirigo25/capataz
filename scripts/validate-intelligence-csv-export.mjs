import { expect, loadTsModule } from "./ts-test-loader.mjs";

function nextServerMock() {
  class MockNextResponse extends Response {
    constructor(body, init) {
      super(body, init);
    }

    static json(body, init = {}) {
      return new MockNextResponse(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(init.headers ?? {})
        }
      });
    }

    static next() {
      return { kind: "next" };
    }

    static rewrite(url) {
      return { kind: "rewrite", url: String(url) };
    }

    static redirect(url) {
      return { kind: "redirect", url: String(url) };
    }
  }

  return { NextResponse: MockNextResponse };
}

function loadMiddleware() {
  return loadTsModule("middleware.ts", { mocks: { "next/server": nextServerMock() } });
}

function loadRoute({ requireCompanyContext, buildBusinessCsvExport }) {
  return loadTsModule("app/(app)/inteligencia/export/route.ts", {
    mocks: {
      "next/server": nextServerMock(),
      "@/lib/auth/session": { requireCompanyContext },
      "@/lib/commercial/authorization": { requireCapability: requireCompanyContext },
      "@/lib/business-intelligence": { buildBusinessCsvExport }
    }
  });
}

function middlewareRequest(path, authenticated = false) {
  return {
    nextUrl: new URL(`https://example.test${path}`),
    url: `https://example.test${path}`,
    cookies: { has: (name) => authenticated && name === "capataz_session" }
  };
}

const middleware = loadMiddleware();
expect(middleware.middleware(middlewareRequest("/inteligencia/export?tipo=works")).kind === "redirect", "[intelligence-csv] anonymous export must redirect to login");
expect(middleware.middleware(middlewareRequest("/inteligencia/export?tipo=works", true)).kind === "next", "[intelligence-csv] authenticated export must reach its tenant guard");
expect(middleware.middleware(middlewareRequest("/inteligencia", true)).kind === "next", "[intelligence-csv] authenticated intelligence page must not remain blocked");

const calls = [];
const route = loadRoute({
  requireCompanyContext: async () => ({ companyId: "company-A", userId: "user-A", sessionId: "session-A", membershipId: "membership-A", role: "OWNER", isDemo: false, companyName: "Empresa A" }),
  buildBusinessCsvExport: async (tipo, params) => {
    calls.push({ tipo, params });
    if (tipo === "works") return '"obra","cliente"\n"Obra A","Cliente A"';
    if (tipo === "pending-invoices") return '"factura","cliente","concepto"\n"Factura A","Cliente A","Hito A"';
    return '"metrica","valor"\n"Facturado","100"';
  }
});

const works = await route.GET(new Request("https://example.test/inteligencia/export?tipo=works&companyId=company-B&periodo=this_month"));
const worksText = await works.text();
expect(works.status === 200, "[intelligence-csv] works export should return 200", works.status);
expect(works.headers.get("content-type")?.startsWith("text/csv"), "[intelligence-csv] works export should be text/csv", Object.fromEntries(works.headers));
expect(works.headers.get("content-disposition")?.includes("attachment"), "[intelligence-csv] works export should be attachment", Object.fromEntries(works.headers));
expect(works.headers.get("cache-control") === "private, no-store", "[intelligence-csv] works export should be private/no-store", Object.fromEntries(works.headers));
expect(works.headers.get("x-content-type-options") === "nosniff", "[intelligence-csv] works export should set nosniff", Object.fromEntries(works.headers));
expect(worksText.includes("Obra A") && !worksText.includes("Obra B"), "[intelligence-csv] works CSV must contain only authenticated tenant data", worksText);
expect(calls.at(-1).params.companyId === "company-A", "[intelligence-csv] route must derive companyId from session, not query string", calls.at(-1));

const pending = await route.GET(new Request("https://example.test/inteligencia/export?tipo=pending-invoices"));
const pendingText = await pending.text();
expect(pending.status === 200, "[intelligence-csv] pending-invoices export should return 200", pending.status);
expect(pending.headers.get("content-type")?.startsWith("text/csv"), "[intelligence-csv] pending-invoices export should be text/csv", Object.fromEntries(pending.headers));
expect(pending.headers.get("content-disposition")?.includes("attachment"), "[intelligence-csv] pending-invoices export should be attachment", Object.fromEntries(pending.headers));
expect(pendingText.includes("Factura A") && !pendingText.includes("Factura B"), "[intelligence-csv] pending-invoices CSV must contain only authenticated tenant data", pendingText);

const invalid = await route.GET(new Request("https://example.test/inteligencia/export?tipo=../../secret"));
const invalidText = await invalid.text();
expect(invalid.status === 400, "[intelligence-csv] unknown export type should return 400", invalid.status);
expect(!/Prisma|stack|companyId|DATABASE_URL/i.test(invalidText), "[intelligence-csv] unknown export type must not leak internals", invalidText);

const failingRoute = loadRoute({
  requireCompanyContext: async () => ({ companyId: "company-A", userId: "user-A", sessionId: "session-A", membershipId: "membership-A", role: "OWNER", isDemo: false, companyName: "Empresa A" }),
  buildBusinessCsvExport: async () => {
    throw new Error("Prisma stack with DATABASE_URL and companyId should not leak");
  }
});
const failing = await failingRoute.GET(new Request("https://example.test/inteligencia/export?tipo=works"));
const failingText = await failing.text();
expect(failing.status === 500, "[intelligence-csv] export generation failures should return safe 500", failing.status);
expect(failing.headers.get("content-type")?.startsWith("application/json"), "[intelligence-csv] export generation failures should not render HTML", Object.fromEntries(failing.headers));
expect(!/Prisma|stack|companyId|DATABASE_URL/i.test(failingText), "[intelligence-csv] export generation failures must not leak internals", failingText);

const noSessionRoute = loadRoute({
  requireCompanyContext: async () => {
    throw new Response(null, { status: 307, headers: { Location: "/login" } });
  },
  buildBusinessCsvExport: async () => {
    throw new Error("should not export without session");
  }
});
try {
  await noSessionRoute.GET(new Request("https://example.test/inteligencia/export?tipo=works"));
  expect(false, "[intelligence-csv] unauthenticated export should not succeed");
} catch (error) {
  expect(error instanceof Response && error.status === 307, "[intelligence-csv] unauthenticated export should redirect or fail safely, not HTML 200", error);
}

function invoice(overrides = {}) {
  return {
    id: "invoice-1",
    numero: "F-1",
    concepto: "Hito A",
    total: 100,
    pagado: 0,
    pendiente: 100,
    estado: "emitida",
    fechaEmision: new Date(2026, 6, 1),
    fechaVencimiento: new Date(2026, 6, 15),
    clienteId: "client-A",
    obraId: "work-A",
    client: { id: "client-A", nombre: "Cliente A", tipo: "empresa", nifCif: "B00000000", direccionFiscal: "Calle A" },
    work: { id: "work-A", titulo: "Obra A" },
    payments: [],
    ...overrides
  };
}

const dangerousPrisma = {
  invoice: {
    findMany: async (query) => query?.where?.fechaEmision ? [invoice()] : [invoice()]
  },
  payment: { findMany: async () => [] },
  expense: { findMany: async () => [] },
  budget: { findMany: async () => [] },
  work: {
    findMany: async () => [{
      id: "work-A",
      titulo: "=SUM(1,1)",
      estado: "en_curso",
      costePrevisto: 0,
      gastoReal: 0,
      presupuestoAprobado: 100,
      client: { id: "client-A", nombre: "+Cliente A" },
      invoices: [invoice()],
      expenses: [],
      budgets: []
    }]
  },
  client: {
    findMany: async () => [{
      id: "client-A",
      nombre: "+Cliente A",
      tipo: "empresa",
      nifCif: "B00000000",
      direccionFiscal: "Calle A",
      invoices: [invoice()],
      payments: [],
      works: [{ id: "work-A" }]
    }]
  },
  reminder: { findMany: async () => [] },
  document: { findMany: async () => [] }
};

const bi = loadTsModule("lib/business-intelligence.ts", { mocks: { "@/lib/prisma": { prisma: dangerousPrisma } } });
const dangerousCsv = await bi.buildBusinessCsvExport("works", { companyId: "company-A", period: "this_month", now: new Date(2026, 6, 10) });
expect(dangerousCsv.includes("\"'=SUM(1,1)\""), "[intelligence-csv] CSV formula values should be neutralized", dangerousCsv);
expect(dangerousCsv.includes("\"'+Cliente A\""), "[intelligence-csv] CSV formula-like client values should be neutralized", dangerousCsv);

console.log("[intelligence-csv] OK middleware bypass, route contract, tenant scope and CSV injection guard");
