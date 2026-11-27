import type { Page } from "@playwright/test";

/**
 * Fake the Claude artifact runtime before the page loads. `sample` answers with `answer`
 * (or rejects with `{code}` when `fail` is set); tests never call a real model.
 */
export async function fakeClaude(page: Page, opts: { answer?: string; fail?: string } = {}) {
  await page.addInitScript((o) => {
    (window as unknown as { claude: unknown }).claude = {
      use: async (name: string) => {
        if (name !== "sample") return null;
        return async () => {
          if (o.fail) throw { code: o.fail, message: "The AI could not answer." };
          return {
            text: o.answer ?? "A fake answer.",
            truncated: false,
            modelTierApplied: "quick",
          };
        };
      },
    };
  }, opts);
}
