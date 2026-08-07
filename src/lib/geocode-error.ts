import type { Coordinates } from "./geo";

export interface GeocodeResult extends Coordinates {
  /** Normalised display address returned by the provider. */
  formattedAddress: string;
}

/**
 * Lives in its own module so both providers and the service-area check can
 * import it without pulling in a provider implementation.
 *
 * The `kind` matters: "not_found" and "out of range" must never produce the
 * same message. One means we cannot place your address, the other means we
 * placed it fine and will not serve it.
 */
export class GeocodeError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "unavailable" | "invalid_input",
  ) {
    super(message);
    this.name = "GeocodeError";
  }
}
