/**
 * Tests for UI components — render tests using React Testing Library.
 * API calls are mocked to prevent real network requests.
 */

import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import App from "../src/App";
import BoardView from "../src/components/BoardView";
import MessagesView from "../src/components/MessagesView";
import CreateCardDialog from "../src/components/CreateCardDialog";
import CardDetailDialog from "../src/components/CardDetailDialog";
import ProjectSelector from "../src/components/ProjectSelector";

// Mock the entire API module to prevent real fetch calls
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
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
    },
    preloadedState,
  });
}

function renderWithProviders(ui, { store, ...options } = {}) {
  const testStore = store || createTestStore();
  function Wrapper({ children }) {
    return (
      <Provider store={testStore}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </Provider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

beforeEach(() => {
  // Default mock implementations — resolve to safe defaults
  api.getOrCreateBoard.mockResolvedValue({ board: null, cards: [] });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.pollBoard.mockResolvedValue({ changed: false, cards: [] });
  api.sendMessage.mockResolvedValue({ success: true });
  api.pollMessages.mockResolvedValue({ messages: [] });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
});

afterEach(() => jest.restoreAllMocks());

// ─── App Component ───────────────────────────────────────────────────────────

describe("App", () => {
  test("renders SwarmCode title in app bar", async () => {
    renderWithProviders(<App />);
    expect(screen.getByText("SwarmCode")).toBeInTheDocument();
  });

  test("renders Board and Messages tabs", () => {
    renderWithProviders(<App />);
    expect(screen.getByRole("tab", { name: /board/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /messages/i })).toBeInTheDocument();
  });

  test("shows BoardView by default (no project selected = prompt)", () => {
    renderWithProviders(<App />);
    // No active project → BoardView shows "Select a project" prompt
    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });

  test("shows ProjectSelector in the app bar", () => {
    renderWithProviders(<App />);
    // ProjectSelector renders an Add button with title "Add project"
    expect(screen.getByTitle("Add project")).toBeInTheDocument();
  });

  test("switches to MessagesView when Messages tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole("tab", { name: /messages/i }));

    // MessagesView renders "Inbox" heading and "Send Message" section
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Send Message")).toBeInTheDocument();
  });

  test("switches back to BoardView when Board tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole("tab", { name: /messages/i }));
    await user.click(screen.getByRole("tab", { name: /board/i }));

    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });
});

// ─── BoardView Component ─────────────────────────────────────────────────────

describe("BoardView", () => {
  test("shows 'Select a project' when no active project", () => {
    renderWithProviders(<BoardView />);
    expect(screen.getByText(/select a project/i)).toBeInTheDocument();
  });

  test("shows loading spinner when loading", () => {
    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: true, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("shows error alert when error exists", async () => {
    api.getOrCreateBoard.mockRejectedValue(new Error("Network error"));

    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("renders Board heading and New Card button when board loaded", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 1 };
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: [] });

    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });
    expect(screen.getByText("New Card")).toBeInTheDocument();
  });

  test("renders all 6 Kanban columns", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 1 };
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: [] });

    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  test("renders cards in correct columns", async () => {
    const mockBoard = { objectId: "b1", projectHash: "abc", nextId: 3 };
    const mockCards = [
      { cardId: "CARD-001", title: "Fix bug", status: "todo", priority: "high" },
      { cardId: "CARD-002", title: "Add feature", status: "in_progress", priority: "medium" },
    ];
    api.getOrCreateBoard.mockResolvedValue({ board: mockBoard, cards: mockCards });

    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Fix bug")).toBeInTheDocument();
    });
    expect(screen.getByText("Add feature")).toBeInTheDocument();
    expect(screen.getByText("CARD-001")).toBeInTheDocument();
    expect(screen.getByText("CARD-002")).toBeInTheDocument();
  });

  test("fetches board when active project is set", async () => {
    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/my/project", name: "project" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(api.getOrCreateBoard).toHaveBeenCalledWith("/my/project");
    });
  });
});

// ─── MessagesView Component ──────────────────────────────────────────────────

describe("MessagesView", () => {
  test("renders Inbox heading", () => {
    renderWithProviders(<MessagesView />);
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  test("renders Send Message form", () => {
    renderWithProviders(<MessagesView />);
    expect(screen.getByText("Send Message")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  test("shows 'No messages' when inbox is empty", () => {
    renderWithProviders(<MessagesView />);
    expect(screen.getByText("No messages.")).toBeInTheDocument();
  });

  test("renders Refresh button", () => {
    renderWithProviders(<MessagesView />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  test("Send button is disabled when fields are empty", () => {
    renderWithProviders(<MessagesView />);
    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  test("renders messages when they exist in store", () => {
    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        messages: [
          { from: "pm-1", to: "qa-1", subject: "Test Subject", message: "Test body", createdAt: "2026-01-01T00:00:00Z" },
        ],
        sending: false,
        polling: false,
        error: null,
        lastPoll: "2026-01-01",
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    expect(screen.getByText("Test Subject")).toBeInTheDocument();
  });

  test("shows error alert when error exists", () => {
    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: {
        messages: [],
        sending: false,
        polling: false,
        error: "Network timeout",
        lastPoll: null,
      },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    renderWithProviders(<MessagesView />, { store });
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  test("polls messages on mount", async () => {
    renderWithProviders(<MessagesView />);
    await waitFor(() => {
      expect(api.pollMessages).toHaveBeenCalled();
    });
  });
});

// ─── CreateCardDialog Component ──────────────────────────────────────────────

describe("CreateCardDialog", () => {
  test("renders dialog title and fields when open", () => {
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="abc" />
    );
    expect(screen.getByText("Create Card")).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  test("does not render when open=false", () => {
    renderWithProviders(
      <CreateCardDialog open={false} onClose={jest.fn()} projectHash="abc" />
    );
    expect(screen.queryByText("Create Card")).not.toBeInTheDocument();
  });

  test("Create button is disabled when title is empty", () => {
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="abc" />
    );
    const createBtn = screen.getByRole("button", { name: /create/i });
    expect(createBtn).toBeDisabled();
  });

  test("Create button enables when title is entered", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="abc" />
    );

    await user.type(screen.getByLabelText(/title/i), "New task");

    const createBtn = screen.getByRole("button", { name: /create/i });
    expect(createBtn).toBeEnabled();
  });

  test("Cancel button is present", () => {
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="abc" />
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  test("dispatches createCard on submit", async () => {
    const user = userEvent.setup();
    api.createCard.mockResolvedValue({
      card: { cardId: "CARD-001", title: "New task", status: "backlog", priority: "medium" },
    });
    const onClose = jest.fn();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={onClose} projectHash="abc" />
    );

    await user.type(screen.getByLabelText(/title/i), "New task");
    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalled();
    });
  });
});

// ─── CardDetailDialog Component ──────────────────────────────────────────────

describe("CardDetailDialog", () => {
  const sampleCard = {
    cardId: "CARD-001",
    title: "Test Card",
    description: "A test description",
    status: "todo",
    priority: "high",
    assignee: "qa-1",
    comments: [
      { author: "pm-1", message: "Looks good", createdAt: "2026-01-01T00:00:00Z" },
    ],
  };

  test("renders card title and card ID when open", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("CARD-001")).toBeInTheDocument();
  });

  test("renders card description", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByText("A test description")).toBeInTheDocument();
  });

  test("renders comments section with count", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByText(/comments \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Looks good")).toBeInTheDocument();
  });

  test("shows 'No comments yet' when card has no comments", () => {
    const cardNoComments = { ...sampleCard, comments: [] };
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={cardNoComments} projectHash="abc" />
    );
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  test("renders assignee chip", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByText("Assignee: qa-1")).toBeInTheDocument();
  });

  test("renders add comment input and send button", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByLabelText(/add a comment/i)).toBeInTheDocument();
  });

  test("Close button is present", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={sampleCard} projectHash="abc" />
    );
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  test("does not render when card is null", () => {
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={null} projectHash="abc" />
    );
    expect(screen.queryByText("CARD-001")).not.toBeInTheDocument();
  });
});

// ─── ProjectSelector Component ───────────────────────────────────────────────

describe("ProjectSelector", () => {
  test("renders Add project button", () => {
    renderWithProviders(<ProjectSelector />);
    expect(screen.getByTitle("Add project")).toBeInTheDocument();
  });

  test("fetches recent projects on mount", async () => {
    renderWithProviders(<ProjectSelector />);
    await waitFor(() => {
      expect(api.getRecentProjects).toHaveBeenCalled();
    });
  });

  test("shows 'No projects' when projects list is empty", () => {
    renderWithProviders(<ProjectSelector />);
    // The "No projects" MenuItem is rendered inside the select
    expect(screen.getByText("No projects")).toBeInTheDocument();
  });

  test("opens Add Project dialog on button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSelector />);

    await user.click(screen.getByTitle("Add project"));

    expect(screen.getByText("Add Project")).toBeInTheDocument();
    expect(screen.getByLabelText(/project path/i)).toBeInTheDocument();
  });

  test("Add button in dialog is disabled when path is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectSelector />);

    await user.click(screen.getByTitle("Add project"));

    const addBtn = screen.getByRole("button", { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  test("renders project names when projects exist", () => {
    const store = createTestStore({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
      messages: { messages: [], sending: false, polling: false, error: null, lastPoll: null },
      projects: {
        projects: [
          { path: "/proj/alpha", name: "alpha", lastOpened: "2026-01-01" },
          { path: "/proj/beta", name: "beta", lastOpened: "2026-01-01" },
        ],
        activeProject: { path: "/proj/alpha", name: "alpha" },
        loading: false,
        error: null,
      },
    });
    renderWithProviders(<ProjectSelector />, { store });
    // Active project name should be visible in the selector display
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });
});
