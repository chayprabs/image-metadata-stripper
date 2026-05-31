import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "ExifScrub" })).toBeVisible();
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

test("privacy, terms, and legal pages", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /Terms/i })).toBeVisible();
  await page.goto("/legal");
  await expect(page.getByRole("heading", { name: /Legal & Licenses/i })).toBeVisible();
});

test("all seo routes load", async ({ page }) => {
  for (const route of [
    "/exif-remover",
    "/gps-remover-photo",
    "/pdf-metadata-remove",
    "/mp4-metadata-strip",
    "/heic-metadata",
  ]) {
    await page.goto(route);
    await expect(page.getByText("Drop images or media here")).toBeVisible();
  }
});

test("load geotagged sample and scrub in browser", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geotagged JPEG" }).click();
  await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Scrub metadata" }).click();
  await expect(page.getByRole("button", { name: "Cleaned file" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Prove-clean PDF" })).toBeVisible();
});
