import { expect, test } from "@playwright/test";

test("shows each person's share with the working", async ({ page }) => {
  await page.goto("/");
  await page.locator("#bill").fill("100");
  await page.locator('.tip[data-tip="20"]').click();
  await page.locator("#people").fill("4");
  await expect(page.locator("#share")).toHaveText("Each person pays 30.00");
  await expect(page.locator("#working")).toContainText("Bill 100.00 + tip 20.00 = total 120.00");
});

test("rounds an uneven share up to the cent", async ({ page }) => {
  await page.goto("/");
  await page.locator("#bill").fill("50");
  await page.locator('.tip[data-tip="18"]').click();
  await page.locator("#people").fill("3");
  await expect(page.locator("#share")).toHaveText("Each person pays 19.67");
});

test("uses a custom tip percentage", async ({ page }) => {
  await page.goto("/");
  await page.locator("#bill").fill("100");
  await page.locator("#tip-custom").fill("10");
  await page.locator("#people").fill("2");
  await expect(page.locator("#share")).toHaveText("Each person pays 55.00");
});

test("shows a hint instead of a share when something is missing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#result")).toContainText("Enter the bill");
  await page.locator("#bill").fill("40");
  await page.locator('.tip[data-tip="15"]').click();
  await page.locator("#people").fill("0");
  await expect(page.locator("#result")).toContainText("at least 1 person");
  await expect(page.locator("#share")).toHaveCount(0);
});
