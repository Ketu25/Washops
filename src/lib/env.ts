import "server-only";

/**
 * Fail loudly at first use rather than silently handing `undefined` to the
 * Supabase client, which produces a confusing "Invalid URL" much later.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value.trim();
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters. " +
          "Generate one with: openssl rand -base64 32",
      );
    }
    return secret;
  },
  /** Nominatim requires a descriptive User-Agent identifying the app. */
  get geocoderUserAgent() {
    return (
      process.env.GEOCODER_USER_AGENT?.trim() ||
      "LaundromatPortal/1.0 (self-hosted scheduling app)"
    );
  },
};
