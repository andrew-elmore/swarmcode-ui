/**
 * CARD-101 Unit Tests — src/index.css mobile scroll fix.
 * Author: qa-1
 *
 * BUG: On mobile browsers (especially iOS Safari), '100vh' resolves to the
 * viewport height with browser chrome HIDDEN. When chrome is visible, the
 * actual viewport is shorter — the bottom of the app shell is pushed under
 * the fold with no scroll to recover it.
 *
 * Fix: html, body and #root all set to height: 100% so the percentage chain
 * propagates from the browser's reported viewport height (which already
 * accounts for visible chrome) down to the app shell.
 *
 * Source-level assertions:
 *   1. html and body both have height: 100%
 *   2. body has margin: 0 (regression guard — must not have been dropped)
 *   3. #root has height: 100%
 */

import fs from 'fs';
import path from 'path';

const cssSrc = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'index.css'),
  'utf8'
);

// ─── CARD-101: index.css — mobile scroll height fix ───────────────────────────

describe('CARD-101: index.css — html, body, #root height: 100%', () => {
  test('html has height: 100%', () => {
    // Must appear in a rule that targets html (standalone or combined with body)
    expect(cssSrc).toMatch(/html[^{]*\{[^}]*height\s*:\s*100%/);
  });

  test('body has height: 100%', () => {
    expect(cssSrc).toMatch(/body[^{]*\{[^}]*height\s*:\s*100%/);
  });

  test('body has margin: 0 (regression guard — not removed by this change)', () => {
    expect(cssSrc).toMatch(/body[^{]*\{[^}]*margin\s*:\s*0/);
  });

  test('#root has height: 100%', () => {
    expect(cssSrc).toMatch(/#root\s*\{[^}]*height\s*:\s*100%/);
  });

  test('100vh does NOT appear in index.css (old broken value absent)', () => {
    expect(cssSrc).not.toMatch(/100vh/);
  });
});
