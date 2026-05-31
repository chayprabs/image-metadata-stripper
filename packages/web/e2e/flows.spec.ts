import { test, expect } from "@playwright/test";

test("custom preset without fields shows validation error on scrub", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByRole("button", { name: "Scrub metadata" }).click();

  await expect(page.getByText(/Add at least one field in the custom list/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cleaned file" })).not.toBeVisible();
});

test("custom preset strips only specified field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByPlaceholder(/Fields to strip/i).fill("EXIF:Artist");
  await page.getByRole("button", { name: "Scrub metadata" }).click();

  await expect(page.getByRole("button", { name: "Cleaned file" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Metadata diff/i)).toBeVisible();
});

test("changing preset clears scrub results and shows stale warning after re-scrub", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Scrub metadata" }).click();
  await expect(page.getByRole("button", { name: "Cleaned file" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Strip GPS + author" }).click();
  await expect(page.getByRole("button", { name: "Cleaned file" })).not.toBeVisible();

  await page.getByRole("button", { name: "Scrub metadata" }).click();
  await expect(page.getByRole("button", { name: "Cleaned file" })).toBeVisible({ timeout: 15000 });
});

test("load app-relative URL path for sample", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/Paste file URL/i).fill("/samples/geotagged.jpg");
  await page.getByRole("button", { name: "Load URL" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });
});

test("batch zip with custom preset and no fields shows error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom" }).click();

  const batchInput = page.locator('input[accept=".zip"]');
  await batchInput.setInputFiles({
    name: "test-batch.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK\x05\x06" + "\x00".repeat(18)),
  });

  await expect(page.getByText(/Add at least one custom field before running batch ZIP/i)).toBeVisible({
    timeout: 5000,
  });
});
