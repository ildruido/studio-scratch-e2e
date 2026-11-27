import { expect, test } from "@playwright/test";

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
