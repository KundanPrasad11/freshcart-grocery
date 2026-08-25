import { expect, test } from "@playwright/test";
import { catalogFixture } from "./catalog-fixture";

test("Local is keyboard-operable and persists in the catalog URL", async ({ page }) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(catalogFixture) })
  );
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Farm Fresh Whole Milk" })).toBeVisible();

  const local = page.getByRole("checkbox", { name: "Local" });
  await local.focus();
  await page.keyboard.press("Space");
  await expect(local).toBeChecked();
  await expect(page).toHaveURL(/local=1/);
  await expect(page.getByRole("heading", { name: "Farm Fresh Whole Milk" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organic Hass Avocados" })).toBeHidden();

  await page.reload();
  await expect(local).toBeChecked();
});
