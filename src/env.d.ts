declare const __APP_VERSION__: string;
/** Which build this is: "artifact" (one file inside the Claude app) or "web" (served by server/). */
declare const __TARGET__: "artifact" | "web";

// The shapes the page uses from its host. The Claude artifact runtime (`window.claude`) provides
// them as they are; the web adapter returns the same shapes over /api/*. Only what this
// app uses: add to these as the app uses more of the runtime. A module's own shapes live with
// the module (the `ai` module's in src/ai.d.ts).

interface DbError {
  code: string;
  message: string;
}

interface DbDocumentSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface DbDocumentReference {
  id: string;
  path: string;
  get(): Promise<DbDocumentSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): DbCollectionReference;
}

interface DbQuerySnapshot {
  docs: DbDocumentSnapshot[];
  size: number;
  empty: boolean;
}

interface DbQuery {
  where(field: string, op: string, value: unknown): DbQuery;
  orderBy(field: string, dir?: "asc" | "desc"): DbQuery;
  /** At most `n` documents (1-1000). */
  limit(n: number): DbQuery;
  get(): Promise<DbQuerySnapshot>;
}

interface DbCollectionReference extends DbQuery {
  path: string;
  doc(id?: string): DbDocumentReference;
}

interface DbApi {
  doc(path: string): DbDocumentReference;
  collection(path: string): DbCollectionReference;
}

/** Reads never reject. */
interface UserApi {
  /** Opaque per-organization id; null when there is no identity here. */
  id(): Promise<string | null>;
}

/** Offers the viewer a file to save (text or Blob); they may decline. */
type DownloadsFn = {
  save(request: {
    filename: string;
    data: string | Blob;
  }): Promise<{ status: "saved" | "delivered" }>;
};

interface ClaudeRuntime {
  use(name: "db"): Promise<DbApi | null>;
  use(name: "user"): Promise<UserApi | null>;
  use(name: "downloads"): Promise<DownloadsFn | null>;
  use(name: string): Promise<unknown>;
}

interface Window {
  claude?: ClaudeRuntime;
}
