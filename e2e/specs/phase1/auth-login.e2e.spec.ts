/**
 * CARD-081 E2E Tests — Login dialog + auth slice
 * Tests the full login/logout user flow through the UI using Playwright.
 * Parse.User.logIn and Parse.User.logOut are intercepted via page.route()
 * so no real server credentials are required.
 */

import { test, expect } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Install a route intercept for Parse Cloud Function calls so tests
 * don't require real credentials. The auth functions hit /functions/ but
 * loginUser calls Parse.User.logIn which hits /1/login (Parse REST login endpoint).
 */
async function mockParseLogin(page, { success = true } = {}) {
  await page.route("**/parse/login", async (route) => {
    if (!success) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid username/password.", code: 101 }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          objectId: "mock-user-id",
          username: "qa-1",
          sessionToken: "r:mock-e2e-session-token",
          createdAt: "2026-03-14T00:00:00.000Z",
        }),
      });
    }
  });
}

async function mockParseLogout(page) {
  await page.route("**/parse/logout", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

// ─── Sign In button visible when not logged in ─────────────────────────────

test.describe("AppBar auth button — unauthenticated state", () => {
  test("Sign In button is visible in the AppBar when not logged in", async ({ page }) => {
    await page.goto("/");
    // Wait for the app to load
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });
    // Find Sign In button — it may appear on desktop or mobile AppBar
    const signInBtn = page.getByRole("button", { name: /sign in/i }).first();
    await expect(signInBtn).toBeVisible();
  });
});

// ─── Login dialog open/close ───────────────────────────────────────────────

test.describe("LoginDialog — open and close", () => {
  test("clicking Sign In opens the login dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("clicking Cancel closes the login dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

// ─── Login success flow ────────────────────────────────────────────────────

test.describe("LoginDialog — successful login", () => {
  test("after successful login, AppBar shows Sign Out button", async ({ page }) => {
    await mockParseLogin(page, { success: true });
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByLabel(/username/i).fill("qa-1");
    await page.getByLabel(/password/i).fill("testpassword");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("after successful login, dialog closes automatically", async ({ page }) => {
    await mockParseLogin(page, { success: true });
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByLabel(/username/i).fill("qa-1");
    await page.getByLabel(/password/i).fill("testpassword");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─── Login failure flow ────────────────────────────────────────────────────

test.describe("LoginDialog — failed login", () => {
  test("shows error alert when login fails", async ({ page }) => {
    await mockParseLogin(page, { success: false });
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByLabel(/username/i).fill("bad-user");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5_000 });
  });

  test("dialog stays open after failed login", async ({ page }) => {
    await mockParseLogin(page, { success: false });
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByLabel(/username/i).fill("bad-user");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });
});

// ─── CARD-088: Sign-up flow ────────────────────────────────────────────────

async function mockCreateAccount(page) {
  await page.route("**/functions/createAccount", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: {} }),
    });
  });
}

test.describe("LoginDialog — sign-up flow", () => {
  test("clicking toggle shows Sign Up form fields", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /don't have an account/i }).click();

    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/account name/i)).toBeVisible();
  });

  test("successful sign-up closes dialog and shows Sign Out button", async ({ page }) => {
    await mockCreateAccount(page);
    await mockParseLogin(page, { success: true });

    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByRole("button", { name: /don't have an account/i }).click();

    await page.getByLabel(/username/i).fill("alice");
    await page.getByLabel(/password/i).fill("Pass1!");
    await page.getByLabel(/first name/i).fill("Alice");
    await page.getByLabel(/last name/i).fill("Smith");
    await page.getByLabel(/account name/i).fill("Acme Corp");

    await page.getByRole("button", { name: /^sign up$/i }).click();

    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ─── Logout flow ──────────────────────────────────────────────────────────

test.describe("AppBar — Sign Out button", () => {
  test("clicking Sign Out reverts AppBar to show Sign In", async ({ page }) => {
    await mockParseLogin(page, { success: true });
    await mockParseLogout(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="tab-messages"]', { timeout: 15_000 });

    // Log in first
    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByLabel(/username/i).fill("qa-1");
    await page.getByLabel(/password/i).fill("testpassword");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible({
      timeout: 5_000,
    });

    // Log out
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
