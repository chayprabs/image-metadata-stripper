import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ExifScrub")).toBeVisible();
  await expect(page.getByText(/Remove EXIF, GPS, XMP/)).toBeVisible();
});

test("drop zone and presets visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Drop images or media here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Strip all" })).toBeVisible();
});

test("sample picker present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Geotagged JPEG")).toBeVisible();
});

test("privacy and terms pages", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /Terms/i })).toBeVisible();
});

test("seo routes load", async ({ page }) => {
  for (const route of ["/exif-remover", "/gps-remover-photo", "/heic-metadata"]) {
    await page.goto(route);
    await expect(page.getByText("Drop images or media here")).toBeVisible();
  }
});
