import "server-only";

import { db } from "./supabase";
import type { SettingsRow } from "./types";

/**
 * The laundromat config is a single row. It may legitimately not exist yet
 * (fresh install, before the owner has run through admin settings), so every
 * caller has to handle null rather than assume a location is configured.
 */
export async function getSettings(): Promise<SettingsRow | null> {
  const { data, error } = await db()
    .from("laundromat_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load laundromat settings: ${error.message}`);
  }
  if (!data) return null;

  // numeric(6,2) comes back from PostgREST as a string; normalise it once
  // here so no downstream caller has to remember.
  return {
    ...(data as SettingsRow),
    service_radius_miles: Number((data as SettingsRow).service_radius_miles),
  };
}

export async function upsertSettings(values: {
  name: string;
  address: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  serviceRadiusMiles: number;
}): Promise<SettingsRow> {
  const { data, error } = await db()
    .from("laundromat_settings")
    .upsert(
      {
        id: true,
        name: values.name,
        address: values.address,
        formatted_address: values.formattedAddress,
        latitude: values.latitude,
        longitude: values.longitude,
        service_radius_miles: values.serviceRadiusMiles,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save laundromat settings: ${error.message}`);
  }

  return {
    ...(data as SettingsRow),
    service_radius_miles: Number((data as SettingsRow).service_radius_miles),
  };
}
