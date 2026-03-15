/**
 * Stream View E2E Tests
 * CARD-092 additions: preload on init, refresh button
 */

import { test, expect } from '@playwright/test';
import { createTestProject, seedDefaultAgents, teardownProject } from '../../fixtures/seed';
import { AgentSimulator } from '../../fixtures/agent-simulator';
import { selectProject } from '../../helpers/navigation';
import { callFunction } from '../../helpers/api-client';
import {
  TAB_STREAM,
  STREAM_VIEW,
  STREAM_TOGGLE,
  STREAM_STATUS,
  STREAM_QUEUE,
  STREAM_QUEUE_ITEM,
  STREAM_VOLUME,
  STREAM_SPEED,
  MIC_BUTTON,
} from '../../helpers/selectors';

test.describe('Stream View — UI and Controls', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Stream UI Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.beforeEach(async ({ page }) => {
    // Mock SpeechSynthesis so headless Chromium doesn't error on speak()
    await page.addInitScript(() => {
      window.__ttsSpoken = [];
      window.speechSynthesis.speak = (utterance) => {
        window.__ttsSpoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 50);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });
  });

  test('renders with heading and all controls', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify heading
    await expect(page.locator(STREAM_VIEW).getByText('Audio Stream')).toBeVisible();

    // Verify play button
    await expect(page.locator(STREAM_TOGGLE)).toBeVisible();

    // Verify volume slider
    await expect(page.locator(STREAM_VOLUME)).toBeVisible();
    await expect(page.locator(STREAM_VOLUME).getByText('Volume')).toBeVisible();

    // Verify speed selector
    await expect(page.locator(STREAM_SPEED)).toBeVisible();

    // Verify mic button
    await expect(page.locator(MIC_BUTTON)).toBeVisible();
  });

  test('play/stop toggle changes state', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Initial state: "Press play to start"
    await expect(page.locator(STREAM_STATUS)).toContainText('Press play to start');

    // Click play (aria-label "Start stream")
    await page.locator(STREAM_TOGGLE).click();

    // Status should change to "Listening for messages"
    await expect(page.locator(STREAM_STATUS)).toContainText('Listening for messages', {
      timeout: 3000,
    });

    // Click stop (aria-label "Stop stream")
    await page.locator(STREAM_TOGGLE).click();

    // Status should return to "Press play to start"
    await expect(page.locator(STREAM_STATUS)).toContainText('Press play to start', {
      timeout: 3000,
    });
  });

  test('volume slider changes value', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Default volume is 100%
    await expect(page.locator(STREAM_VOLUME).getByText('100%')).toBeVisible();

    // Interact with the slider — click at ~50% position
    const slider = page.locator(STREAM_VOLUME).getByRole('slider');
    await expect(slider).toBeVisible();

    // Get slider bounding box and click at the midpoint (left edge = 0, right edge = 1)
    const box = await slider.boundingBox();
    if (box) {
      // Click at ~25% from left to set volume to roughly 25%
      await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    }

    // Verify the percentage display changed from 100%
    await expect(page.locator(STREAM_VOLUME).getByText('100%')).not.toBeVisible({ timeout: 3000 });
    // The percentage text should contain a % sign with a different value
    await expect(page.locator(STREAM_VOLUME).getByText(/%$/)).toBeVisible();
  });

  test('speed selector changes rate', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Default speed is 1x
    await expect(page.locator(STREAM_SPEED)).toContainText('1x');

    // Open the speed Select and choose 1.5x
    await page.locator(STREAM_SPEED).click();
    await page.getByRole('option', { name: '1.5x' }).click();

    // Verify 1.5x is now selected
    await expect(page.locator(STREAM_SPEED)).toContainText('1.5x');
  });

  test('queue shows empty state messages', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // When disabled, queue shows "Queue empty"
    await expect(page.locator(STREAM_QUEUE).getByText('Queue empty')).toBeVisible();

    // Enable stream
    await page.locator(STREAM_TOGGLE).click();
    await expect(page.locator(STREAM_STATUS)).toContainText('Listening for messages', {
      timeout: 3000,
    });

    // When enabled but no messages, queue shows "No messages yet"
    await expect(page.locator(STREAM_QUEUE).getByText('No messages yet')).toBeVisible({
      timeout: 3000,
    });
  });
});

// ─── CARD-092: preload on init + refresh button ───────────────────────────────

test.describe('Stream View — CARD-092: preload on init and refresh button', () => {
  let projectId: string;
  let projectPath: string;

  test.beforeAll(async () => {
    const project = await createTestProject('CARD-092 Stream Preload Test');
    projectId = project.projectId;
    projectPath = project.path;
    await seedDefaultAgents(project.projectId);

    // Seed broadcast messages (to='all') so getRecentMessages returns data
    for (let i = 0; i < 3; i++) {
      await callFunction('sendMessage', {
        projectId,
        from: 'pm-1',
        to: 'all',
        message: `Broadcast message ${i + 1}`,
      });
    }
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
        setTimeout(() => utterance.onend?.({ type: 'end' } as SpeechSynthesisEvent), 50);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });
  });

  test('stream-refresh button is visible on Stream page', async ({ page }) => {
    await page.goto(`/${projectId}`);
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="stream-refresh"]')).toBeVisible({ timeout: 5_000 });
  });

  test('stream-queue is visible on page load (not blank)', async ({ page }) => {
    await page.goto(`/${projectId}`);
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 15_000 });
    // queue container is always present (even empty)
    await expect(page.locator(STREAM_QUEUE)).toBeVisible({ timeout: 5_000 });
  });

  test('preloaded broadcast messages appear in stream-queue before TTS Start', async ({ page }) => {
    await page.goto(`/${projectId}`);
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 15_000 });

    // Messages should load automatically without clicking Start
    await expect(page.locator(STREAM_QUEUE_ITEM).first()).toBeVisible({ timeout: 10_000 });

    // Verify the seeded messages appear
    await expect(page.locator(STREAM_QUEUE).getByText('Broadcast message 1')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('refresh button reloads messages without navigating away', async ({ page }) => {
    await page.goto(`/${projectId}`);
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 15_000 });

    // Wait for initial load
    await expect(page.locator(STREAM_QUEUE_ITEM).first()).toBeVisible({ timeout: 10_000 });

    // Click refresh — should not navigate away or break the view
    await page.locator('[data-testid="stream-refresh"]').click();

    // Stream view should still be visible after refresh
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 5_000 });

    // Queue should still contain items after refresh
    await expect(page.locator(STREAM_QUEUE_ITEM).first()).toBeVisible({ timeout: 10_000 });
  });

  test('preloaded messages do not start TTS (TTS starts idle)', async ({ page }) => {
    await page.goto(`/${projectId}`);
    await expect(page.locator('[data-testid="stream-view"]')).toBeVisible({ timeout: 15_000 });

    // Wait for preloaded messages to appear
    await expect(page.locator(STREAM_QUEUE_ITEM).first()).toBeVisible({ timeout: 10_000 });

    // Status should be "Press play to start" — TTS is NOT automatically started
    await expect(page.locator(STREAM_STATUS)).toContainText('Press play to start');
  });
});

test.describe('Stream View — Message Queue', () => {
  let projectId: string;
  let projectPath: string;
  let projectName: string;
  let simulator: AgentSimulator;

  test.beforeAll(async () => {
    const project = await createTestProject('Stream Queue Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
    await seedDefaultAgents(projectId);
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.afterEach(async () => {
    if (simulator) await simulator.stop();
  });

  test('messages from agent appear in queue', async ({ page }) => {
    // Mock SpeechSynthesis — auto-fire onend after 50ms for queue progression
    await page.addInitScript(() => {
      window.__ttsSpoken = [];
      window.speechSynthesis.speak = (utterance) => {
        window.__ttsSpoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 50);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });

    simulator = new AgentSimulator(projectId, 'developer-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Enable stream
    await page.locator(STREAM_TOGGLE).click();
    await expect(page.locator(STREAM_STATUS)).toContainText('Listening for messages', {
      timeout: 3000,
    });

    // Send a message from agent to owner via simulator
    await simulator.sendMessage('owner', 'Hello from developer-1!');

    // Verify queue item appears with agent name and message text
    await expect(page.locator(STREAM_QUEUE_ITEM).filter({ hasText: 'developer-1' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(STREAM_QUEUE_ITEM).filter({ hasText: 'Hello from developer-1!' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('multiple messages queue up', async ({ page }) => {
    // Mock SpeechSynthesis — auto-fire onend after 50ms
    await page.addInitScript(() => {
      window.__ttsSpoken = [];
      window.speechSynthesis.speak = (utterance) => {
        window.__ttsSpoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 50);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });

    simulator = new AgentSimulator(projectId, 'qa-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Enable stream
    await page.locator(STREAM_TOGGLE).click();
    await expect(page.locator(STREAM_STATUS)).toContainText('Listening for messages', {
      timeout: 3000,
    });

    // Send 3 messages from agent to owner
    await simulator.sendMessage('owner', 'First message from qa-1');
    await simulator.sendMessage('owner', 'Second message from qa-1');
    await simulator.sendMessage('owner', 'Third message from qa-1');

    // Verify 3 queue items appear
    await expect(page.locator(STREAM_QUEUE_ITEM)).toHaveCount(3, { timeout: 15_000 });

    // Verify order
    const items = page.locator(STREAM_QUEUE_ITEM);
    await expect(items.nth(0)).toContainText('First message');
    await expect(items.nth(1)).toContainText('Second message');
    await expect(items.nth(2)).toContainText('Third message');
  });

  test('current queue item is highlighted', async ({ page }) => {
    // Mock SpeechSynthesis — do NOT auto-fire onend so the item stays at "speaking"
    await page.addInitScript(() => {
      window.__ttsSpoken = [];
      window.speechSynthesis.speak = (utterance) => {
        window.__ttsSpoken.push(utterance.text);
        // Intentionally do NOT call utterance.onend — keep item in "speaking" state
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });

    simulator = new AgentSimulator(projectId, 'senior-dev-1', {
      heartbeatInterval: 0,
      commandPollInterval: 0,
      pollInterval: 5000,
    });

    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Enable stream
    await page.locator(STREAM_TOGGLE).click();
    await expect(page.locator(STREAM_STATUS)).toContainText('Listening for messages', {
      timeout: 3000,
    });

    // Send a message — it will start speaking and stay highlighted
    await simulator.sendMessage('owner', 'Highlighted message');

    // Wait for queue item to appear
    const item = page.locator(STREAM_QUEUE_ITEM).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item).toContainText('Highlighted message');

    // Verify the item is highlighted — MUI ListItemButton adds Mui-selected class
    await expect(item).toHaveClass(/Mui-selected/, { timeout: 3000 });

    // Verify the left border color is the primary color (not transparent)
    const borderLeft = await item.evaluate((el) => getComputedStyle(el).borderLeftColor);
    // Primary color should not be transparent
    expect(borderLeft).not.toBe('transparent');
    expect(borderLeft).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Stream View — mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  let projectId: string;
  let projectPath: string;
  let projectName: string;

  test.beforeAll(async () => {
    const project = await createTestProject('Stream Mobile Test');
    projectId = project.projectId;
    projectPath = project.path;
    projectName = project.name;
  });

  test.afterAll(async () => {
    if (projectPath) await teardownProject(projectPath);
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__ttsSpoken = [];
      window.speechSynthesis.speak = (utterance) => {
        window.__ttsSpoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 50);
      };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.getVoices = () => [];
    });
  });

  test('mobile layout renders correctly at 375px', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);
    await page.locator(TAB_STREAM).click();
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });

    // Verify all controls are visible at mobile width
    await expect(page.locator(STREAM_TOGGLE)).toBeVisible();
    await expect(page.locator(STREAM_VOLUME)).toBeVisible();
    await expect(page.locator(STREAM_SPEED)).toBeVisible();
    await expect(page.locator(MIC_BUTTON)).toBeVisible();

    // Verify status text is visible
    await expect(page.locator(STREAM_STATUS)).toBeVisible();

    // Verify queue section is visible
    await expect(page.locator(STREAM_QUEUE)).toBeVisible();
  });

  test('mobile tab navigation to Stream', async ({ page }) => {
    await page.goto('/');
    await selectProject(page, projectName);

    // Click Stream tab
    await page.locator(TAB_STREAM).click();

    // Verify stream view renders
    await expect(page.locator(STREAM_VIEW)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(STREAM_VIEW).getByText('Audio Stream')).toBeVisible();
  });
});
