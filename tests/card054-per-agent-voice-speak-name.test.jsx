/**
 * CARD-054 QA Tests — perAgentVoice + speakAgentName wiring.
 *
 * Verifies:
 * 1. Per-agent voice: messages from an agent with a configured voice call
 *    engine.setVoice() with the matching voice before speaking
 * 2. Agents without configured voice do NOT call engine.setVoice()
 * 3. speakAgentName ON: message text is prefixed with "AgentDescription says: ..."
 * 4. speakAgentName OFF: message text is raw (no prefix)
 * 5. Settings changes mid-session take effect via refs (no reload needed)
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer, { setSpeakAgentName, setAgentVoice } from "../src/store/ttsSlice";
import TtsEngine from "../src/utils/ttsEngine";
import MessagesView from "../src/components/MessagesView";

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  pollBoard: jest.fn(),
  sendMessage: jest.fn(),
  pollMessages: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const DEFAULT_AGENTS = [
  { name: "pm-1", description: "PM Agent", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1 },
  { name: "qa-1", description: "QA Engineer", isActive: true, sortOrder: 2 },
];

const MOCK_VOICES = [
  { name: "Google UK English Male", lang: "en-GB", default: true },
  { name: "Google US English", lang: "en-US", default: false },
  { name: "Microsoft David", lang: "en-US", default: false },
];

const DEFAULT_TTS_STATE = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  perAgentVoice: {},
  speakAgentName: false,
  error: null,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: DEFAULT_AGENTS, loading: false, error: null },
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    },
  });
}

let speakSpy;
let setVoiceSpy;

function renderWithProviders(ui, store) {
  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), store };
}

beforeEach(() => {
  speakSpy = jest.spyOn(TtsEngine.prototype, "speak");
  setVoiceSpy = jest.spyOn(TtsEngine.prototype, "setVoice");
  jest.spyOn(TtsEngine.prototype, "getVoices").mockReturnValue(MOCK_VOICES);

  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
});

afterEach(() => jest.restoreAllMocks());

// Helper to set up the component and capture the LiveQuery callback
async function setupWithCallback(store) {
  let liveQueryCallback = null;
  api.subscribeToMessages.mockImplementation((cb) => {
    liveQueryCallback = cb;
    return Promise.resolve(jest.fn());
  });

  renderWithProviders(<MessagesView />, store);

  await waitFor(() => {
    expect(liveQueryCallback).not.toBeNull();
  });

  speakSpy.mockClear();
  setVoiceSpy.mockClear();

  return liveQueryCallback;
}

function makeMsg(from, message, id) {
  return {
    id: id || `msg-${Date.now()}`,
    from,
    to: "owner",
    message,
    createdAt: "2026-02-10T14:00:00Z",
    broadcast: false,
  };
}

// ─── Per-Agent Voice ────────────────────────────────────────────────────────

describe("CARD-054: Per-agent voice wiring", () => {
  test("agent with configured voice: engine.setVoice is called with matching voice", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        perAgentVoice: { "pm-1": "Google UK English Male" },
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Task assigned"));
    });

    // setVoice should have been called with the matching voice object
    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Google UK English Male" })
    );
    expect(speakSpy).toHaveBeenCalled();
  });

  test("agent without configured voice: engine.setVoice is NOT called", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        perAgentVoice: { "pm-1": "Google UK English Male" },
        // developer-1 has no voice configured
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("developer-1", "Bug fix done"));
    });

    // setVoice should NOT be called for developer-1 (no voice configured)
    expect(setVoiceSpy).not.toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalledWith("Bug fix done");
  });

  test("different agents use different voices", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        perAgentVoice: {
          "pm-1": "Google UK English Male",
          "developer-1": "Microsoft David",
        },
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "First message"));
    });

    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Google UK English Male" })
    );

    setVoiceSpy.mockClear();

    await act(async () => {
      callback(makeMsg("developer-1", "Second message"));
    });

    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Microsoft David" })
    );
  });

  test("configured voice not in available voices: setVoice is not called", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        perAgentVoice: { "pm-1": "Nonexistent Voice" },
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Hello"));
    });

    // Voice not found in getVoices(), so setVoice should not be called
    expect(setVoiceSpy).not.toHaveBeenCalled();
    // But the message should still be spoken
    expect(speakSpy).toHaveBeenCalledWith("Hello");
  });
});

// ─── speakAgentName Toggle ──────────────────────────────────────────────────

describe("CARD-054: speakAgentName toggle", () => {
  test("speakAgentName ON: message prefixed with agent description + says", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: true },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Sprint review tomorrow"));
    });

    // Should be called with "PM Agent says: Sprint review tomorrow"
    expect(speakSpy).toHaveBeenCalledWith("PM Agent says: Sprint review tomorrow");
  });

  test("speakAgentName OFF: message is raw, no prefix", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: false },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Sprint review tomorrow"));
    });

    expect(speakSpy).toHaveBeenCalledWith("Sprint review tomorrow");
    expect(speakSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("says:")
    );
  });

  test("speakAgentName uses agent description, not agent name", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: true },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("developer-1", "Done with feature"));
    });

    // Should use "Developer" (description), not "developer-1" (name)
    expect(speakSpy).toHaveBeenCalledWith("Developer says: Done with feature");
  });

  test("speakAgentName for unknown agent falls back to agent name", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: true },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("unknown-agent", "Hello from unknown"));
    });

    // Falls back to msg.from when agent not found in agents list
    expect(speakSpy).toHaveBeenCalledWith("unknown-agent says: Hello from unknown");
  });

  test("owner messages are still not spoken regardless of speakAgentName", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: true },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback({
        id: "msg-owner",
        from: "owner",
        to: "pm-1",
        message: "Should not speak",
        createdAt: "2026-02-10T14:00:00Z",
        broadcast: false,
      });
    });

    expect(speakSpy).not.toHaveBeenCalled();
  });
});

// ─── Combined: perAgentVoice + speakAgentName ───────────────────────────────

describe("CARD-054: perAgentVoice + speakAgentName combined", () => {
  test("voice is set AND name is prepended when both are configured", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        speakAgentName: true,
        perAgentVoice: { "pm-1": "Google UK English Male" },
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Both features active"));
    });

    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Google UK English Male" })
    );
    expect(speakSpy).toHaveBeenCalledWith("PM Agent says: Both features active");
  });

  test("voice set but no name prefix when speakAgentName is off", async () => {
    const store = createTestStore({
      tts: {
        enabled: true,
        speakAgentName: false,
        perAgentVoice: { "pm-1": "Google UK English Male" },
      },
    });
    const callback = await setupWithCallback(store);

    await act(async () => {
      callback(makeMsg("pm-1", "Voice only"));
    });

    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Google UK English Male" })
    );
    expect(speakSpy).toHaveBeenCalledWith("Voice only");
  });
});

// ─── Mid-Session Settings Changes via Refs ──────────────────────────────────

describe("CARD-054: Settings changes mid-session via refs", () => {
  test("toggling speakAgentName mid-session takes effect on next message", async () => {
    const store = createTestStore({
      tts: { enabled: true, speakAgentName: false },
    });
    const callback = await setupWithCallback(store);

    // First message: no prefix
    await act(async () => {
      callback(makeMsg("pm-1", "Before toggle"));
    });
    expect(speakSpy).toHaveBeenCalledWith("Before toggle");

    speakSpy.mockClear();

    // Toggle speakAgentName ON mid-session
    await act(async () => {
      store.dispatch(setSpeakAgentName(true));
    });

    // Second message: should now have prefix
    await act(async () => {
      callback(makeMsg("pm-1", "After toggle"));
    });
    expect(speakSpy).toHaveBeenCalledWith("PM Agent says: After toggle");
  });

  test("changing perAgentVoice mid-session takes effect on next message", async () => {
    const store = createTestStore({
      tts: { enabled: true, perAgentVoice: {} },
    });
    const callback = await setupWithCallback(store);

    // First message: no voice configured
    await act(async () => {
      callback(makeMsg("pm-1", "No voice yet"));
    });
    expect(setVoiceSpy).not.toHaveBeenCalled();

    setVoiceSpy.mockClear();

    // Configure voice mid-session
    await act(async () => {
      store.dispatch(setAgentVoice({ agent: "pm-1", voiceName: "Microsoft David" }));
    });

    // Second message: should now use the configured voice
    await act(async () => {
      callback(makeMsg("pm-1", "With voice now"));
    });
    expect(setVoiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Microsoft David" })
    );
  });
});
