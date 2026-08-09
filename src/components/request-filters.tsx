"use client";

import { RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

/**
 * Filters live in the URL rather than component state so an admin can
 * bookmark "today's pending pickups" and send it to a driver.
 */
export function RequestFilters({ today }: { today: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.replace(next.size ? `/admin?${next}` : "/admin");
    });
  };

  const status = params.get("status") ?? "all";
  const type = params.get("type") ?? "all";
  const date = params.get("date") ?? "";
  const search = params.get("q") ?? "";
  const active = status !== "all" || type !== "all" || date !== "" || search !== "";

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <div className="flex min-w-52 flex-1 flex-col gap-1.5">
        <Label htmlFor="filter-search">Search</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            id="filter-search"
            type="search"
            placeholder="Name, email, street…"
            defaultValue={search}
            onChange={(event) => apply("q", event.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex w-48 flex-col gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={status}
          onChange={(event) => apply("status", event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="awaiting_dropoff">Awaiting drop-off</option>
          <option value="pending">Pending</option>
          <option value="planned">Planned</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-type">Type</Label>
        <Select
          id="filter-type"
          value={type}
          onChange={(event) => apply("type", event.target.value)}
        >
          <option value="all">Pickups &amp; drop-offs</option>
          <option value="pickup">Pickups only</option>
          <option value="dropoff">Drop-offs only</option>
        </Select>
      </div>

      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="filter-date">Scheduled date</Label>
        <Input
          id="filter-date"
          type="date"
          value={date}
          onChange={(event) => apply("date", event.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => startTransition(() => router.replace(`/admin?date=${today}`))}
        >
          Today
        </Button>
        {/* Only offered when there is something to clear. */}
        {active ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => startTransition(() => router.replace("/admin"))}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}
