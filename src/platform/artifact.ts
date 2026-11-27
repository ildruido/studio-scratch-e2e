import { capabilities } from "./registry";
import type { Platform } from "./types";

type Methods = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** A module's capabilities, served by the runtime as each capability file says (null without it). */
function moduleCapabilities(): Partial<Platform> {
  const out: Methods = {};
  for (const cap of capabilities) {
    const viaRuntime = (cap.artifact ?? {}) as unknown as Record<
      string,
      (claude: ClaudeRuntime, ...args: unknown[]) => Promise<unknown>
    >;
    for (const m of cap.methods)
      out[m] = async (...args) => {
        const serve = viaRuntime[m];
        return window.claude && serve ? serve(window.claude, ...args) : null;
      };
  }
  return out as Partial<Platform>;
}

/** The Claude artifact runtime (`window.claude`), read lazily so tests can fake it late. */
export const artifactPlatform: Platform = {
  ...moduleCapabilities(),
  hasRuntime: () => Boolean(window.claude),
  db: async () => (window.claude ? window.claude.use("db") : null),
  downloads: async () => (window.claude ? window.claude.use("downloads") : null),
} as Platform;
