// What the page needs from the place it runs in. Every app's platform has the members below; a
// feature module adds its own (the `ai` module adds the AI, the `user` module who is signed in)
// with a file in src/platform/capabilities/ (see Capability). Every getter resolves null when that part is not available, and the page must cope.

export interface Platform {
  /** False when there is no host runtime at all (an ordinary browser tab, unit tests). */
  hasRuntime(): boolean;
  /** Documents (per person where someone is signed in, shared otherwise). */
  db(): Promise<DbApi | null>;
  /** Offer the viewer a generated file to save. */
  downloads(): Promise<DownloadsFn | null>;
}

/** The members a module adds: every Platform method that is not one of the three above. */
export type CapabilityMethod = Exclude<keyof Platform, "hasRuntime" | "db" | "downloads">;

type Fn<M extends keyof Platform> = Platform[M] extends (...args: infer A) => infer R
  ? { args: A; result: R }
  : never;

/**
 * What a file in src/platform/capabilities/ default-exports. The same file adds its methods to
 * Platform (`declare module "../types" { interface Platform { ... } }`), so code that calls them
 * compiles only when the module is there. Each method resolves null wherever no adapter fills it.
 */
export interface Capability<M extends CapabilityMethod = CapabilityMethod> {
  /** The Platform methods this file declares. */
  methods: readonly M[];
  /** How the Claude artifact runtime serves each method (used by the artifact adapter). */
  artifact?: { [K in M]: (claude: ClaudeRuntime, ...args: Fn<K>["args"]) => Fn<K>["result"] };
  /** What fakePlatform() answers for each method in unit tests. */
  fake?: Pick<Platform, M>;
}

/** One place the app can run. Files in src/platform/adapters/ default-export one of these. */
export interface PlatformAdapter {
  target: "artifact" | "web";
  create(): Platform;
  /** Runs before the app starts (the web adapter shows the sign-in screen here). */
  boot?(): Promise<void>;
}
