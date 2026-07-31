import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertScopedEntityAccess: vi.fn(),
  invalidateActionPath: vi.fn(),
  navigateAction: vi.fn(),
  reevaluateProactiveAfterMutation: vi.fn(),
  requireCapability: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/application/action-effects", () => ({
  invalidateActionPath: mocks.invalidateActionPath,
  navigateAction: mocks.navigateAction,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("@/lib/proactive-evaluation", () => ({
  reevaluateProactiveAfterMutation: mocks.reevaluateProactiveAfterMutation,
}));

vi.mock("@/lib/commercial/authorization", () => ({
  assertScopedEntityAccess: mocks.assertScopedEntityAccess,
  requireCapability: mocks.requireCapability,
}));

import { restoreClient } from "../../lib/application/operations/client-use-cases";

const auth = {
  userId: "user-1",
  companyId: "company-1",
  membershipId: "membership-1",
  role: "MEMBER",
  commercialStatus: "ACTIVE",
  capability: "clients.update",
  scope: "SELECTED_CLIENTS",
};

function restoreForm(clientId = "client-1") {
  const formData = new FormData();
  formData.set("id", clientId);
  return formData;
}

describe("restoreClient scope guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapability.mockResolvedValue(auth);
    mocks.assertScopedEntityAccess.mockResolvedValue(undefined);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.reevaluateProactiveAfterMutation.mockResolvedValue(undefined);
  });

  it("rejects a client outside the caller scope before any write", async () => {
    mocks.assertScopedEntityAccess.mockRejectedValue(
      new Error("SCOPED_ENTITY_FORBIDDEN"),
    );

    await expect(restoreClient(restoreForm("client-outside-scope"))).rejects.toThrow(
      "SCOPED_ENTITY_FORBIDDEN",
    );

    expect(mocks.assertScopedEntityAccess).toHaveBeenCalledWith(
      auth,
      "clients.update",
      "Client",
      "client-outside-scope",
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.reevaluateProactiveAfterMutation).not.toHaveBeenCalled();
    expect(mocks.invalidateActionPath).not.toHaveBeenCalled();
    expect(mocks.navigateAction).not.toHaveBeenCalled();
  });

  it("restores an in-scope client using the authenticated company boundary", async () => {
    await restoreClient(restoreForm());

    expect(mocks.requireCapability).toHaveBeenCalledWith("clients.update");
    expect(mocks.assertScopedEntityAccess).toHaveBeenCalledWith(
      auth,
      "clients.update",
      "Client",
      "client-1",
    );
    expect(mocks.assertScopedEntityAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateMany.mock.invocationCallOrder[0],
    );
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "client-1", companyId: "company-1" },
      data: { archivadoAt: null },
    });
    expect(mocks.reevaluateProactiveAfterMutation).toHaveBeenCalledWith({
      companyId: "company-1",
      entityType: "client",
      entityId: "client-1",
      clientId: "client-1",
      reason: "client_restored",
    });
    expect(mocks.navigateAction).toHaveBeenCalledWith("/clientes/client-1");
  });
});
