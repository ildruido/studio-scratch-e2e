// A platform for unit tests: nothing here talks to a real host.
import { fakeCapabilities } from "./registry";
import type { Platform } from "./types";

class Snap implements DbDocumentSnapshot {
  constructor(
    readonly id: string,
    private readonly value: Record<string, unknown> | undefined,
  ) {}
  get exists() {
    return this.value !== undefined;
  }
  data() {
    return this.value;
  }
}

/** In-memory documents: get, set, delete and listing a collection's direct children. */
export function memoryDb(store = new Map<string, Record<string, unknown>>()): DbApi {
  const doc = (path: string): DbDocumentReference => ({
    id: path.slice(path.lastIndexOf("/") + 1),
    path,
    get: async () => new Snap(path.slice(path.lastIndexOf("/") + 1), store.get(path)),
    set: async (data) => void store.set(path, structuredClone(data)),
    delete: async () => void store.delete(path),
    collection: (name) => collection(`${path}/${name}`),
  });
  const collection = (path: string): DbCollectionReference => {
    const list = async (): Promise<DbQuerySnapshot> => {
      const docs = [...store]
        .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"))
        .map(([p, v]) => new Snap(p.slice(path.length + 1), v));
      return { docs, size: docs.length, empty: docs.length === 0 };
    };
    const query: DbCollectionReference = {
      path,
      doc: (id = crypto.randomUUID()) => doc(`${path}/${id}`),
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      get: list,
    };
    return query;
  };
  return { doc, collection };
}

/**
 * A platform whose documents live in memory and whose module capabilities answer with their fakes
 * (the `ai` module's fake AI, the `user` module's "test-user"). Pass members to replace, e.g.
 * `fakePlatform({ downloads })`.
 */
export function fakePlatform(overrides: Partial<Platform> = {}): Platform {
  const db = memoryDb();
  return {
    ...fakeCapabilities(),
    hasRuntime: () => true,
    db: async () => db,
    downloads: async () => null,
    ...overrides,
  } as Platform;
}
