/**
 * CARD-105 QA: Remote Agent Command System — Commands tab integration tests.
 *
 * Tests the CommandsView component: action buttons, command history list,
 * ping status with green/red status light, LiveQuery updates, and error handling.
 *
 * Author: qa-1
 * Date: 2026-02-12
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import CommandsView from "../src/components/CommandsView";
import commandsReducer, { updateCommand, setPing } from "../src/store/commandsSlice";
import ttsReducer from "../src/store/ttsSlice";
import agentsReducer from "../src/store/agentsSlice";
import messagesReducer from "../src/store/messagesSlice";
import boardReducer from "../src/store/boardSlice";
import projectsReducer from "../src/store/projectsSlice";

const api = require("../src/services/api");

// ─── Mock API ────────────────────────────────────────────────────────────────

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
  // Command/Ping API functions
  createCommand: jest.fn().mockResolvedValue({
    objectId: "cmd-new",
    action: "stop_all",
    status: "requested",
    createdAt: new Date().toISOString(),
  }),
  listRecentCommands: jest.fn().mockResolvedValue({ commands: [] }),
  updateCommandStatus: jest.fn(),
  recordPing: jest.fn(),
  getLatestPing: jest.fn().mockResolvedValue({ ping: null }),
  getRequestedCommands: jest.fn(),
  subscribeToCommands: jest.fn().mockResolvedValue(jest.fn()),
  subscribeToPings: jest.fn().mockResolvedValue(jest.fn()),
}));

// ─── speechSynthesis mock (needed for store with ttsSlice) ───────────────────

window.speechSynthesis = {
  cancel: jest.fn(),
  speak: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  paused: false,
  pause: jest.fn(),
  resume: jest.fn(),
};

// ─── Theme & store helpers ───────────────────────────────────────────────────

const theme = createTheme();

const DEFAULT_COMMANDS_STATE = {
  commands: [],
  latestPing: null,
  loading: false,
  sending: false,
  error: null,
};

const DEFAULT_BOARD_STATE = {
  board: { projectHash: "test-hash-123" },
  cards: [],
  sprints: [],
  sprintFilter: null,
  selectedCard: null,
  loading: false,
  error: null,
  lastPoll: null,
};

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      commands: commandsReducer,
      tts: ttsReducer,
      agents: agentsReducer,
      messages: messagesReducer,
      board: boardReducer,
      projects: projectsReducer,
    },
    preloadedState: {
      commands: { ...DEFAULT_COMMANDS_STATE, ...(overrides.commands || {}) },
      tts: overrides.tts || {
        enabled: false, volume: 1.0, rate: 1.0, voice: "", error: null, queue: [], currentIndex: -1,
      },
      agents: overrides.agents || { agents: [], loading: false, error: null },
      board: overrides.board || DEFAULT_BOARD_STATE,
      messages: overrides.messages || {
        conversations: { all: { messages: [], loaded: false, hasMore: false, loadingMore: false } },
        unreadCounts: { all: 0 },
        selectedAgent: null, sending: false, error: null,
        messages: [], polling: false, lastPoll: null, mobileDrawerOpen: false,
      },
      projects: overrides.projects || {
        projects: [], activeProject: null, loading: false, error: null,
      },
    },
  });
}

/**
 * Render CommandsView and wait for initial thunks to settle.
 * Configures API mocks to return the specified commands/ping data
 * so that mount-time thunks produce the expected state.
 */
async function renderCommandsView(overrides = {}) {
  // Configure API mocks so mount-time thunks produce the right state
  const commandsOverride = overrides.commands || {};
  if (commandsOverride.commands) {
    api.listRecentCommands.mockResolvedValue({ commands: commandsOverride.commands });
  } else {
    api.listRecentCommands.mockResolvedValue({ commands: [] });
  }
  if (commandsOverride.latestPing !== undefined) {
    api.getLatestPing.mockResolvedValue({ ping: commandsOverride.latestPing });
  } else {
    api.getLatestPing.mockResolvedValue({ ping: null });
  }

  const store = createTestStore(overrides);
  let result;
  await act(async () => {
    result = render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CommandsView />
        </ThemeProvider>
      </Provider>
    );
  });
  return { ...result, store };
}

// ─── Setup & teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations
  api.listRecentCommands.mockResolvedValue({ commands: [] });
  api.getLatestPing.mockResolvedValue({ ping: null });
  api.createCommand.mockResolvedValue({
    objectId: "cmd-new",
    action: "stop_all",
    status: "requested",
    createdAt: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-01 to TC-03: Component rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Component rendering", () => {
  test("TC-01: CommandsView renders heading 'Remote Agent Control'", async () => {
    await renderCommandsView();
    expect(screen.getByText("Remote Agent Control")).toBeInTheDocument();
  });

  test("TC-02: Shows all 3 action buttons", async () => {
    await renderCommandsView();
    expect(screen.getByRole("button", { name: /stop all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^start all$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument();
  });

  test("TC-03: Shows 'Recent Commands' section heading", async () => {
    await renderCommandsView();
    expect(screen.getByText(/recent commands/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-04 to TC-07: Action buttons
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Action buttons", () => {
  test("TC-04: 'Stop All' button calls createCommand with action='stop_all'", async () => {
    await renderCommandsView();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop all/i }));
    });

    await waitFor(() => {
      expect(api.createCommand).toHaveBeenCalledWith("test-hash-123", "stop_all");
    });
  });

  test("TC-05: 'Start All' button calls createCommand with action='start_all'", async () => {
    await renderCommandsView();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^start all$/i }));
    });

    await waitFor(() => {
      expect(api.createCommand).toHaveBeenCalledWith("test-hash-123", "start_all");
    });
  });

  test("TC-06: 'Restart' button calls createCommand with action='restart_all'", async () => {
    await renderCommandsView();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /restart/i }));
    });

    await waitFor(() => {
      expect(api.createCommand).toHaveBeenCalledWith("test-hash-123", "restart_all");
    });
  });

  test("TC-07: Buttons disabled while command is being sent", async () => {
    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, sending: true } });

    const stopBtn = screen.getByRole("button", { name: /stop all/i });
    const startBtn = screen.getByRole("button", { name: /^start all$/i });
    const restartBtn = screen.getByRole("button", { name: /restart/i });

    expect(stopBtn).toBeDisabled();
    expect(startBtn).toBeDisabled();
    expect(restartBtn).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-08 to TC-12: Command history list
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Command history list", () => {
  test("TC-08: Empty state when no commands", async () => {
    await renderCommandsView();
    expect(screen.getByText(/no commands/i)).toBeInTheDocument();
  });

  test("TC-09: Shows up to 5 recent commands", async () => {
    const commands = Array.from({ length: 5 }, (_, i) => ({
      objectId: `cmd-${i}`,
      action: i % 2 === 0 ? "stop_all" : "start_all",
      status: "fulfilled",
      error: null,
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
      fulfilledAt: new Date(Date.now() - i * 60000 + 5000).toISOString(),
    }));

    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, commands } });

    // All 5 commands should show fulfilled status chips
    const chips = screen.getAllByText(/fulfilled/i);
    expect(chips).toHaveLength(5);
  });

  test("TC-10: Each command shows action label and status", async () => {
    const commands = [
      {
        objectId: "cmd-1",
        action: "restart_all",
        status: "fulfilled",
        error: null,
        createdAt: new Date().toISOString(),
        fulfilledAt: new Date().toISOString(),
      },
    ];

    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, commands } });

    // ACTION_LABELS maps restart_all -> "Restart All" (button + list item)
    const restartTexts = screen.getAllByText("Restart All");
    expect(restartTexts.length).toBeGreaterThanOrEqual(2); // button + command list item
    expect(screen.getByText(/fulfilled/i)).toBeInTheDocument();
  });

  test("TC-11: 'fulfilled' status displayed for successful commands", async () => {
    const commands = [
      {
        objectId: "cmd-1",
        action: "stop_all",
        status: "fulfilled",
        error: null,
        createdAt: new Date().toISOString(),
        fulfilledAt: new Date().toISOString(),
      },
    ];

    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, commands } });
    expect(screen.getByText(/fulfilled/i)).toBeInTheDocument();
  });

  test("TC-12: 'error' status with error message for failed commands", async () => {
    const commands = [
      {
        objectId: "cmd-1",
        action: "start_all",
        status: "error",
        error: "Agent process crashed",
        createdAt: new Date().toISOString(),
        fulfilledAt: new Date().toISOString(),
      },
    ];

    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, commands } });
    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent process crashed/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-13 to TC-16: Ping status display
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Ping status display", () => {
  test("TC-13: Shows relative time since last ping", async () => {
    const latestPing = {
      objectId: "ping-1",
      updatedAt: new Date(Date.now() - 15000).toISOString(), // 15 seconds ago
      agentStatus: { "pm-1": "running" },
    };

    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing },
    });

    // Should display some relative time text (e.g. "15s ago")
    expect(screen.getByText(/\d+s ago/)).toBeInTheDocument();
  });

  test("TC-14: Shows 'Online' when ping < 60 seconds ago", async () => {
    const latestPing = {
      objectId: "ping-1",
      updatedAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      agentStatus: {},
    };

    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing },
    });

    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  test("TC-15: Shows 'Offline' when ping > 60 seconds ago", async () => {
    const latestPing = {
      objectId: "ping-1",
      updatedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      agentStatus: {},
    };

    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing },
    });

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  test("TC-16: Shows offline state when no ping exists", async () => {
    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing: null },
    });

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-17 to TC-19: LiveQuery / Redux state updates
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Redux state updates", () => {
  test("TC-17: updateCommand changes command status from 'requested' to 'fulfilled'", () => {

    const store = createTestStore({
      commands: {
        ...DEFAULT_COMMANDS_STATE,
        commands: [{
          objectId: "cmd-1",
          action: "stop_all",
          status: "requested",
          error: null,
          createdAt: new Date().toISOString(),
          fulfilledAt: null,
        }],
      },
    });

    store.dispatch(updateCommand({
      objectId: "cmd-1",
      action: "stop_all",
      status: "fulfilled",
      error: null,
      createdAt: new Date().toISOString(),
      fulfilledAt: new Date().toISOString(),
    }));

    const cmd = store.getState().commands.commands.find(c => c.objectId === "cmd-1");
    expect(cmd.status).toBe("fulfilled");
  });

  test("TC-18: updateCommand changes command status from 'requested' to 'error'", () => {

    const store = createTestStore({
      commands: {
        ...DEFAULT_COMMANDS_STATE,
        commands: [{
          objectId: "cmd-2",
          action: "restart_all",
          status: "requested",
          error: null,
          createdAt: new Date().toISOString(),
          fulfilledAt: null,
        }],
      },
    });

    store.dispatch(updateCommand({
      objectId: "cmd-2",
      action: "restart_all",
      status: "error",
      error: "Process killed",
      createdAt: new Date().toISOString(),
      fulfilledAt: new Date().toISOString(),
    }));

    const cmd = store.getState().commands.commands.find(c => c.objectId === "cmd-2");
    expect(cmd.status).toBe("error");
    expect(cmd.error).toBe("Process killed");
  });

  test("TC-19: setPing updates the latestPing in state", () => {

    const store = createTestStore();

    expect(store.getState().commands.latestPing).toBeNull();

    const now = new Date().toISOString();
    store.dispatch(setPing({
      objectId: "ping-1",
      projectHash: "test-hash-123",
      agentStatus: { "pm-1": "running", "developer-1": "stopped" },
      updatedAt: now,
    }));

    const ping = store.getState().commands.latestPing;
    expect(ping).not.toBeNull();
    expect(ping.agentStatus["pm-1"]).toBe("running");
    expect(ping.agentStatus["developer-1"]).toBe("stopped");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-20 to TC-21: Agent status display
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Agent status display", () => {
  test("TC-20: Shows agent statuses from ping data", async () => {
    const latestPing = {
      objectId: "ping-1",
      updatedAt: new Date(Date.now() - 5000).toISOString(),
      agentStatus: {
        "pm-1": "running",
        "developer-1": "stopped",
        "senior-dev-1": "running",
      },
    };

    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing },
    });

    expect(screen.getByText(/pm-1/)).toBeInTheDocument();
    expect(screen.getByText(/developer-1/)).toBeInTheDocument();
  });

  test("TC-21: Shows no agent status when no ping exists", async () => {
    await renderCommandsView({
      commands: { ...DEFAULT_COMMANDS_STATE, latestPing: null },
    });

    expect(screen.queryByText(/pm-1/)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-22 to TC-24: Error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("CARD-105 QA: Error handling", () => {
  test("TC-22: Error alert shown when createCommand thunk rejects", async () => {
    // Render the view normally first
    await renderCommandsView();

    // Make createCommand reject on the next call
    api.createCommand.mockRejectedValueOnce(new Error("Command dispatch failed"));

    // Click a button to trigger a createCommand thunk
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop all/i }));
    });

    // Wait for the rejection to propagate to the store
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/command dispatch failed/i)).toBeInTheDocument();
  });

  test("TC-23: 'requested' status displayed for pending commands", async () => {
    const commands = [{
      objectId: "cmd-1",
      action: "stop_all",
      status: "requested",
      error: null,
      createdAt: new Date().toISOString(),
      fulfilledAt: null,
    }];

    await renderCommandsView({ commands: { ...DEFAULT_COMMANDS_STATE, commands } });
    expect(screen.getByText(/requested/i)).toBeInTheDocument();
  });

  test("TC-24: updateCommand adds new command if objectId not found (LiveQuery create)", () => {

    const store = createTestStore({
      commands: { ...DEFAULT_COMMANDS_STATE, commands: [] },
    });

    store.dispatch(updateCommand({
      objectId: "cmd-new",
      action: "start_all",
      status: "requested",
      error: null,
      createdAt: new Date().toISOString(),
      fulfilledAt: null,
    }));

    expect(store.getState().commands.commands).toHaveLength(1);
    expect(store.getState().commands.commands[0].action).toBe("start_all");
  });
});
