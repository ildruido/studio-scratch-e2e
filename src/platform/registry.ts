// Collects the capabilities the app's modules add (one file each in src/platform/capabilities/).
// Base ships none; adapters and nullPlatform read this list, so a module never edits them.
import type { Capability, Platform } from "./types";

const files = import.meta.glob<{ default: Capability }>("./capabilities/*.ts", { eager: true });

/** Every capability file's export, in file-name order. */
export const capabilities: Capability[] = Object.keys(files)
  .sort()
  .map((name) => files[name]!.default);

type Methods = Record<string, (...args: never[]) => unknown>;

/** Every capability method, answering null: what a host without that capability offers. */
export function absentCapabilities(): Partial<Platform> {
  const out: Methods = {};
  for (const cap of capabilities) for (const m of cap.methods) out[m] = async () => null;
  return out as Partial<Platform>;
}

/** Every capability's fake for unit tests (null where a capability has no fake). */
export function fakeCapabilities(): Partial<Platform> {
  const out = absentCapabilities() as Methods;
  for (const cap of capabilities) Object.assign(out, cap.fake);
  return out as Partial<Platform>;
}
