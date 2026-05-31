import { test, expect } from "@playwright/test";

test("after scrub, file row hash reflects cleaned file not original", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });

  const shaBefore = await page.locator("text=/sha256: [a-f0-9]{16}/").textContent();
  await page.getByRole("button", { name: "Scrub metadata" }).click();
  await expect(page.getByRole("button", { name: "Cleaned file" })).toBeVisible({ timeout: 15000 });

  const shaAfter = await page.locator("text=/sha256: [a-f0-9]{16}/").textContent();
  expect(shaAfter).not.toBe(shaBefore);
});

test("custom field line with empty field name is rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByPlaceholder(/Fields to strip/i).fill("EXIF:");
  await page.getByRole("button", { name: "Scrub metadata" }).click();

  await expect(page.getByText(/Add at least one field/i)).toBeVisible({ timeout: 5000 });
});
