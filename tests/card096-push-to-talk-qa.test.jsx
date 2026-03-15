/**
 * CARD-096 QA: Push-to-talk voice command feature — StreamView regression tests.
 *
 * Updated for CARD-093: per-agent hold-to-talk buttons replace single mic button.
 * The old single "mic-button" + parseVoiceCommand agent identification has been
 * replaced with explicit per-agent buttons (data-testid='stt-button-{agentName}')
 * and an All Agents button (data-testid='stt-button-all').
 *
 * These tests verify the CARD-093 implementation via StreamView:
 *   TC-01 to TC-03: Button rendering + default state
 *   TC-04 to TC-07: SpeechRecognition lifecycle
 *   TC-08 to TC-11: sendMessage dispatch behavior
 *   TC-12 to TC-15: Error handling
 *   TC-16 to TC-18: Edge cases
 *
 * Author: qa-1
 * Updated: 2026-03-15 (CARD-093: per-agent hold-to-talk)
 */

// ─── SpeechRecognition mock ──────────────────────────────────────────────────

let mockRecognitionInstance = null;

function createMockRecognitionInstance() {
  const instance = {
    continuous: false,
    interimResults: false,
    lang: "",
    onresult: null,
    onerror: null,
    onend: null,
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  };
  mockRecognitionInstance = instance;
  return instance;
}

const MockSpeechRecognition = jest.fn().mockImplementation(createMockRecognitionInstance);
window.SpeechRecognition = MockSpeechRecognition;

// speechSynthesis mock
window.speechSynthesis = {
  cancel: jest.fn(),
  speak: jest.fn(),
  getVoices: jest.fn(() => []),
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

// ─── Imports ─────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import StreamView from "../src/components/StreamView";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectReducer from "../src/store/projectSlice";
import projectsReducer from "../src/store/projectsSlice";

// ─── Mock API ────────────────────────────────────────────────────────────────

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue({ result: {} }),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn().mockResolvedValue(jest.fn()),
  subscribeToCommands: jest.fn().mockResolvedValue(jest.fn()),
  subscribeToPings: jest.fn().mockResolvedValue(jest.fn()),
  getRecentMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  createSprint: jest.fn(),
  getSprints: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
}));

import * as api from "../src/services/api";

// ─── Theme & store helpers ───────────────────────────────────────────────────

const theme = createTheme();

const DEFAULT_TTS_STATE = {
  enabled: false,
  volume: 1.0,
  rate: 1.0,
  voice: "",
  error: null,
  queue: [],
  currentIndex: -1,
  streamLoading: false,
};

const TEST_AGENTS = [
  { name: "pm-1", description: "Project Manager", isActive: true, sortOrder: 0, voice: null },
  { name: "developer-1", description: "Developer", isActive: true, sortOrder: 1, voice: null },
  { name: "senior-dev-1", description: "Senior Developer", isActive: true, sortOrder: 2, voice: null },
  { name: "qa-1", description: "QA Engineer", isActive: true, sortOrder: 3, voice: null },
  { name: "devops-1", description: "DevOps Engineer", isActive: true, sortOrder: 4, voice: null },
];

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
      project: projectReducer,
      projects: projectsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: TEST_AGENTS, allAgents: [], loading: false, error: null },
      project: overrides.project || {
        project: { objectId: "board-096-1" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
      messages: overrides.messages || {
        conversations: {
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        refreshing: false,
        error: null,
        liveQueryRefreshFlag: false,
        mobileDrawerOpen: false,
      },
      projects: overrides.projects || {
        projects: [],
        activeProject: null,
        loading: false,
        error: null,
      },
    },
  });
}

function renderStreamView(overrides = {}) {
  const store = createTestStore(overrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <StreamView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

// Helper: build a final speech result event
function makeSpeechResult(transcript) {
  const result = [{ transcript }];
  result.isFinal = true;
  const results = [result];
  results.length = 1;
  return { results };
}

// ─── Setup & teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRecognitionInstance = null;
  window.SpeechRecognition = MockSpeechRecognition;
  api.getRecentMessages.mockResolvedValue({ messages: [] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-01 to TC-03: Button rendering + default state
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Mic button rendering", () => {
  test("TC-01: per-agent mic buttons render for each agent in the store", () => {
    renderStreamView();
    expect(screen.getByTestId("stt-button-pm-1")).toBeInTheDocument();
    expect(screen.getByTestId("stt-button-developer-1")).toBeInTheDocument();
    expect(screen.getByTestId("stt-button-senior-dev-1")).toBeInTheDocument();
    expect(screen.getByTestId("stt-button-qa-1")).toBeInTheDocument();
    expect(screen.getByTestId("stt-button-devops-1")).toBeInTheDocument();
  });

  test("TC-02: 'Voice Commands' section heading is displayed", () => {
    renderStreamView();
    expect(screen.getByText("Voice Commands")).toBeInTheDocument();
  });

  test("TC-03: default status text shows 'Hold a button to speak'", () => {
    renderStreamView();
    expect(screen.getByTestId("mic-status")).toHaveTextContent("Hold a button to speak");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-04 to TC-07: SpeechRecognition lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: SpeechRecognition interaction", () => {
  test("TC-04: pressing per-agent button creates SpeechRecognition and calls start()", () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    expect(MockSpeechRecognition).toHaveBeenCalledTimes(1);
    expect(mockRecognitionInstance).not.toBeNull();
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    expect(mockRecognitionInstance.continuous).toBe(false);
    expect(mockRecognitionInstance.interimResults).toBe(true);
    expect(mockRecognitionInstance.lang).toBe("en-US");
  });

  test("TC-05: releasing mic button calls recognition.stop()", () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    fireEvent.pointerUp(screen.getByTestId("stt-button-pm-1"));

    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });

  test("TC-06: while listening, mic-status shows 'Listening for pm-1...'", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1...");
    });
  });

  test("TC-07: pressing a different agent button starts recognition for that agent", async () => {
    renderStreamView();
    // Press developer-1 button
    fireEvent.pointerDown(screen.getByTestId("stt-button-developer-1"));

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for developer-1...");
    });
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-08 to TC-11: Message dispatch
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Message dispatch", () => {
  test("TC-08: sendMessage called with correct agent and message after recording ends", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("create a login page"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: "pm-1", message: "create a login page" })
      );
    });
  });

  test("TC-09: All Agents button dispatches sendMessage with to='all'", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-all"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("please do a status update"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledTimes(1);
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: "all", message: "please do a status update" })
      );
    });
  });

  test("TC-10: mic-status shows 'Sent to developer-1' after dispatch", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-developer-1"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("fix the bug"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Sent to developer-1");
    });
  });

  test("TC-11: mic-status shows 'Sent to all agents' after all-agents dispatch", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-all"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("team please respond"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Sent to all agents");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-12 to TC-15: Error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Error handling", () => {
  test("TC-12: stt-button-all renders and no unsupported-browser error shown when SpeechRecognition is available", () => {
    renderStreamView();
    expect(screen.getByTestId("stt-button-all")).toBeInTheDocument();
    expect(screen.queryByText("Voice commands not supported in this browser")).not.toBeInTheDocument();
  });

  test("TC-13: unsupported browser shows error in mic-status when button pressed", () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    expect(screen.getByTestId("mic-status")).toHaveTextContent(
      "Voice commands not supported in this browser"
    );

    // Restore for other tests
    window.SpeechRecognition = MockSpeechRecognition;
  });

  test("TC-14: sendMessage NOT dispatched when onend fires without a transcript", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      // onend fires without any onresult — transcript stays empty
      mockRecognitionInstance.onend();
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  test("TC-15: recognition error 'not-allowed' shows 'Microphone access denied'", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "not-allowed" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Microphone access denied");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-16 to TC-18: Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Edge cases", () => {
  test("TC-16: pointer leave on active agent button triggers stop", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    await waitFor(() => expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1..."));

    // pointerLeave on active button
    fireEvent.pointerLeave(screen.getByTestId("stt-button-pm-1"));
    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });

  test("TC-17: pointer leave on INACTIVE button does NOT stop recognition", async () => {
    renderStreamView();
    // Start recording on pm-1
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    await waitFor(() => expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1..."));

    // pointerLeave on developer-1 (not active) — should not stop
    fireEvent.pointerLeave(screen.getByTestId("stt-button-developer-1"));
    expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();
  });

  test("TC-18: 'no-speech' recognition error displays correctly", async () => {
    renderStreamView();
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "no-speech" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("No speech detected, try again");
    });
  });
});
