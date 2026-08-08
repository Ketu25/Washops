import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import { Badge, Dot } from "@/components/ui/badge";
import type { RequestStatus, RequestType } from "@/lib/types";

const statusTone = {
  pending: "warning",
  planned: "brand",
  completed: "success",
  cancelled: "neutral",
} as const;

const statusLabel: Record<RequestStatus, string> = {
  pending: "Pending",
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      <Dot tone={statusTone[status]} />
      {statusLabel[status]}
    </Badge>
  );
}

/**
 * Direction is the thing that distinguishes a pickup from a drop-off, so it
 * gets an arrow rather than relying on two similar words being read closely.
 */
export function TypeBadge({ type }: { type: RequestType }) {
  const Icon = type === "pickup" ? ArrowUpFromLine : ArrowDownToLine;
  return (
    <Badge tone="neutral" className="gap-1.5">
      <Icon aria-hidden className="size-3" />
      {type === "pickup" ? "Pickup" : "Drop-off"}
    </Badge>
  );
}
