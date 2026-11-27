import { expect, test, type Page } from "@playwright/test";
import { fakeClaude } from "./fake-claude";

// Baseline checks every artifact page must pass, whatever the app does (the qa agent starts from them and
// does the app-specific flows by hand): phone width, light and dark, reload, keyboard focus. Generic on
// purpose: keep this file as shipped; put app flows in their own specs.

/** Collects uncaught page errors and console errors. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on(
    "console",
    (m) =>
      m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  );
  return errors;
}

async function expectUsable(page: Page): Promise<void> {
  await expect(page.locator("#page-title")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);
  // Text is readable: the page's text colour differs clearly from its background.
  const contrast = await page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lum = (c: number[]) =>
      0.2126 * lin(c[0] ?? 0) + 0.7152 * lin(c[1] ?? 0) + 0.0722 * lin(c[2] ?? 0);
    let bg = [255, 255, 255];
    for (let el: Element | null = document.body; el; el = el.parentElement) {
      const c = rgb(getComputedStyle(el).backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0.9) {
        bg = c;
        break;
      }
    }
    const fg = rgb(getComputedStyle(document.body).color);
    const [a, b] = [lum(fg), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast, "text/background contrast").toBeGreaterThanOrEqual(3);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`baseline, ${scheme}, 375px wide`, () => {
    test.use({ viewport: { width: 375, height: 812 }, colorScheme: scheme });

    test("renders usable with no errors, also after a reload", async ({ page }) => {
      const errors = watchErrors(page);
      await fakeClaude(page);
      await page.goto("/");
      await expectUsable(page);
      await page.reload();
      await expectUsable(page);
      expect(errors).toEqual([]);
    });

    test("without the Claude runtime it still renders", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/");
      await expectUsable(page);
      expect(errors).toEqual([]);
    });
  });
}

test("keyboard focus is visible on the first control", async ({ page }) => {
  await fakeClaude(page);
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  const first = page
    .locator("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
    .first();
  test.skip((await first.count()) === 0, "the page has no control to focus");
  await page.keyboard.press("Tab");
  const visible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
  });
  expect(visible, "focus ring on the focused control").toBe(true);
});
