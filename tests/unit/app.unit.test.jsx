/**
 * CARD-101 Unit Tests — src/App.jsx outer Box height fix.
 * Author: qa-1
 *
 * BUG: Outer Box used height: '100vh'. On mobile with browser chrome visible,
 * 100vh exceeds the actual visible area, pushing the bottom of the shell below
 * the fold with overflow: hidden clipping it unreachably.
 *
 * Fix: Change outer Box height from '100vh' to '100%'. The 100% chain from
 * html → body → #root → Box gives the exact browser-reported viewport height
 * (chrome-adjusted), so the shell fits correctly on mobile.
 *
 * Source-level assertions:
 *   4. Outer Box sx does NOT contain height: '100vh'
 *   5. Outer Box sx contains height: '100%'
 *
 * Note: The actual mobile viewport behavior (100vh vs 100% with chrome visible)
 * cannot be replicated in jsdom. Source-level assertions guard against
 * regression to the broken value.
 */

import fs from 'fs';
import path from 'path';

const appSrc = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'App.jsx'),
  'utf8'
);

// ─── CARD-101: App.jsx — outer Box height: '100%' ─────────────────────────────

describe('CARD-101: App.jsx — outer Box height: 100% (not 100vh)', () => {
  test("outer Box sx does NOT contain height: '100vh' (broken mobile value removed)", () => {
    // This is the regression guard — must never return to 100vh
    expect(appSrc).not.toMatch(/height\s*:\s*["']100vh["']/);
  });

  test("outer Box sx contains height: '100%' (fix in place)", () => {
    // The display:flex/flexDirection:column outer shell must use 100%
    expect(appSrc).toMatch(/display\s*:\s*["']flex["'][^}]*height\s*:\s*["']100%["']/);
  });

  test("outer Box still has display: 'flex' and flexDirection: 'column' (unchanged)", () => {
    expect(appSrc).toMatch(/display\s*:\s*["']flex["'][^}]*flexDirection\s*:\s*["']column["']/);
  });
});
