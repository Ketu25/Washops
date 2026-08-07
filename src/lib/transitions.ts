import type { RequestStatus } from "./types";

/**
 * Legal status moves. A request only ever advances; completed and cancelled
 * are terminal.
 *
 * This lives in its own module — free of `server-only` — because both the
 * server (enforcing) and the admin UI (deciding which buttons to render) have
 * to agree on it. Two copies of this table would eventually disagree.
 */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["planned", "completed", "cancelled"],
  planned: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
