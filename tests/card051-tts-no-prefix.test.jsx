/**
 * CARD-051 QA Tests — TTS speaks message content only, no agent name prefix.
 *
 * Updated for CARD-073: Now tests that synthesizeSpeech is called with
 * raw msg.message (no prefix), using server-side Piper TTS via AudioStreamManager.
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-073: replaced TtsEngine with AudioStreamManager)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";

// Mock StreamView.getStreamManager
const mockQueueSpeech = jest.fn();
const mockStreamManager = {
  active: true,
  start: jest.fn(),
  stop: jest.fn(),
  setVolume: jest.fn(),
  setSpeed: jest.fn(),
  setOnError: jest.fn(),
  getAnalyserNode: jest.fn(() => null),
  queueSpeech: mockQueueSpeech,
};

jest.mock("../src/components/StreamView", () => ({
  getStreamManager: () => mockStreamManager,
}));

// Mock API
const mockSynthesizeSpeech = jest.fn(() => Promise.resolve(new ArrayBuffer(100)));
let capturedOnMessage = null;

jest.mock("../src/services/api", () => ({
  subscribeToMessages: jest.fn((cb) => {
    capturedOnMessage = cb;
    return Promise.resolve(jest.fn());
  }),
  synthesizeSpeech: (...args) => mockSynthesizeSpeech(...args),
}));

import MessagesView from "../src/components/MessagesView";

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_TTS_STATE = { enabled: false, volume: 1.0, rate: 1.0, perAgentVoice: {}, speakAgentName: false, error: null };

function createTestStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...ttsOverrides },
      agents: {
        agents: [
          { name: "pm-1", description: "PM Agent", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
          { name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 1 },
        ],
        loading: false,
        error: null,
      },
      board: { board: null, cards: [], loading: false, error: null, sprints: [], sprintFilter: "" },
    },
  });
}

function renderWithProviders(ui, store) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), store: testStore };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnMessage = null;
  mockStreamManager.active = true;
  mockSynthesizeSpeech.mockResolvedValue(new ArrayBuffer(100));
});

describe("CARD-051: TTS speaks message only, no agent name prefix", () => {
  test("TTS synthesizeSpeech receives only message content when TTS is enabled", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-1",
        from: "developer-1",
        to: "owner",
        message: "Bug fix complete",
        createdAt: "2026-02-10T12:01:00Z",
        broadcast: false,
      });
    });

    // synthesizeSpeech should have been called with raw message only
    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Bug fix complete" })
      );
    });
    // Verify it was NOT called with any agent name prefix
    expect(mockSynthesizeSpeech).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("says:") })
    );
  });

  test("agent name prefix is NOT prepended to synthesized text", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-2",
        from: "pm-1",
        to: "owner",
        message: "Task assigned to developer-1",
        createdAt: "2026-02-10T12:02:00Z",
        broadcast: false,
      });
    });

    await waitFor(() => {
      expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1);
    });
    const calledText = mockSynthesizeSpeech.mock.calls[0][0].text;
    expect(calledText).toBe("Task assigned to developer-1");
    expect(calledText).not.toMatch(/^pm-1 says:/);
    expect(calledText).not.toMatch(/^PM Agent says:/);
  });

  test("owner messages are NOT synthesized (only incoming agent messages)", async () => {
    const store = createTestStore({ enabled: true });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-3",
        from: "owner",
        to: "pm-1",
        message: "This is from the owner",
        createdAt: "2026-02-10T12:03:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });

  test("TTS does not synthesize when TTS is disabled", async () => {
    const store = createTestStore({ enabled: false });
    renderWithProviders(<MessagesView />, store);

    await waitFor(() => expect(capturedOnMessage).toBeTruthy());

    await act(async () => {
      capturedOnMessage({
        id: "msg-4",
        from: "pm-1",
        to: "owner",
        message: "Should not be spoken",
        createdAt: "2026-02-10T12:04:00Z",
        broadcast: false,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });
});
