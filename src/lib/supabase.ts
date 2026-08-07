import "server-only";

import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

import { env } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service_role key.
 *
 * Every table in this app has RLS enabled with no policies, so the
 * browser (holding only the publishable key) can reach nothing. All data
 * access flows through server code that has already verified the caller's
 * identity and role. This client must never be imported into a Client
 * Component — the `server-only` import above turns that into a build error.
 */
export function db(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // supabase-js builds a realtime client eagerly, and that needs a
      // WebSocket constructor which Node 20 does not expose globally (it
      // arrived in Node 22). We never subscribe to realtime, but the client
      // still has to construct, so hand it a transport explicitly.
      //
      // The cast is needed because `ws`'s constructor overloads are wider
      // than the interface supabase declares; the two are compatible at
      // runtime, which is all this is used for.
      realtime: { transport: ws as unknown as WebSocketLikeConstructor },
    });
  }
  return cached;
}
