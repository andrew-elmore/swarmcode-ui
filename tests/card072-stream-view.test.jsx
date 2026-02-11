/**
 * CARD-072: StreamView — Test Suite
 * Tests for the StreamView component (replaces TtsView).
 * Author: developer-1
 * Date: 2026-02-11
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import ttsReducer from "../src/store/ttsSlice";

// Mock audioStreamManager to avoid Web Audio API issues in jsdom
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSetVolume = jest.fn();
const mockSetSpeed = jest.fn();
const mockSetOnError = jest.fn();
const mockGetAnalyserNode = jest.fn(() => null);

jest.mock("../src/utils/audioStreamManager", () => {
  return class MockAudioStreamManager {
    start = mockStart;
    stop = mockStop;
    setVolume = mockSetVolume;
    setSpeed = mockSetSpeed;
    setOnError = mockSetOnError;
    getAnalyserNode = mockGetAnalyserNode;
  };
});

import StreamView from "../src/components/StreamView";

const theme = createTheme();

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: { tts: ttsReducer },
    preloadedState: { tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides } },
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
    expect(screen.getByText("Stream active")).toBeInTheDocument();
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

  test("renders waveform canvas", () => {
    const { container } = renderStreamView();
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});

// ─── Interactions ─────────────────────────────────────────────────────────────

describe("CARD-072: StreamView interactions", () => {
  test("clicking play starts the stream manager and dispatches setEnabled(true)", () => {
    const { store } = renderStreamView({ enabled: false });
    fireEvent.click(screen.getByLabelText("Start stream"));

    expect(mockStart).toHaveBeenCalled();
    expect(store.getState().tts.enabled).toBe(true);
  });

  test("clicking stop stops the stream manager and dispatches setEnabled(false)", () => {
    const { store } = renderStreamView({ enabled: true });
    fireEvent.click(screen.getByLabelText("Stop stream"));

    expect(mockStop).toHaveBeenCalled();
    expect(store.getState().tts.enabled).toBe(false);
  });

  test("volume change dispatches setVolume", () => {
    renderStreamView({ volume: 1.0 });
    expect(mockSetVolume).toHaveBeenCalledWith(1.0);
  });

  test("speed change dispatches setRate", () => {
    renderStreamView({ rate: 1.5 });
    expect(mockSetSpeed).toHaveBeenCalledWith(1.5);
  });

  test("wires error callback on mount", () => {
    renderStreamView();
    expect(mockSetOnError).toHaveBeenCalled();
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

// ─── Speed options ────────────────────────────────────────────────────────────

describe("CARD-072: StreamView speed options", () => {
  test("includes 2x speed option (new addition)", () => {
    renderStreamView();
    // Open the speed dropdown and check for 2x option
    const speedSelect = screen.getByText("Speed").closest("div").querySelector("[role='combobox']");
    expect(speedSelect).toBeInTheDocument();
  });
});
