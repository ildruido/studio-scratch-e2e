import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactPlatform } from "../../src/platform/artifact";
import { capabilities } from "../../src/platform/registry";

afterEach(() => vi.unstubAllGlobals());

const methods = artifactPlatform as unknown as Record<string, () => Promise<unknown>>;

describe("artifact platform", () => {
  it("reports no runtime and no capabilities outside the Claude app", async () => {
    vi.stubGlobal("window", {});
    expect(artifactPlatform.hasRuntime()).toBe(false);
    expect(await artifactPlatform.db()).toBeNull();
    for (const cap of capabilities)
      for (const m of cap.methods) expect(await methods[m]!(), m).toBeNull();
  });

  it("asks the runtime for each capability by name", async () => {
    const use = vi.fn(async (name: string) => ({ name, state: async () => "granted" }));
    vi.stubGlobal("window", { claude: { use } });
    expect(artifactPlatform.hasRuntime()).toBe(true);
    await artifactPlatform.db();
    await artifactPlatform.downloads();
    expect(use).toHaveBeenCalledWith("db");
    expect(use).toHaveBeenCalledWith("downloads");
    for (const cap of capabilities)
      for (const m of cap.methods) expect(typeof methods[m], m).toBe("function");
  });
});
