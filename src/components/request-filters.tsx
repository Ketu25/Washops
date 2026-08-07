"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Input, Select, cn } from "./ui";

/**
 * Filters are held in the URL rather than component state so an admin can
 * bookmark "today's pending pickups" and share it with a driver.
 */
export function RequestFilters({ today }: { today: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    startTransition(() => {
      router.replace(next.size ? `/admin?${next}` : "/admin");
    });
  };

  const status = params.get("status") ?? "all";
  const type = params.get("type") ?? "all";
  const date = params.get("date") ?? "";
  const search = params.get("q") ?? "";

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-5",
        isPending && "opacity-60",
      )}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Status</span>
        <Select
          value={status}
          onChange={(event) => apply("status", event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="planned">Planned</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Type</span>
        <Select
          value={type}
          onChange={(event) => apply("type", event.target.value)}
        >
          <option value="all">Pickups & drop-offs</option>
          <option value="pickup">Pickups only</option>
          <option value="dropoff">Drop-offs only</option>
        </Select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Scheduled date</span>
        <Input
          type="date"
          value={date}
          onChange={(event) => apply("date", event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Search</span>
        <Input
          type="search"
          placeholder="Name, email, street…"
          defaultValue={search}
          onChange={(event) => apply("q", event.target.value)}
        />
      </label>

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(`/admin?date=${today}`))}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm transition hover:bg-background"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => router.replace("/admin"))}
          className="rounded-lg px-3 py-2 text-sm text-muted underline underline-offset-4 transition hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
