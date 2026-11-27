import { afterEach, describe, expect, it } from "vitest";
import { fakePlatform } from "../../src/platform/fake";
import { getPlatform, nullPlatform, setPlatform } from "../../src/platform";
import { capabilities } from "../../src/platform/registry";

afterEach(() => setPlatform(nullPlatform));

describe("platform", () => {
  it("has nothing to offer until a platform is set, and the page copes", async () => {
    const p = getPlatform();
    expect(p.hasRuntime()).toBe(false);
    expect(await p.db()).toBeNull();
  });

  it("the fake platform stores without any host", async () => {
    setPlatform(fakePlatform());
    const db = (await getPlatform().db())!;
    await db.doc("data/users/u1/note").set({ text: "x" });
    expect((await db.doc("data/users/u1/note").get()).data()).toEqual({ text: "x" });
    expect((await db.collection("data/users/u1").get()).size).toBe(1);
    await db.doc("data/users/u1/note").delete();
    expect((await db.doc("data/users/u1/note").get()).exists).toBe(false);
  });

  it("every capability a module adds is there, and absent until a host fills it", async () => {
    const methods = nullPlatform as unknown as Record<string, () => Promise<unknown>>;
    for (const cap of capabilities)
      for (const m of cap.methods) {
        expect(typeof methods[m], m).toBe("function");
        expect(await methods[m]!(), m).toBeNull();
      }
  });
});
