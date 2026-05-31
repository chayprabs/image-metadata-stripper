import { test, expect } from "@playwright/test";

/**
 * Subpath deploy verification — documents GitHub Pages basename behavior.
 * Run manually after building with VITE_BASE=/image-metadata-stripper/:
 *   VITE_BASE=/image-metadata-stripper/ pnpm build && npx vite preview --port 4175
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175/image-metadata-stripper pnpm exec playwright test e2e/subpath.spec.ts
 */
test.describe("subpath deploy", () => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes("image-metadata-stripper"),
    "Set PLAYWRIGHT_BASE_URL to a subpath preview URL to run",
  );

  test("homepage and sample assets resolve under basename", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ExifScrub")).toBeVisible();
    await page.getByRole("button", { name: "Geotagged JPEG" }).click();
    await expect(page.getByText("geotagged.jpg")).toBeVisible({ timeout: 10000 });
  });

  test("seo route works under basename", async ({ page }) => {
    await page.goto("/exif-remover");
    await expect(page.getByText("Remove EXIF metadata from photos online")).toBeVisible();
    await expect(page.getByText("Drop images or media here")).toBeVisible();
  });
});
