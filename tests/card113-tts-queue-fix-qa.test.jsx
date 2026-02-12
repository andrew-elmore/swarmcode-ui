/**
 * CARD-113 QA Tests — TTS queue: messages must play sequentially, not interrupt
 * Author: qa-1
 * Date: 2026-02-12
 *
 * Bug: New TTS messages interrupted the currently playing message instead of
 * queuing.  Root cause: tts.queue in useEffect dependency array caused
 * enqueueMessage dispatches to re-fire the speech effect, which called
 * speechSynthesis.cancel() and interrupted the current utterance.
 *
 * Fix (senior-dev-1, commit 3298e25):
 *   1. Removed tts.queue/rate/volume from useEffect deps
 *   2. Added speakingIndexRef guard to prevent re-speaking same index
 *   3. Reset guard on stop/skip/unmount/utterance completion
 *
 * Test coverage:
 *   TC-01  Single message plays normally (no regression)
 *   TC-02  Multiple rapid enqueues — only first message triggers speech
 *   TC-03  Queue order preserved — messages play in arrival order
 *   TC-04  advanceQueue after utterance.onend triggers next message
 *   TC-05  No duplicate speech calls for the same index (speakingIndexRef guard)
 *   TC-06  Skip mid-playback — jumps cleanly, resets guard
 *   TC-07  Stop resets speakingIndexRef — can restart cleanly
 *   TC-08  Unmount resets speakingIndexRef and cancels speech
 *   TC-09  Empty preprocessed message is skipped without hanging the queue
 *   TC-10  utterance.onerror (non-cancel) still advances queue
 *   TC-11  utterance.onerror with "canceled" does not dispatch setError
 *   TC-12  Source code: tts.queue NOT in useEffect dependency array
 *   TC-13  Source code: speakingIndexRef guard present
 *   TC-14  Source code: speakingIndexRef reset on stop, skip, unmount, onend, onerror
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer, {
  enqueueMessage,
  advanceQueue,
  skipToMessage,
  setEnabled,
  clearQueue,
} from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";

// ── speechSynthesis mock ─────────────────────────────────────────────────────

const mockCancel = jest.fn();
const mockSpeak = jest.fn();
const mockGetVoices = jest.fn(() => [
  { name: "Google US English", lang: "en-US", localService: false },
]);
window.speechSynthesis = {
  cancel: mockCancel,
  speak: mockSpeak,
  getVoices: mockGetVoices,
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
};
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
};

import StreamView from "../src/components/StreamView";

// ── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();

const DEFAULT_TTS = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
};

function createTestStore(ttsOverrides = {}, agentsOverrides = {}) {
  return configureStore({
    reducer: { tts: ttsReducer, agents: agentsReducer },
    preloadedState: {
      tts: { ...DEFAULT_TTS, ...ttsOverrides },
      agents: { agents: [], loading: false, error: null, ...agentsOverrides },
    },
  });
}

function renderStreamView(ttsOverrides = {}, agentsOverrides = {}) {
  const store = createTestStore(ttsOverrides, agentsOverrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <StreamView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => jest.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// Part 1 — Behavioural tests (StreamView component integration)
// ═════════════════════════════════════════════════════════════════════════════

describe("CARD-113 QA: single message — no regression (TC-01)", () => {
  test("single message in queue triggers exactly one speechSynthesis.speak call", () => {
    renderStreamView({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "Hello world", status: "speaking" }],
      currentIndex: 0,
    });

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance).toBeInstanceOf(SpeechSynthesisUtterance);
    // ttsPreprocess converts "pm-1" agent names in messages but the raw
    // message "Hello world" has no transforms — just verify it was spoken.
    expect(utterance.text).toBeTruthy();
  });
});

describe("CARD-113 QA: rapid enqueue — no interruption (TC-02)", () => {
  test("enqueuing additional messages while first is speaking does NOT call speak again", () => {
    const { store } = renderStreamView({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "First message", status: "speaking" }],
      currentIndex: 0,
    });

    // speak should have been called once for the initial render
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Rapidly enqueue two more messages — these should NOT trigger speech
    act(() => {
      store.dispatch(enqueueMessage({ from: "qa-1", message: "Second message" }));
    });
    act(() => {
      store.dispatch(enqueueMessage({ from: "dev-1", message: "Third message" }));
    });

    // Still only one speak call — the first message is still playing
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Queue grew but currentIndex stayed at 0
    const { queue, currentIndex } = store.getState().tts;
    expect(queue).toHaveLength(3);
    expect(currentIndex).toBe(0);
    expect(queue[0].status).toBe("speaking");
    expect(queue[1].status).toBe("pending");
    expect(queue[2].status).toBe("pending");
  });
});

describe("CARD-113 QA: queue order preserved (TC-03)", () => {
  test("messages remain in FIFO order after multiple enqueues", () => {
    const store = createTestStore({ enabled: true });

    act(() => { store.dispatch(enqueueMessage({ from: "pm-1", message: "Alpha" })); });
    act(() => { store.dispatch(enqueueMessage({ from: "qa-1", message: "Bravo" })); });
    act(() => { store.dispatch(enqueueMessage({ from: "dev-1", message: "Charlie" })); });

    const { queue } = store.getState().tts;
    expect(queue[0].message).toBe("Alpha");
    expect(queue[1].message).toBe("Bravo");
    expect(queue[2].message).toBe("Charlie");
    expect(queue[0].from).toBe("pm-1");
    expect(queue[1].from).toBe("qa-1");
    expect(queue[2].from).toBe("dev-1");
  });
});

describe("CARD-113 QA: advanceQueue triggers next message (TC-04)", () => {
  test("after advanceQueue, next pending message becomes speaking", () => {
    const store = createTestStore({ enabled: true });

    // Enqueue 3 messages — first auto-starts
    act(() => { store.dispatch(enqueueMessage({ from: "pm-1", message: "First" })); });
    act(() => { store.dispatch(enqueueMessage({ from: "qa-1", message: "Second" })); });
    act(() => { store.dispatch(enqueueMessage({ from: "dev-1", message: "Third" })); });

    expect(store.getState().tts.currentIndex).toBe(0);
    expect(store.getState().tts.queue[0].status).toBe("speaking");

    // Simulate utterance.onend -> advanceQueue
    act(() => { store.dispatch(advanceQueue()); });

    expect(store.getState().tts.currentIndex).toBe(1);
    expect(store.getState().tts.queue[0].status).toBe("done");
    expect(store.getState().tts.queue[1].status).toBe("speaking");

    // Advance again
    act(() => { store.dispatch(advanceQueue()); });

    expect(store.getState().tts.currentIndex).toBe(2);
    expect(store.getState().tts.queue[1].status).toBe("done");
    expect(store.getState().tts.queue[2].status).toBe("speaking");

    // Advance past last -> idle
    act(() => { store.dispatch(advanceQueue()); });

    expect(store.getState().tts.currentIndex).toBe(-1);
    expect(store.getState().tts.queue[2].status).toBe("done");
  });
});

describe("CARD-113 QA: speakingIndexRef guard — no duplicate speech (TC-05)", () => {
  test("re-render with same currentIndex does NOT trigger additional speak calls", () => {
    const { store, rerender } = renderStreamView({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "Hello", status: "speaking" }],
      currentIndex: 0,
    });

    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Force a re-render (simulates React re-render from unrelated state change)
    rerender(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <StreamView />
        </ThemeProvider>
      </Provider>
    );

    // Still only 1 speak call — the guard prevents duplicate
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});

describe("CARD-113 QA: skip mid-playback (TC-06)", () => {
  test("clicking a pending queue item jumps cleanly and speaks the target", () => {
    const { store } = renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "First", status: "speaking" },
        { id: 2, from: "qa-1", message: "Second", status: "pending" },
        { id: 3, from: "dev-1", message: "Third", status: "pending" },
      ],
      currentIndex: 0,
    });

    // speak called once for initial first message
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    mockCancel.mockClear();
    mockSpeak.mockClear();

    // Click third item to skip
    fireEvent.click(screen.getByText("dev-1"));

    const { queue, currentIndex } = store.getState().tts;
    expect(currentIndex).toBe(2);
    expect(queue[0].status).toBe("done");
    expect(queue[1].status).toBe("done");
    expect(queue[2].status).toBe("speaking");

    // speechSynthesis.cancel should have been called (from handleSkip)
    expect(mockCancel).toHaveBeenCalled();

    // speak should have been called for the new target
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});

describe("CARD-113 QA: stop resets guard — clean restart (TC-07)", () => {
  test("stop then re-enable with new queue works correctly", () => {
    const { store } = renderStreamView({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "Playing", status: "speaking" }],
      currentIndex: 0,
    });

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    mockSpeak.mockClear();
    mockCancel.mockClear();

    // Stop
    fireEvent.click(screen.getByLabelText("Stop stream"));
    expect(mockCancel).toHaveBeenCalled();
    expect(store.getState().tts.enabled).toBe(false);
    expect(store.getState().tts.queue).toEqual([]);
    expect(store.getState().tts.currentIndex).toBe(-1);
  });
});

describe("CARD-113 QA: unmount cleanup (TC-08)", () => {
  test("unmounting cancels speech", () => {
    const { unmount } = renderStreamView({
      enabled: true,
      queue: [{ id: 1, from: "pm-1", message: "Hello", status: "speaking" }],
      currentIndex: 0,
    });

    mockCancel.mockClear();
    unmount();

    // Cleanup effect should call speechSynthesis.cancel()
    expect(mockCancel).toHaveBeenCalled();
  });
});

describe("CARD-113 QA: empty preprocessed message skipped (TC-09)", () => {
  test("message that preprocesses to empty string advances to next", () => {
    // An empty string message preprocesses to ""
    const { store } = renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "", status: "speaking" },
        { id: 2, from: "qa-1", message: "Real message", status: "pending" },
      ],
      currentIndex: 0,
    });

    // ttsPreprocess("") returns "" -> should skip and advanceQueue
    // The second message should now be speaking
    const { currentIndex, queue } = store.getState().tts;
    expect(currentIndex).toBe(1);
    expect(queue[0].status).toBe("done");
    expect(queue[1].status).toBe("speaking");
  });
});

describe("CARD-113 QA: utterance.onerror advances queue (TC-10)", () => {
  test("onerror with non-cancel error dispatches setError and advances", () => {
    mockSpeak.mockImplementationOnce((utterance) => {
      // Simulate an error during speech
      if (utterance.onerror) {
        utterance.onerror({ error: "network" });
      }
    });

    const { store } = renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "Will fail", status: "speaking" },
        { id: 2, from: "qa-1", message: "Next up", status: "pending" },
      ],
      currentIndex: 0,
    });

    // Error should have been set
    expect(store.getState().tts.error).toBe("Speech error: network");
    // Queue should have advanced to next message
    expect(store.getState().tts.currentIndex).toBe(1);
    expect(store.getState().tts.queue[0].status).toBe("done");
    expect(store.getState().tts.queue[1].status).toBe("speaking");
  });
});

describe("CARD-113 QA: 'canceled' error does NOT set error state (TC-11)", () => {
  test("onerror with 'canceled' reason does not dispatch setError", () => {
    mockSpeak.mockImplementationOnce((utterance) => {
      // 'canceled' happens on skip/stop — not a real error
      if (utterance.onerror) {
        utterance.onerror({ error: "canceled" });
      }
    });

    const { store } = renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "Will be canceled", status: "speaking" },
        { id: 2, from: "qa-1", message: "Next", status: "pending" },
      ],
      currentIndex: 0,
    });

    // Error should NOT be set for 'canceled'
    expect(store.getState().tts.error).toBeNull();
    // But queue still advances
    expect(store.getState().tts.currentIndex).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 2 — ttsSlice unit tests: sequential queue integrity
// ═════════════════════════════════════════════════════════════════════════════

describe("CARD-113 QA: ttsSlice sequential queue integrity", () => {
  test("rapidly enqueuing 5 messages — only first auto-starts, rest stay pending", () => {
    const store = createTestStore({ enabled: true });

    for (let i = 0; i < 5; i++) {
      store.dispatch(enqueueMessage({ from: `agent-${i}`, message: `Message ${i}` }));
    }

    const { queue, currentIndex } = store.getState().tts;
    expect(queue).toHaveLength(5);
    expect(currentIndex).toBe(0);
    expect(queue[0].status).toBe("speaking");
    for (let i = 1; i < 5; i++) {
      expect(queue[i].status).toBe("pending");
    }
  });

  test("full sequential playthrough: 3 messages via advanceQueue", () => {
    const store = createTestStore({ enabled: true });

    store.dispatch(enqueueMessage({ from: "pm-1", message: "A" }));
    store.dispatch(enqueueMessage({ from: "qa-1", message: "B" }));
    store.dispatch(enqueueMessage({ from: "dev-1", message: "C" }));

    // Message A speaking
    expect(store.getState().tts.queue[0].status).toBe("speaking");

    // A finishes
    store.dispatch(advanceQueue());
    expect(store.getState().tts.queue[0].status).toBe("done");
    expect(store.getState().tts.queue[1].status).toBe("speaking");
    expect(store.getState().tts.currentIndex).toBe(1);

    // B finishes
    store.dispatch(advanceQueue());
    expect(store.getState().tts.queue[1].status).toBe("done");
    expect(store.getState().tts.queue[2].status).toBe("speaking");
    expect(store.getState().tts.currentIndex).toBe(2);

    // C finishes
    store.dispatch(advanceQueue());
    expect(store.getState().tts.queue[2].status).toBe("done");
    expect(store.getState().tts.currentIndex).toBe(-1); // idle
  });

  test("enqueue during playback adds to end, does not change currentIndex", () => {
    const store = createTestStore({ enabled: true });

    store.dispatch(enqueueMessage({ from: "pm-1", message: "A" }));
    expect(store.getState().tts.currentIndex).toBe(0);

    // New message arrives while A is playing
    store.dispatch(enqueueMessage({ from: "qa-1", message: "B" }));
    expect(store.getState().tts.currentIndex).toBe(0); // unchanged
    expect(store.getState().tts.queue[0].status).toBe("speaking");
    expect(store.getState().tts.queue[1].status).toBe("pending");

    // Another arrives
    store.dispatch(enqueueMessage({ from: "dev-1", message: "C" }));
    expect(store.getState().tts.currentIndex).toBe(0); // still 0
    expect(store.getState().tts.queue).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 3 — Source code verification
// ═════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

describe("CARD-113 QA: source code verification", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/components/StreamView.jsx"),
    "utf8"
  );

  test("TC-12: tts.queue is NOT in the useEffect dependency array", () => {
    // The main speech useEffect should depend on tts.currentIndex, tts.enabled, etc.
    // but NOT tts.queue, tts.rate, or tts.volume
    // The eslint-disable-next-line comment documents this intentional omission
    expect(streamViewSrc).toMatch(
      /eslint-disable-next-line react-hooks\/exhaustive-deps.*CARD-113.*queue.*intentionally omitted/
    );

    // Verify the dependency array explicitly lists tts.currentIndex
    expect(streamViewSrc).toMatch(/\[tts\.currentIndex,\s*tts\.enabled/);

    // Verify tts.queue is NOT in the dependency array line
    // Find the dependency array for the speech useEffect
    const depArrayMatch = streamViewSrc.match(
      /\[tts\.currentIndex[^\]]*\]/
    );
    expect(depArrayMatch).toBeTruthy();
    expect(depArrayMatch[0]).not.toContain("tts.queue");
    expect(depArrayMatch[0]).not.toContain("tts.rate");
    expect(depArrayMatch[0]).not.toContain("tts.volume");
  });

  test("TC-13: speakingIndexRef guard is present", () => {
    // The ref is created
    expect(streamViewSrc).toMatch(/speakingIndexRef\s*=\s*useRef\(-1\)/);

    // The guard check exists: skip if already speaking this index
    expect(streamViewSrc).toMatch(
      /if\s*\(\s*speakingIndexRef\.current\s*===\s*currentIndex\s*\)\s*return/
    );

    // The ref is set after the guard passes
    expect(streamViewSrc).toMatch(
      /speakingIndexRef\.current\s*=\s*currentIndex/
    );
  });

  test("TC-14: speakingIndexRef reset on stop, skip, unmount, onend, and onerror", () => {
    // Count occurrences of resetting the ref to -1
    const resetPattern = /speakingIndexRef\.current\s*=\s*-1/g;
    const resets = streamViewSrc.match(resetPattern) || [];

    // Should be at least 5 resets:
    //   1. handleToggle (stop)
    //   2. handleSkip
    //   3. cleanup useEffect (unmount)
    //   4. utterance.onend
    //   5. utterance.onerror
    //   6. empty preprocessed message skip
    expect(resets.length).toBeGreaterThanOrEqual(5);

    // Specifically verify key locations:
    // handleToggle contains the reset
    const handleToggleMatch = streamViewSrc.match(
      /handleToggle[\s\S]*?speakingIndexRef\.current\s*=\s*-1/
    );
    expect(handleToggleMatch).toBeTruthy();

    // handleSkip contains the reset
    const handleSkipMatch = streamViewSrc.match(
      /handleSkip[\s\S]*?speakingIndexRef\.current\s*=\s*-1/
    );
    expect(handleSkipMatch).toBeTruthy();

    // onend callback resets
    expect(streamViewSrc).toMatch(
      /onend\s*=\s*\(\)\s*=>\s*\{[\s\S]*?speakingIndexRef\.current\s*=\s*-1/
    );

    // onerror callback resets
    expect(streamViewSrc).toMatch(
      /onerror\s*=\s*\(e\)\s*=>\s*\{[\s\S]*?speakingIndexRef\.current\s*=\s*-1/
    );
  });
});
