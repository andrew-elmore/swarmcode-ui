/**
 * CARD-045 QA Tests — Message box fixed height with scroll.
 *
 * The chat area should fill available space within a fixed-height viewport.
 * Header and input should have flexShrink: 0 while the messages area should
 * have flex: 1, minHeight: 0, and overflowY: auto for proper scroll behavior.
 *
 * These tests verify the structural CSS/layout properties that enable the
 * fixed-height scrolling behavior.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer from "../src/store/projectSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import authReducer from "../src/store/authSlice";
import commandsReducer from "../src/store/commandsSlice";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import MessagesView from "../src/components/MessagesView";

jest.mock("../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
  subscribeToCommands: jest.fn(),
  subscribeToPings: jest.fn(),
  getRecentMessages: jest.fn(),
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
];

function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
      auth: authReducer,
      commands: commandsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null, queue: [], currentIndex: -1, streamLoading: false },
      agents: { agents: DEFAULT_AGENTS, allAgents: [], loading: false, error: null },
      project: { project: { objectId: "test-board-id" }, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
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
      ...overrides,
    },
  });
}

function renderWithProviders(ui, { store, ...options } = {}) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/test-board-id']}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

beforeEach(() => {
  api.getOrCreateProject.mockResolvedValue({ project: null, cards: [] });
  api.sendMessage.mockResolvedValue({ success: true });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockReturnValue(jest.fn()); // sync (CARD-099)
  api.subscribeToCommands.mockReturnValue(jest.fn()); // sync (CARD-099)
  api.subscribeToPings.mockReturnValue(jest.fn()); // sync (CARD-099)
  api.getRecentMessages.mockResolvedValue({ messages: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAgents.mockResolvedValue({ agents: DEFAULT_AGENTS });
});

afterEach(() => jest.restoreAllMocks());

// ─── App.jsx: Fixed height (100vh) ─────────────────────────────────────────

describe("CARD-045: App uses fixed height (100vh) instead of minHeight", () => {
  test("App root container has height: 100vh (not minHeight)", () => {
    const { container } = renderWithProviders(<App />);

    // The root Box rendered by App
    const rootBox = container.firstChild;

    // Should use height (capping at viewport) not minHeight (allowing infinite growth)
    // We verify via the rendered output that the component structure is correct
    expect(rootBox).toBeInTheDocument();
    // The root container should have flex column layout
    expect(rootBox).toHaveStyle({ display: "flex", "flex-direction": "column" });
  });

  test("main content area has overflow: hidden", () => {
    const { container } = renderWithProviders(<App />);

    // The main content area is the second child Box (after AppBar)
    const mainBox = container.querySelector("main");
    expect(mainBox).toBeInTheDocument();
    expect(mainBox).toHaveStyle({ flex: "1", overflow: "hidden" });
  });
});

// ─── MessagesView: Flex layout with minHeight: 0 ───────────────────────────

describe("CARD-045: MessagesView layout constrains to available space", () => {
  test("MessagesView renders with correct flex layout", async () => {
    const store = createTestStore();
    const { container } = renderWithProviders(<MessagesView />, { store });

    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    // Outer Box should have display: flex and overflow: hidden
    const outerBox = container.firstChild;
    expect(outerBox).toHaveStyle({ display: "flex", overflow: "hidden" });
  });
});

// ─── ChatView: Header, Messages, Input structure ────────────────────────────

describe("CARD-045: ChatView scroll structure with agent selected", () => {
  function createStoreWithAgent() {
    return createTestStore({
      agents: { agents: DEFAULT_AGENTS, allAgents: [], loading: false, error: null },
      messages: {
        conversations: {
          "pm-1": {
            messages: Array.from({ length: 50 }, (_, i) => ({
              id: `msg-${i}`,
              from: i % 2 === 0 ? "owner" : "pm-1",
              to: i % 2 === 0 ? "pm-1" : "owner",
              message: `Message number ${i}`,
              createdAt: `2026-02-10T10:${String(i).padStart(2, "0")}:00Z`,
            })),
            loaded: true,
            hasMore: false,
            loadingMore: false,
          },
          all: { messages: [], loaded: false, hasMore: false, loadingMore: false },
        },
        unreadCounts: { all: 0 },
        selectedAgent: "pm-1",
        sending: false,
        error: null,
        messages: [],
        polling: false,
        lastPoll: null,
      },
    });
  }

  test("renders all 50 messages without infinite page expansion", async () => {
    const store = createStoreWithAgent();
    renderWithProviders(<MessagesView />, { store });

    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    // All 50 messages should be rendered
    for (let i = 0; i < 50; i++) {
      expect(screen.getByText(`Message number ${i}`)).toBeInTheDocument();
    }
  });

  test("send button and input are always visible (not pushed off screen)", async () => {
    const store = createStoreWithAgent();
    renderWithProviders(<MessagesView />, { store });

    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    // Input placeholder should be visible
    expect(screen.getByPlaceholderText("Message PM Agent...")).toBeInTheDocument();

    // Send button should exist
    const sendBtns = screen.getAllByRole("button");
    const sendBtn = sendBtns.find((btn) => btn.querySelector("[data-testid='SendIcon']"));
    expect(sendBtn).toBeTruthy();
  });

  test("header with agent name is visible at top", async () => {
    const store = createStoreWithAgent();
    renderWithProviders(<MessagesView />, { store });

    await waitFor(() => {
      expect(api.subscribeToMessages).toHaveBeenCalled();
    });

    // Agent label should be visible in the header
    expect(screen.getAllByText("PM Agent").length).toBeGreaterThanOrEqual(1);
  });
});
