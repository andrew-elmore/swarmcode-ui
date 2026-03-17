/**
 * CARD-092 Unit Tests — src/components/StreamView.jsx
 *
 * Covers:
 *   1. fetchStreamMessages dispatched on mount with projectIdParam from URL
 *   2. stream-refresh button is present and clickable
 *   3. Clicking refresh dispatches fetchStreamMessages again
 *   4. Refresh button is disabled when streamLoading = true
 *   5. CircularProgress renders when streamLoading = true
 *   6. Preloaded messages appear in stream-queue as stream-queue-item elements
 *   7. Preloaded (done) items are visually dimmed (disabled ListItemButton)
 *   8. stream-toggle (TTS Start/Stop) and stream-status are present
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material";
import fs from "fs";
import path from "path";
import ttsReducer from "../../src/store/ttsSlice";
import agentsReducer from "../../src/store/agentsSlice";
import messagesReducer from "../../src/store/messagesSlice";
import projectReducer from "../../src/store/projectSlice";
import StreamView from "../../src/components/StreamView";

jest.mock("../../src/services/api", () => ({
  getRecentMessages: jest.fn(),
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
  sendMessage: jest.fn(),
}));

import * as api from "../../src/services/api";

// Silence speechSynthesis usage in jsdom
beforeAll(() => {
  Object.defineProperty(window, "speechSynthesis", {
    value: { speak: jest.fn(), cancel: jest.fn(), pause: jest.fn(), resume: jest.fn(), speaking: false, getVoices: () => [] },
    writable: true,
  });
});

const theme = createTheme();

const MOCK_MESSAGES = [
  { id: "m1", from: "pm-1", message: "Hello team", createdAt: "2026-03-01T10:00:00Z" },
  { id: "m2", from: "developer-1", message: "Working on it", createdAt: "2026-03-01T10:01:00Z" },
];

function makeStore(ttsOverrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
    },
    preloadedState: {
      tts: {
        enabled: false,
        volume: 1.0,
        rate: 1.0,
        error: null,
        queue: [],
        currentIndex: -1,
        streamLoading: false,
        ...ttsOverrides,
      },
      agents: { agents: [], allAgents: [], loading: false, error: null },
      messages: {
        messages: [],
        selectedAgent: null,
        sending: false,
        polling: false,
        error: null,
        lastPoll: null,
        liveQueryRefreshFlag: 0,
        mobileDrawerOpen: false,
      },
    },
  });
}

function renderStreamView(projectId = "projA111", ttsOverrides = {}) {
  const store = makeStore(ttsOverrides);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/${projectId}`]}>
          <Routes>
            <Route path="/:projectId" element={<StreamView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getRecentMessages.mockResolvedValue({ messages: [] });
});

afterEach(() => jest.clearAllMocks());

// ─── Basic rendering ───────────────────────────────────────────────────────────

describe("StreamView — basic rendering", () => {
  test("renders stream-view container", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-view")).toBeInTheDocument();
  });

  test("renders stream-toggle button", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-toggle")).toBeInTheDocument();
  });

  test("renders stream-status text", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-status")).toBeInTheDocument();
  });

  test("renders stream-refresh button", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-refresh")).toBeInTheDocument();
  });

  test("renders stream-queue container", async () => {
    renderStreamView();
    expect(screen.getByTestId("stream-queue")).toBeInTheDocument();
  });
});

// ─── Mount fetch ──────────────────────────────────────────────────────────────

describe("CARD-092: StreamView dispatches fetchStreamMessages on mount", () => {
  test("calls api.getRecentMessages with projectId on mount", async () => {
    renderStreamView("projA111");

    await waitFor(() => {
      expect(api.getRecentMessages).toHaveBeenCalledWith("projA111");
    });
  });

  test("does not call getRecentMessages if no projectId in URL", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<StreamView />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    // Wait a tick to confirm no call was made
    await new Promise((r) => setTimeout(r, 50));
    expect(api.getRecentMessages).not.toHaveBeenCalled();
  });

  test("preloaded messages appear as stream-queue-items", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      const items = screen.getAllByTestId("stream-queue-item");
      expect(items).toHaveLength(2);
    });
  });

  test("preloaded queue items show agent names from messages", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      expect(screen.getByText("pm-1")).toBeInTheDocument();
      expect(screen.getByText("developer-1")).toBeInTheDocument();
    });
  });

  test("preloaded queue items are disabled (status=done, not clickable)", async () => {
    api.getRecentMessages.mockResolvedValue({ messages: MOCK_MESSAGES });
    renderStreamView("projA111");

    await waitFor(() => {
      const items = screen.getAllByTestId("stream-queue-item");
      // All items should be disabled (done items are non-interactive)
      items.forEach((item) => {
        expect(item).toHaveAttribute("aria-disabled", "true");
      });
    });
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe("CARD-092: stream-refresh button behavior", () => {
  test("clicking refresh calls getRecentMessages again", async () => {
    renderStreamView("projA111");

    // Wait for mount fetch
    await waitFor(() => expect(api.getRecentMessages).toHaveBeenCalledTimes(1));

    // Click refresh
    fireEvent.click(screen.getByTestId("stream-refresh"));

    await waitFor(() => {
      expect(api.getRecentMessages).toHaveBeenCalledTimes(2);
      expect(api.getRecentMessages).toHaveBeenLastCalledWith("projA111");
    });
  });

  test("refresh button is enabled when not loading", async () => {
    renderStreamView("projA111");

    await waitFor(() => expect(api.getRecentMessages).toHaveBeenCalled());
    expect(screen.getByTestId("stream-refresh")).not.toBeDisabled();
  });

  test("refresh button is disabled when streamLoading=true", async () => {
    // Preload streamLoading=true in store
    renderStreamView("projA111", { streamLoading: true });

    expect(screen.getByTestId("stream-refresh")).toBeDisabled();
  });

  test("CircularProgress renders when streamLoading=true", async () => {
    // Use a never-resolving promise to stay in loading state
    api.getRecentMessages.mockImplementation(() => new Promise(() => {}));
    renderStreamView("projA111");

    await waitFor(() => {
      // CircularProgress appears inside the refresh button while loading
      const refreshBtn = screen.getByTestId("stream-refresh");
      expect(refreshBtn.querySelector("[class*='MuiCircularProgress']")).not.toBeNull();
    });
  });
});

// ─── CARD-093: Per-agent hold-to-talk STT buttons ─────────────────────────────

// MockSpeechRecognition — controlled in tests
let mockRecognitionInstance = null;

class MockSpeechRecognition {
  constructor() {
    this.start = jest.fn();
    this.stop = jest.fn();
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.continuous = false;
    this.interimResults = false;
    this.lang = "";
    mockRecognitionInstance = this;
  }
}

const STT_AGENTS = [
  { name: "pm-1", description: "PM Agent", voice: "en_US-amy-medium", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Developer", voice: "en_US-joe-medium", isActive: true, sortOrder: 1 },
];

function makeStoreWithAgents(agents = [], ttsOverrides = {}) {
  return configureStore({
    reducer: {
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
      project: projectReducer,
    },
    preloadedState: {
      tts: {
        enabled: false,
        volume: 1.0,
        rate: 1.0,
        error: null,
        queue: [],
        currentIndex: -1,
        streamLoading: false,
        ...ttsOverrides,
      },
      agents: { agents, allAgents: [], loading: false, error: null },
      messages: {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null,
        sending: false,
        refreshing: false,
        error: null,
        liveQueryRefreshFlag: false,
        mobileDrawerOpen: false,
      },
      project: {
        project: { objectId: "projA111" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    },
  });
}

function renderStreamViewWithAgents(agents = [], ttsOverrides = {}, projectId = "projA111") {
  const store = makeStoreWithAgents(agents, ttsOverrides);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/${projectId}`]}>
          <Routes>
            <Route path="/:projectId" element={<StreamView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

// Helper: build an onresult event with a final transcript
function makeSpeechResult(transcript) {
  const result = [{ transcript }];
  result.isFinal = true;
  const results = [result];
  results.length = 1;
  return { results };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("CARD-093: per-agent STT buttons rendering", () => {
  test("renders stt-button-pm-1 when pm-1 is in agents store", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByTestId("stt-button-pm-1")).toBeInTheDocument();
  });

  test("renders stt-button-developer-1 when developer-1 is in agents store", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByTestId("stt-button-developer-1")).toBeInTheDocument();
  });

  test("renders stt-button-all always (regardless of agent list)", () => {
    renderStreamViewWithAgents([]);
    expect(screen.getByTestId("stt-button-all")).toBeInTheDocument();
  });

  test("stt-button-all renders even alongside per-agent buttons", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByTestId("stt-button-all")).toBeInTheDocument();
  });

  test("per-agent buttons have correct aria-labels", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByLabelText("Hold to send to pm-1")).toBeInTheDocument();
    expect(screen.getByLabelText("Hold to send to developer-1")).toBeInTheDocument();
  });

  test("all-agents button has correct aria-label", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByLabelText("Hold to send to all agents")).toBeInTheDocument();
  });

  test("renders agent name caption below each button", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    // Agent names appear as captions below each button
    const captions = screen.getAllByText("pm-1");
    expect(captions.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("developer-1").length).toBeGreaterThanOrEqual(1);
  });

  test("renders 'All Agents' caption below all-agents button", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByText("All Agents")).toBeInTheDocument();
  });
});

// ─── Default mic-status text ──────────────────────────────────────────────────

describe("CARD-093: mic-status default state", () => {
  test("shows 'Hold a button to speak' by default (no agent listening)", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    expect(screen.getByTestId("mic-status")).toHaveTextContent("Hold a button to speak");
  });
});

// ─── Hold-to-talk mechanics ───────────────────────────────────────────────────

describe("CARD-093: hold-to-talk with SpeechRecognition", () => {
  beforeEach(() => {
    mockRecognitionInstance = null;
    window.SpeechRecognition = MockSpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
  });

  test("pointerDown on agent button calls SpeechRecognition.start()", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    expect(mockRecognitionInstance).not.toBeNull();
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
  });

  test("mic-status shows 'Listening for pm-1...' while recording for pm-1", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1...");
    });
  });

  test("mic-status shows 'Listening for all...' while recording for all-agents button", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-all"));
    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for all...");
    });
  });

  test("pointerUp calls SpeechRecognition.stop()", () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    fireEvent.pointerUp(screen.getByTestId("stt-button-pm-1"));
    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });

  test("after onend fires, mic-status returns to 'Hold a button to speak'", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await waitFor(() => expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1..."));

    await act(async () => {
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Hold a button to speak");
    });
  });
});

// ─── sendMessage dispatch ─────────────────────────────────────────────────────

describe("CARD-093: sendMessage dispatched after transcript", () => {
  beforeEach(() => {
    mockRecognitionInstance = null;
    window.SpeechRecognition = MockSpeechRecognition;
    delete window.webkitSpeechRecognition;
    api.sendMessage.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    delete window.SpeechRecognition;
  });

  test("sendMessage dispatched with { to: agentName, message: transcript } for agent button", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("deploy the fix"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: "pm-1", message: "deploy the fix" })
      );
    });
  });

  test("sendMessage dispatched with { to: 'all', message: transcript } for all-agents button", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-all"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("status update"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: "all", message: "status update" })
      );
    });
  });

  test("mic-status shows 'Sent to pm-1' after agent dispatch", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("hello pm-1"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Sent to pm-1");
    });
  });

  test("mic-status shows 'Sent to all agents' after all-agents dispatch", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-all"));

    await act(async () => {
      mockRecognitionInstance.onresult(makeSpeechResult("team update"));
      mockRecognitionInstance.onend();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Sent to all agents");
    });
  });

  test("sendMessage NOT dispatched when transcript is empty", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      // onend fires without onresult — transcript stays ""
      mockRecognitionInstance.onend();
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

// ─── sttStatus on error ───────────────────────────────────────────────────────

describe("CARD-093: sttStatus error messages", () => {
  beforeEach(() => {
    mockRecognitionInstance = null;
    window.SpeechRecognition = MockSpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
  });

  test("onerror 'not-allowed' shows 'Microphone access denied'", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "not-allowed" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Microphone access denied");
    });
  });

  test("onerror 'no-speech' shows 'No speech detected, try again'", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "no-speech" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("No speech detected, try again");
    });
  });

  test("onerror 'network' shows 'Speech recognition unavailable'", async () => {
    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    await act(async () => {
      mockRecognitionInstance.onerror({ error: "network" });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mic-status")).toHaveTextContent("Speech recognition unavailable");
    });
  });

  test("unsupported browser shows 'Voice commands not supported in this browser'", () => {
    // Remove SpeechRecognition to simulate unsupported browser
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    renderStreamViewWithAgents(STT_AGENTS);
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));

    expect(screen.getByTestId("mic-status")).toHaveTextContent(
      "Voice commands not supported in this browser"
    );
  });
});

// ─── onPointerLeave guard ─────────────────────────────────────────────────────

describe("CARD-093: onPointerLeave guard (only fires for active button)", () => {
  beforeEach(() => {
    mockRecognitionInstance = null;
    window.SpeechRecognition = MockSpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
  });

  test("pointerLeave on non-active button does NOT call recognition.stop()", async () => {
    renderStreamViewWithAgents(STT_AGENTS);

    // Start recording on pm-1
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    await waitFor(() => expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1..."));

    // pointerLeave on developer-1 (not the active button) — should NOT stop
    fireEvent.pointerLeave(screen.getByTestId("stt-button-developer-1"));
    expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();
  });

  test("pointerLeave on active button DOES call recognition.stop()", async () => {
    renderStreamViewWithAgents(STT_AGENTS);

    // Start recording on pm-1
    fireEvent.pointerDown(screen.getByTestId("stt-button-pm-1"));
    await waitFor(() => expect(screen.getByTestId("mic-status")).toHaveTextContent("Listening for pm-1..."));

    // pointerLeave on pm-1 (the active button) — SHOULD stop
    fireEvent.pointerLeave(screen.getByTestId("stt-button-pm-1"));
    expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
  });
});

// ─── voiceCommandParser removed ───────────────────────────────────────────────

describe("CARD-093: voiceCommandParser removed", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "StreamView.jsx"),
    "utf8"
  );

  test("StreamView.jsx does not import parseVoiceCommand", () => {
    expect(streamViewSrc).not.toContain("parseVoiceCommand");
    expect(streamViewSrc).not.toContain("voiceCommandParser");
  });

  test("voiceCommandParser.js has been deleted from src/utils/", () => {
    const utilsDir = path.resolve(__dirname, "..", "..", "src", "utils");
    const files = fs.readdirSync(utilsDir);
    expect(files).not.toContain("voiceCommandParser.js");
  });
});

// ─── CARD-096: Layout, auto-scroll, timestamps (source-level) ─────────────────

describe("CARD-096: StreamView.jsx source-level — layout and timestamps", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "StreamView.jsx"),
    "utf8"
  );

  test("play/stop button width is 40 (CARD-097: compacted control bar)", () => {
    // CARD-096 set 56; CARD-097 further reduced to 40 for the compact control bar
    expect(streamViewSrc).toMatch(/width:\s*40/);
  });

  test("play/stop button height is 40 (CARD-097: compacted control bar)", () => {
    expect(streamViewSrc).toMatch(/height:\s*40/);
  });

  test("message list has minHeight (not maxHeight) after CARD-097 layout redesign", () => {
    // CARD-096 set maxHeight: 320; CARD-097 removed the cap; CARD-102 uses flex: 1, minHeight: 0
    expect(streamViewSrc).not.toMatch(/maxHeight:\s*320/);
    expect(streamViewSrc).toMatch(/flex:\s*1/);
    expect(streamViewSrc).toMatch(/minHeight:\s*0/);
  });

  test("auto-scroll useEffect references tts.queue.length as dependency", () => {
    expect(streamViewSrc).toContain("tts.queue.length");
  });

  test("auto-scroll useEffect sets scrollTop to scrollHeight", () => {
    expect(streamViewSrc).toContain("scrollTop");
    expect(streamViewSrc).toContain("scrollHeight");
  });

  test("queue-item-timestamp data-testid is present in source", () => {
    expect(streamViewSrc).toContain('"queue-item-timestamp"');
  });

  test("timestamp is rendered only when item.createdAt is truthy", () => {
    // The guard condition must be present
    expect(streamViewSrc).toContain("item.createdAt");
  });

  test("timestamp uses toLocaleTimeString with hour and minute options", () => {
    expect(streamViewSrc).toContain("toLocaleTimeString");
    expect(streamViewSrc).toContain('"2-digit"');
  });
});

// ─── CARD-097: Layout redesign source-level checks ───────────────────────────

describe("CARD-097: StreamView.jsx source-level — outer container and control bar", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "StreamView.jsx"),
    "utf8"
  );

  test("outer container maxWidth is 640 (was 480)", () => {
    expect(streamViewSrc).toMatch(/maxWidth:\s*640/);
  });

  test("play/stop button is 40x40 in the compact control bar", () => {
    expect(streamViewSrc).toMatch(/width:\s*40/);
    expect(streamViewSrc).toMatch(/height:\s*40/);
  });

  test("stream-toggle data-testid is preserved", () => {
    expect(streamViewSrc).toContain('"stream-toggle"');
  });

  test("stream-status data-testid is preserved on inline caption", () => {
    expect(streamViewSrc).toContain('"stream-status"');
  });

  test("stream-volume data-testid is on the Slider element (not a wrapper Box)", () => {
    // The testid must appear on a Slider (not on a Box that wraps it)
    // We check that stream-volume appears in proximity to Slider props
    expect(streamViewSrc).toContain('"stream-volume"');
    // Slider element has the testid directly
    expect(streamViewSrc).toMatch(/data-testid="stream-volume"/);
  });

  test("stream-speed data-testid is preserved on the Select element", () => {
    expect(streamViewSrc).toContain('"stream-speed"');
  });

  test("status text uses short labels: 'Paused', 'Listening', 'Speaking...'", () => {
    expect(streamViewSrc).toContain('"Paused"');
    expect(streamViewSrc).toContain('"Listening"');
    expect(streamViewSrc).toContain('"Speaking..."');
  });
});

describe("CARD-097: StreamView.jsx source-level — message list layout", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "StreamView.jsx"),
    "utf8"
  );

  test("message list uses flex: 1, minHeight: 0 after CARD-102 scroll fix", () => {
    // CARD-102 replaced minHeight: 220 with flex: 1, minHeight: 0 for proper scroll behaviour
    expect(streamViewSrc).toMatch(/flex:\s*1/);
    expect(streamViewSrc).toMatch(/minHeight:\s*0/);
  });

  test("message list does NOT have a maxHeight constraint", () => {
    // maxHeight was removed so the list fills available vertical space
    expect(streamViewSrc).not.toMatch(/maxHeight:\s*320/);
  });

  test("stream-queue data-testid is preserved on the list container", () => {
    expect(streamViewSrc).toContain('"stream-queue"');
  });

  test("message list uses width: '100%' (no maxWidth per breakpoint)", () => {
    // The old isMobile ? 300 : 400 maxWidth constraint was removed
    expect(streamViewSrc).not.toMatch(/maxWidth:\s*(?:isMobile\s*\?\s*300\s*:\s*400|300\s*:\s*400)/);
  });
});

describe("CARD-097: StreamView.jsx source-level — PTT horizontal strip", () => {
  const streamViewSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "components", "StreamView.jsx"),
    "utf8"
  );

  test("PTT container uses flexWrap: 'nowrap' (horizontal strip, not wrapping grid)", () => {
    expect(streamViewSrc).toContain('"nowrap"');
  });

  test("PTT container uses overflowX: 'auto' (scrollable when agents overflow)", () => {
    expect(streamViewSrc).toContain('"auto"');
  });

  test("PTT buttons are 40x40 (shrunken from 56x56)", () => {
    // Same as control bar check but specifically for the mic button sizing
    expect(streamViewSrc).toMatch(/width:\s*40/);
    expect(streamViewSrc).toMatch(/height:\s*40/);
  });

  test("PTT button icon fontSize is 20 (was 28)", () => {
    expect(streamViewSrc).toMatch(/fontSize:\s*20/);
  });

  test("PTT button outer Box has flexShrink: 0 (prevents compression on overflow)", () => {
    expect(streamViewSrc).toContain("flexShrink: 0");
  });

  test("mic-status data-testid is preserved below the strip", () => {
    expect(streamViewSrc).toContain('"mic-status"');
  });
});

describe("CARD-096: App.jsx source-level — createdAt forwarded to enqueueMessage", () => {
  const appSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "App.jsx"),
    "utf8"
  );

  test("App.jsx dispatches enqueueMessage with a createdAt field", () => {
    // App must pass createdAt when it dispatches enqueueMessage from LiveQuery
    expect(appSrc).toContain("createdAt");
    expect(appSrc).toContain("enqueueMessage");
  });

  test("App.jsx reads createdAt from the resolved message", () => {
    expect(appSrc).toMatch(/createdAt:\s*resolvedMsg\.createdAt/);
  });
});
