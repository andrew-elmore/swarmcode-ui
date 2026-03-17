/**
 * CARD-104 Unit Tests — QRCodeDialog removed (re-scope)
 * Author: qa-1
 *
 * Re-scope: QRCodeDialog.jsx was deleted. The QR code trigger now lives in
 * swarmcode-agent/main.py (QRDialog class). The /register route and RegisterView
 * remain in swarmcode-ui for the phone-side flow.
 *
 * These source-level tests verify that the component and all references to it
 * have been correctly removed from swarmcode-ui.
 */

import fs from "fs";
import path from "path";

// ─── Component removed ────────────────────────────────────────────────────────

describe("CARD-104: QRCodeDialog — removed from swarmcode-ui (re-scope)", () => {
  test("QRCodeDialog.jsx no longer exists in src/components/", () => {
    const filePath = path.resolve(__dirname, "../../src/components/QRCodeDialog.jsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("App.jsx does not import QRCodeDialog", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/App.jsx"),
      "utf8"
    );
    expect(src).not.toContain("QRCodeDialog");
  });

  test("App.jsx does not render <QRCodeDialog", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/App.jsx"),
      "utf8"
    );
    expect(src).not.toContain("<QRCodeDialog");
  });

  test("package.json does not contain qrcode.react dependency", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")
    );
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(allDeps).not.toHaveProperty("qrcode.react");
  });
});

// ─── /register route retained ─────────────────────────────────────────────────

describe("CARD-104: /register route — retained in App.jsx (re-scope)", () => {
  test("App.jsx still imports RegisterView", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/App.jsx"),
      "utf8"
    );
    expect(src).toContain("RegisterView");
  });

  test("App.jsx still has a /register route", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/App.jsx"),
      "utf8"
    );
    expect(src).toContain("/register");
  });
});
