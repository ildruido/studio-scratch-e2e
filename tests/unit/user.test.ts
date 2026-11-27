import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlatform, nullPlatform, setPlatform } from "../../src/platform";
import { fakePlatform } from "../../src/platform/fake";
import user, { fakeUser } from "../../src/platform/capabilities/user";

afterEach(() => setPlatform(nullPlatform));

describe("user module", () => {
  it("nobody is known until a host fills it in", async () => {
    expect(await getPlatform().user()).toBeNull();
  });

  it("the fake platform has a test person, and a test can pick another", async () => {
    setPlatform(fakePlatform());
    expect(await (await getPlatform().user())?.id()).toBe("test-user");
    setPlatform(fakePlatform({ user: fakeUser("u1") }));
    expect(await (await getPlatform().user())?.id()).toBe("u1");
  });

  it("asks the Claude artifact runtime for the viewer", async () => {
    const use = vi.fn(async () => ({ id: async () => "viewer" }));
    const who = await user.artifact!.user({ use } as unknown as ClaudeRuntime);
    expect(use).toHaveBeenCalledWith("user");
    expect(await who?.id()).toBe("viewer");
  });
});
