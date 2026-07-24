import type { EntitySelection } from "./types";
export function clearIncompatibleRelations(previous: EntitySelection, next: EntitySelection): EntitySelection {
  if (next.clientId !== undefined && next.clientId !== previous.clientId) return { clientId: next.clientId };
  if (next.workId !== undefined && next.workId !== previous.workId) return { clientId: next.clientId ?? previous.clientId, workId: next.workId };
  return { ...previous, ...next };
}
