/**
 * CARD-096 QA: Push-to-talk voice command feature — StreamView integration tests.
 *
 * Tests the mic button UI, SpeechRecognition interaction, message dispatch,
 * error handling, and edge cases.
 *
 * Author: qa-1
 * Date: 2026-02-11
 */

// ─── SpeechRecognition mock (MUST be set BEFORE StreamView import) ───────────
// StreamView.jsx captures SpeechRecognition at module scope, so we must
// install the mock on window before the import runs.

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

// speechSynthesis mock (also needed before import for the TTS useEffect)
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

// ─── Now safe to import ──────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import StreamView from "../src/components/StreamView";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import messagesReducer from "../src/store/messagesSlice";
import boardReducer from "../src/store/boardSlice";
import projectsReducer from "../src/store/projectsSlice";

// ─── Mock API ────────────────────────────────────────────────────────────────

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  pollBoard: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue({ result: {} }),
  pollMessages: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn().mockResolvedValue(jest.fn()),
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
      board: boardReducer,
      projects: projectsReducer,
    },
    preloadedState: {
      tts: { ...DEFAULT_TTS_STATE, ...(overrides.tts || {}) },
      agents: overrides.agents || { agents: TEST_AGENTS, loading: false, error: null },
      board: overrides.board || {
        board: { projectHash: "test-hash-123" },
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
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
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

// ─── Setup & teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockRecognitionInstance = null;
});

afterEach(() => {
  jest.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-01 to TC-03: Mic button rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Mic button rendering", () => {
  test("TC-01: mic button renders with data-testid", () => {
    renderStreamView();
    expect(screen.getByTestId("mic-button")).toBeInTheDocument();
  });

  test("TC-02: 'Voice Command' heading is displayed", () => {
    renderStreamView();
    expect(screen.getByText("Voice Command")).toBeInTheDocument();
  });

  test("TC-03: default status text shows 'Hold mic to speak a command'", () => {
    renderStreamView();
    expect(screen.getByText("Hold mic to speak a command")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-04 to TC-07: SpeechRecognition interaction
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: SpeechRecognition interaction", () => {
  test("TC-04: pressing mic button creates SpeechRecognition and calls start()", () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    expect(MockSpeechRecognition).toHaveBeenCalledTimes(1);
    expect(mockRecognitionInstance).not.toBeNull();
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    expect(mockRecognitionInstance.continuous).toBe(false);
    expect(mockRecognitionInstance.interimResults).toBe(true);
    expect(mockRecognitionInstance.lang).toBe("en-US");
  });

  test("TC-05: releasing mic button calls recognition.stop()", () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);
    fireEvent.pointerUp(micBtn);

    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });

  test("TC-06: while listening, button has aria-label 'Listening...'", () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    expect(micBtn).toHaveAttribute("aria-label", "Listening...");
  });

  test("TC-07: interim results display live transcript", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    // Simulate an interim result
    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: false,
            0: { transcript: "pm one create" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    expect(screen.getByText("pm one create")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-08 to TC-11: Message dispatch
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Message dispatch", () => {
  test("TC-08: valid command dispatches sendMessage with correct agent and message", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    // Simulate final result
    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "pm one create a login page" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    // Recognition ends (triggers processing useEffect)
    await act(async () => {
      mockRecognitionInstance.onend();
    });

    // Check that sendMessage API was called
    const api = require("../src/services/api");
    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "pm-1",
          message: "create a login page",
        })
      );
    });
  });

  test("TC-09: 'team' broadcasts via single sendMessage with to='all'", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "team please do a status update" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    const api = require("../src/services/api");
    await waitFor(() => {
      // Single API call with to="all" for server-side broadcast
      expect(api.sendMessage).toHaveBeenCalledTimes(1);
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "all",
          message: "do a status update",
        })
      );
    });

    // Confirmation text should indicate broadcast
    expect(screen.getByText("Sent to all agents")).toBeInTheDocument();
  });

  test("TC-10: sent confirmation message appears after successful send", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "developer one fix the bug" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByText("Sent to developer-1")).toBeInTheDocument();
    });
  });

  test("TC-11: sent confirmation clears after timeout", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "qa one run the tests" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByText("Sent to qa-1")).toBeInTheDocument();
    });

    // Advance timer past the 2-second confirmation timeout
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.queryByText("Sent to qa-1")).not.toBeInTheDocument();
    expect(screen.getByText("Hold mic to speak a command")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-12 to TC-15: Error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Error handling", () => {
  test("TC-12: mic button renders and no unsupported error shown when SpeechRecognition is available", () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");
    expect(micBtn).toBeInTheDocument();
    expect(screen.queryByText("Voice commands not supported in this browser")).not.toBeInTheDocument();
  });

  test("TC-13: no agent match shows identification error", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "hello world do something" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByText(/Couldn't identify agent/)).toBeInTheDocument();
    });
  });

  test("TC-14: empty message after agent name shows error", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "pm one" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByText("Please include a message after the agent name")).toBeInTheDocument();
    });
  });

  test("TC-15: recognition error 'not-allowed' shows mic denied message", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "not-allowed" });
    });

    await waitFor(() => {
      expect(screen.getByText("Microphone access denied")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-16 to TC-18: Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-096 QA: Edge cases", () => {
  test("TC-16: pointer leave while listening triggers stop", () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);
    expect(mockRecognitionInstance.start).toHaveBeenCalled();

    // Simulate pointer leaving the button while still pressed
    fireEvent.pointerLeave(micBtn);

    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });

  test("TC-17: CheckCircle icon shown during sent confirmation", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onresult({
        results: [
          {
            isFinal: true,
            0: { transcript: "devops one check the pipeline" },
            length: 1,
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByText("Sent to devops-1")).toBeInTheDocument();
    });

    // CheckCircleIcon should be rendered (identified by its data-testid)
    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
  });

  test("TC-18: 'no-speech' recognition error displays correctly", async () => {
    renderStreamView();
    const micBtn = screen.getByTestId("mic-button");

    fireEvent.pointerDown(micBtn);

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "no-speech" });
    });

    await waitFor(() => {
      expect(screen.getByText("No speech detected, try again")).toBeInTheDocument();
    });
  });
});
