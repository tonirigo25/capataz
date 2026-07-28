"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { inviteMember as inviteMemberUseCase, changeFunctionalProfile as changeFunctionalProfileUseCase, setAccessPackage as setAccessPackageUseCase, setPermissionOverride as setPermissionOverrideUseCase, setFieldVisibility as setFieldVisibilityUseCase, setApprovalAuthority as setApprovalAuthorityUseCase, setScopeAssignment as setScopeAssignmentUseCase, approveInvitation as approveInvitationUseCase, rejectInvitation as rejectInvitationUseCase, revokeInvitation as revokeInvitationUseCase, updatePendingInvitation as updatePendingInvitationUseCase, processOutbox as processOutboxUseCase, changeMembershipState as changeMembershipStateUseCase, transferOwnership as transferOwnershipUseCase } from "@/lib/application/company/membership-use-cases";

export async function inviteMember(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#inviteMember" }, () => inviteMemberUseCase(formData));
}

export async function changeFunctionalProfile(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#changeFunctionalProfile" }, () => changeFunctionalProfileUseCase(formData));
}

export async function setAccessPackage(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#setAccessPackage" }, () => setAccessPackageUseCase(formData));
}

export async function setPermissionOverride(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#setPermissionOverride" }, () => setPermissionOverrideUseCase(formData));
}

export async function setFieldVisibility(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#setFieldVisibility" }, () => setFieldVisibilityUseCase(formData));
}

export async function setApprovalAuthority(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#setApprovalAuthority" }, () => setApprovalAuthorityUseCase(formData));
}

export async function setScopeAssignment(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#setScopeAssignment" }, () => setScopeAssignmentUseCase(formData));
}

export async function approveInvitation(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#approveInvitation" }, () => approveInvitationUseCase(formData));
}

export async function rejectInvitation(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#rejectInvitation" }, () => rejectInvitationUseCase(formData));
}

export async function revokeInvitation(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#revokeInvitation" }, () => revokeInvitationUseCase(formData));
}

export async function updatePendingInvitation(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#updatePendingInvitation" }, () => updatePendingInvitationUseCase(formData));
}

export async function processOutbox(_previous: { previewHtml: string | null }, formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#processOutbox" }, () => processOutboxUseCase(_previous, formData));
}

export async function changeMembershipState(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#changeMembershipState" }, () => changeMembershipStateUseCase(formData));
}

export async function transferOwnership(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/equipo/actions.ts#transferOwnership" }, () => transferOwnershipUseCase(formData));
}
