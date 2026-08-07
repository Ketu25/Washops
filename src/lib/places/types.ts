/**
 * Shared between the address API routes (server) and the combobox (client),
 * so these types live outside any `server-only` module.
 */

export type SuggestScope = "address" | "city" | "state" | "postcode";

/** A fully resolved address: what the forms actually need. */
export interface ResolvedAddress {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

/**
 * One row in the dropdown.
 *
 * `label` is the complete address on a single line — "1520 Laurel Ave,
 * Ambridge, PA, USA" — which is how Google phrases its predictions and what
 * people recognise from every maps search box. `primary` is just the street
 * part, used to prefill the input the instant a row is clicked, before the
 * details lookup returns.
 *
 * `placeId` is present for providers that separate prediction from lookup —
 * Google returns a prediction with no coordinates, and the full address costs
 * a second call made only when the user actually picks that row. Providers
 * that return everything up front populate `resolved` instead, and the client
 * skips the second call.
 */
export interface AddressSuggestion {
  id: string;
  label: string;
  primary: string;
  placeId?: string;
  resolved?: ResolvedAddress;
}

export interface SuggestOptions {
  scope: SuggestScope;
  /**
   * Groups a burst of keystrokes and the final details lookup into one
   * billable Places session. Without it, Google charges per keystroke.
   */
  sessionToken?: string;
  signal?: AbortSignal;
}
