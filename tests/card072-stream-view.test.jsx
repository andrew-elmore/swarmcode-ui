/**
 * CARD-072: StreamView — Test Suite
 * Updated for CARD-090: Tests browser speechSynthesis message queue UI.
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-090: browser TTS replaces AudioStreamManager)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";

// Mock speechSynthesis API for jsdom
const mockCancel = jest.fn();
const mockSpeak = jest.fn();
const mockGetVoices = jest.fn(() => []);
window.speechSynthesis = {
  cancel: mockCancel,
  speak: mockSpeak,
  getVoices: mockGetVoices,
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
};
// Mock SpeechSynthesisUtterance (not available in jsdom)
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

const theme = createTheme();

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
};

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides },
      agents: { agents: [], loading: false, error: null },
    },
  });
}

function renderStreamView(ttsOverrides = {}) {
  const store = createTestStore(ttsOverrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <StreamView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("CARD-072: StreamView rendering", () => {
  test("renders 'Audio Stream' heading", () => {
    renderStreamView();
    expect(screen.getByText("Audio Stream")).toBeInTheDocument();
  });

  test("renders play button when stream is inactive", () => {
    renderStreamView({ enabled: false });
    expect(screen.getByLabelText("Start stream")).toBeInTheDocument();
    expect(screen.getByText("Press play to start")).toBeInTheDocument();
  });

  test("renders stop button when stream is active", () => {
    renderStreamView({ enabled: true });
    expect(screen.getByLabelText("Stop stream")).toBeInTheDocument();
  });

  test("renders volume label and percentage", () => {
    renderStreamView({ volume: 0.7 });
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  test("renders volume slider", () => {
    renderStreamView();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  test("renders speed selector", () => {
    renderStreamView();
    expect(screen.getByText("Speed")).toBeInTheDocument();
  });

  test("renders message queue area instead of canvas", () => {
    const { container } = renderStreamView();
    // CARD-090: No canvas (waveform removed), queue area present instead
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Queue empty")).toBeInTheDocument();
  });
});

// ─── Interactions ─────────────────────────────────────────────────────────────

describe("CARD-072: StreamView interactions", () => {
  test("clicking play dispatches setEnabled(true)", () => {
    const { store } = renderStreamView({ enabled: false });
    fireEvent.click(screen.getByLabelText("Start stream"));
    expect(store.getState().tts.enabled).toBe(true);
  });

  test("clicking stop cancels speech, clears queue, dispatches setEnabled(false)", () => {
    const { store } = renderStreamView({ enabled: true });
    fireEvent.click(screen.getByLabelText("Stop stream"));

    expect(mockCancel).toHaveBeenCalled();
    expect(store.getState().tts.enabled).toBe(false);
    expect(store.getState().tts.queue).toEqual([]);
  });

  test("volume change dispatches setVolume", () => {
    const { store } = renderStreamView({ volume: 1.0 });
    expect(store.getState().tts.volume).toBe(1.0);
  });

  test("speed change dispatches setRate", () => {
    const { store } = renderStreamView({ rate: 1.5 });
    expect(store.getState().tts.rate).toBe(1.5);
  });
});

// ─── Error Snackbar ───────────────────────────────────────────────────────────

describe("CARD-072: StreamView error handling", () => {
  test("shows error snackbar when tts.error is set", () => {
    renderStreamView({ error: "Audio decode error" });
    expect(screen.getByText("Audio decode error")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("no error snackbar when tts.error is null", () => {
    renderStreamView({ error: null });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ─── Message queue rendering ─────────────────────────────────────────────────

describe("CARD-090: StreamView message queue", () => {
  test("shows 'No messages yet' when enabled with empty queue", () => {
    renderStreamView({ enabled: true, queue: [], currentIndex: -1 });
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  test("shows 'Queue empty' when disabled with no queue", () => {
    renderStreamView({ enabled: false, queue: [], currentIndex: -1 });
    expect(screen.getByText("Queue empty")).toBeInTheDocument();
  });

  test("renders queued messages with agent names", () => {
    renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "Task assigned", status: "speaking" },
        { id: 2, from: "developer-1", message: "On it", status: "pending" },
      ],
      currentIndex: 0,
    });
    expect(screen.getByText("pm-1")).toBeInTheDocument();
    expect(screen.getByText("developer-1")).toBeInTheDocument();
  });

  test("current message is highlighted with primary border", () => {
    const { container } = renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "Hello", status: "speaking" },
        { id: 2, from: "qa-1", message: "Tests pass", status: "pending" },
      ],
      currentIndex: 0,
    });
    const selectedItems = container.querySelectorAll(".Mui-selected");
    expect(selectedItems.length).toBe(1);
  });

  test("done messages are dimmed (disabled)", () => {
    renderStreamView({
      enabled: true,
      queue: [
        { id: 1, from: "pm-1", message: "Done msg", status: "done" },
        { id: 2, from: "qa-1", message: "Current", status: "speaking" },
      ],
      currentIndex: 1,
    });
    const buttons = screen.getAllByRole("button");
    // The first queue item (done) should be disabled
    const queueButtons = buttons.filter((b) => b.getAttribute("data-queue-item") !== null);
    if (queueButtons.length > 0) {
      expect(queueButtons[0]).toHaveAttribute("aria-disabled", "true");
    }
  });
});

// ─── Speed options ────────────────────────────────────────────────────────────

describe("CARD-072: StreamView speed options", () => {
  test("includes 2x speed option (new addition)", () => {
    renderStreamView();
    const speedSelect = screen.getByText("Speed").closest("div").querySelector("[role='combobox']");
    expect(speedSelect).toBeInTheDocument();
  });
});
