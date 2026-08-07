import "server-only";

import { createRequire } from "node:module";

import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "./env";

/**
 * supabase-js builds a realtime client eagerly and needs a WebSocket
 * constructor to exist at construction time, even though this app never
 * subscribes to anything.
 *
 * Cloudflare Workers and Node 22+ expose WebSocket globally, so nothing extra
 * is needed there. Node 20 does not, so the `ws` package fills the gap.
 *
 * It is loaded through createRequire rather than a static import on purpose:
 * bundlers do not statically analyse a createRequire call, so `ws` never gets
 * pulled into the Worker bundle. That matters because `ws` depends on
 * node:tls, which workerd does not implement — a static import would break the
 * Cloudflare build even though the code path never runs there.
 */
function webSocketTransport(): WebSocketLikeConstructor | undefined {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  try {
    return createRequire(import.meta.url)("ws") as WebSocketLikeConstructor;
  } catch {
    // No global WebSocket and no `ws` installed. Let supabase-js raise its own
    // error rather than masking the cause here.
    return undefined;
  }
}

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
    const transport = webSocketTransport();
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(transport ? { realtime: { transport } } : {}),
    });
  }
  return cached;
}
