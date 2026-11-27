// The user module's part of the platform: getPlatform().user(), who is using the page. Without
// this module it doesn't exist, so an app with no login can't depend on a signed-in person. In a
// Claude artifact the runtime names the viewer; on the web the web pack serves it from the
// sign-in (/api/auth/me). Wherever nobody is identified it resolves null, or id() resolves null.
import type { Capability } from "../types";

declare module "../types" {
  interface Platform {
    /** Who is using the page. */
    user(): Promise<UserApi | null>;
  }
}

/** A person for unit tests: `fakePlatform({ user: fakeUser("u1") })`; the default is "test-user". */
export function fakeUser(id: string | null = "test-user"): () => Promise<UserApi> {
  return async () => ({ id: async () => id });
}

const user: Capability<"user"> = {
  methods: ["user"],
  artifact: { user: (claude) => claude.use("user") },
  fake: { user: fakeUser() },
};
export default user;
