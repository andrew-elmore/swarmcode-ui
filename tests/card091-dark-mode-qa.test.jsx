/**
 * CARD-091 QA Tests — MUI dark mode theme with red primary
 * Author: qa-1
 * Date: 2026-02-11
 *
 * Validates:
 * 1. Theme config: dark mode with red primary (#f44336)
 * 2. main.jsx and theme.js are consistent
 * 3. ChatView uses semantic theme tokens (no hardcoded light colors)
 * 4. CssBaseline included for consistent dark background
 * 5. No hardcoded light-only colors in ChatView
 */

const fs = require("fs");
const path = require("path");

const mainSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/main.jsx"), "utf8"
);
const themeSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/theme.js"), "utf8"
);
const chatViewSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/components/ChatView.jsx"), "utf8"
);

// ═══════════════════════════════════════════════════════════════════════════════
// Theme configuration
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-091 QA: theme configuration", () => {
  test("main.jsx palette mode is 'dark'", () => {
    expect(mainSrc).toMatch(/mode:\s*['"]dark['"]/);
  });

  test("main.jsx primary color is red (#f44336)", () => {
    expect(mainSrc).toMatch(/primary:\s*\{\s*main:\s*['"]#f44336['"]/);
  });

  test("main.jsx includes CssBaseline for consistent dark background", () => {
    expect(mainSrc).toMatch(/CssBaseline/);
    expect(mainSrc).toMatch(/<CssBaseline/);
  });

  test("main.jsx wraps App with ThemeProvider", () => {
    expect(mainSrc).toMatch(/<ThemeProvider/);
    expect(mainSrc).toMatch(/<\/ThemeProvider>/);
  });

  test("theme.js mode is 'dark'", () => {
    expect(themeSrc).toMatch(/mode:\s*['"]dark['"]/);
  });

  test("theme.js primary color matches main.jsx (#f44336)", () => {
    expect(themeSrc).toMatch(/#f44336/);
  });

  test("theme.js and main.jsx use the same primary color", () => {
    const mainPrimary = mainSrc.match(/#[0-9a-fA-F]{6}/);
    const themePrimary = themeSrc.match(/#[0-9a-fA-F]{6}/);
    expect(mainPrimary).not.toBeNull();
    expect(themePrimary).not.toBeNull();
    expect(mainPrimary[0]).toBe(themePrimary[0]);
  });

  test("theme.js and main.jsx use the same secondary color", () => {
    const mainSecondary = mainSrc.match(/secondary:\s*\{\s*main:\s*['"]([^'"]+)['"]/);
    const themeSecondary = themeSrc.match(/secondary:\s*\{\s*main:\s*['"]([^'"]+)['"]/);
    expect(mainSecondary).not.toBeNull();
    expect(themeSecondary).not.toBeNull();
    expect(mainSecondary[1]).toBe(themeSecondary[1]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ChatView — semantic theme tokens (no hardcoded light colors)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-091 QA: ChatView uses semantic theme tokens", () => {
  test("owner message bubble uses primary.main (not hardcoded color)", () => {
    expect(chatViewSrc).toMatch(/bgcolor:\s*isOwner\s*\?\s*["']primary\.main["']/);
  });

  test("owner message text uses primary.contrastText (not 'white')", () => {
    expect(chatViewSrc).toMatch(/color:\s*isOwner\s*\?\s*["']primary\.contrastText["']/);
  });

  test("agent message bubble uses background.paper", () => {
    expect(chatViewSrc).toMatch(/["']background\.paper["']/);
  });

  test("messages area uses background.default", () => {
    expect(chatViewSrc).toMatch(/bgcolor:\s*["']background\.default["']/);
  });

  test("input area uses background.paper", () => {
    // The input container should use background.paper
    expect(chatViewSrc).toMatch(/bgcolor:\s*["']background\.paper["']/);
  });

  test("send button uses primary.main and primary.contrastText", () => {
    expect(chatViewSrc).toMatch(/bgcolor:\s*["']primary\.main["']/);
    expect(chatViewSrc).toMatch(/color:\s*["']primary\.contrastText["']/);
  });

  test("send button hover uses primary.dark", () => {
    expect(chatViewSrc).toMatch(/["']primary\.dark["']/);
  });

  test("disabled send button uses action.disabledBackground", () => {
    expect(chatViewSrc).toMatch(/["']action\.disabledBackground["']/);
  });

  test("border colors use divider token", () => {
    expect(chatViewSrc).toMatch(/borderColor:\s*["']divider["']/);
  });

  test("ChatView does NOT contain hardcoded light-only colors", () => {
    // Should not have hardcoded white, light grey, or grey.50
    expect(chatViewSrc).not.toMatch(/['"]white['"]/);
    expect(chatViewSrc).not.toMatch(/['"]#fff['"]/);
    expect(chatViewSrc).not.toMatch(/['"]#ffffff['"]/i);
    expect(chatViewSrc).not.toMatch(/['"]grey\.50['"]/);
    expect(chatViewSrc).not.toMatch(/['"]#f5f5f5['"]/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Theme functional test — createTheme with dark mode
// ═══════════════════════════════════════════════════════════════════════════════

import { createTheme } from "@mui/material/styles";

describe("CARD-091 QA: dark theme functional verification", () => {
  const darkTheme = createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#f44336" },
      secondary: { main: "#9c27b0" },
    },
  });

  test("dark theme palette mode is 'dark'", () => {
    expect(darkTheme.palette.mode).toBe("dark");
  });

  test("primary.main is red (#f44336)", () => {
    expect(darkTheme.palette.primary.main).toBe("#f44336");
  });

  test("primary.contrastText provides readable contrast on red", () => {
    // MUI calculates contrastText automatically — should be white on red
    expect(darkTheme.palette.primary.contrastText).toBeDefined();
    // Red (#f44336) has low luminance, so contrast text should be light
    expect(darkTheme.palette.primary.contrastText).toMatch(/#fff|rgba\(255/);
  });

  test("background.default is dark (not white)", () => {
    // Dark mode background should be a dark color
    const bg = darkTheme.palette.background.default;
    expect(bg).not.toBe("#fff");
    expect(bg).not.toBe("#ffffff");
    expect(bg).not.toBe("white");
    // MUI dark mode default is #121212
    expect(bg).toBe("#121212");
  });

  test("background.paper is dark", () => {
    const paper = darkTheme.palette.background.paper;
    expect(paper).not.toBe("#fff");
    expect(paper).not.toBe("#ffffff");
  });

  test("text.primary is light (readable on dark background)", () => {
    const text = darkTheme.palette.text.primary;
    // Should be a light color (white or near-white)
    expect(text).toMatch(/#fff|rgba\(255/);
  });
});
