import { expect, test } from "@playwright/test";

test("a new shopper can sign up, add groceries, and check out", async ({ page }) => {
  const email = `shopper-${crypto.randomUUID()}@example.test`;
  await page.route("**/api/invoice", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );

  await page.goto("/auth");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Full name").fill("Jamie Rivera");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);

  const avocadoCard = page.locator("article", {
    has: page.getByRole("heading", { name: "Organic Hass Avocados" }),
  });
  await avocadoCard.getByRole("button", { name: "Add +" }).click();
  await page.getByRole("link", { name: "Cart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organic Hass Avocados" })).toBeVisible();
  const summary = page.locator("aside.summary");
  await expect(summary).toContainText("₹349");
  await expect(summary).toContainText("₹49");
  await expect(summary).toContainText("₹398");

  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page.getByLabel("Delivery address").fill("12 MG Road, Bengaluru, Karnataka 560001");
  await page.getByLabel("Card number").fill("4242424242424242");
  await expect(page.getByLabel("Card number")).toHaveValue("4242 4242 4242 4242");
  await page.getByLabel("Expiry").fill("0828");
  await expect(page.getByLabel("Expiry")).toHaveValue("08 / 28");
  await page.getByLabel("CVC").fill("123");
  await page.getByRole("button", { name: /Place order/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: /Pay ₹398/ });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeFocused();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Pay ₹398/ }).click();

  await expect(page.getByRole("heading", { name: "Thank you for your order." })).toBeVisible();
  await expect(page.getByText(/Order FC-[A-Z0-9-]+/)).toBeVisible();
  await expect(page.getByText("Invoice emailed to your account address.")).toBeVisible();
  await page.getByRole("link", { name: "View my orders" }).click();
  await expect(page.getByText(/FC-[A-Z0-9-]+/).first()).toBeVisible();
});
