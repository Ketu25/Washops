"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { formatMiles, haversineMiles } from "@/lib/geo";
import { geocodeAddress, GeocodeError } from "@/lib/places";
import { upsertSettings } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { fieldErrors, settingsSchema } from "@/lib/validation";

import type { FormState } from "./auth";

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = {
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    serviceRadiusMiles: String(formData.get("serviceRadiusMiles") ?? ""),
  };

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  let geocoded;
  try {
    geocoded = await geocodeAddress(parsed.data.address);
  } catch (error) {
    return {
      fieldErrors: {
        address:
          error instanceof GeocodeError
            ? error.message
            : "We could not verify that address.",
      },
      values: raw,
    };
  }

  await upsertSettings({
    name: parsed.data.name,
    address: parsed.data.address,
    formattedAddress: geocoded.formattedAddress,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    serviceRadiusMiles: parsed.data.serviceRadiusMiles,
  });

  // The laundromat may have moved or the radius changed, so every stored
  // customer distance is now stale. Recompute them from the coordinates we
  // already hold — no geocoder calls needed — so the admin's out-of-range
  // list is accurate the moment this page reloads.
  const staleCount = await recomputeCustomerDistances(geocoded);

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/");

  const outOfRange = staleCount.outOfRange;
  return {
    success:
      `Settings saved. Service area is ${formatMiles(
        parsed.data.serviceRadiusMiles,
      )} miles around ${parsed.data.name}.` +
      (outOfRange > 0
        ? ` Heads up: ${outOfRange} existing customer${
            outOfRange === 1 ? "" : "s"
          } now fall outside this radius and will not be able to book new requests.`
        : ""),
  };
}

/**
 * Recalculate every customer's distance against the new laundromat location.
 * Existing requests keep their original snapshot on purpose — a driver
 * already dispatched should not see the job silently rewritten.
 */
async function recomputeCustomerDistances(origin: {
  latitude: number;
  longitude: number;
}): Promise<{ updated: number; outOfRange: number }> {
  const { data, error } = await db()
    .from("users")
    .select("id, latitude, longitude")
    .eq("role", "customer")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error || !data) return { updated: 0, outOfRange: 0 };

  const { data: settings } = await db()
    .from("laundromat_settings")
    .select("service_radius_miles")
    .eq("id", true)
    .maybeSingle();

  const radius = Number(settings?.service_radius_miles ?? 0);
  let outOfRange = 0;

  await Promise.all(
    data.map(async (row) => {
      const distance = haversineMiles(origin, {
        latitude: row.latitude as number,
        longitude: row.longitude as number,
      });
      if (distance > radius) outOfRange += 1;
      await db()
        .from("users")
        .update({ distance_miles: distance })
        .eq("id", row.id);
    }),
  );

  return { updated: data.length, outOfRange };
}
