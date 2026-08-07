import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up past this
  // project and picks up a stray lockfile in the home directory.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // Don't regenerate AGENTS.md / CLAUDE.md on every dev boot; the README is
  // the documentation for this project.
  agentRules: false,
};

export default nextConfig;
