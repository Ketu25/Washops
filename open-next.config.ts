import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Every route in this app is `force-dynamic` — coverage answers and request
 * queues must never be served from a cache — so no incremental cache is
 * configured. That is also why the Cloudflare build's "Failed to set up cache"
 * warning is not a problem here.
 */
export default defineCloudflareConfig();
