import { expect, test } from "@playwright/test";
import { fakeClaude } from "./fake-claude";

test("renders outside the Claude app", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Ready");
});

test("renders inside the Claude app runtime", async ({ page }) => {
  await fakeClaude(page);
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Ready");
});
