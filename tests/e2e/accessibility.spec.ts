import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { catalogFixture } from "./catalog-fixture";

test("the catalog has no automated accessibility violations", async ({ page }) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(catalogFixture) })
  );
  await page.goto("/products");
  await expect(
    page.getByRole("heading", { name: "The good stuff, all in one place." })
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
});
