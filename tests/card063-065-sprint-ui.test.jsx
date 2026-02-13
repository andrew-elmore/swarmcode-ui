/**
 * CARD-063/064/065 QA Tests — Sprint UI features.
 *
 * Tests:
 *  CARD-063: Sprint filter dropdown + sprint chip on BoardView
 *  CARD-064: Sprint field in CreateCardDialog
 *  CARD-065: Sprint field in CardDetailDialog
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer, { setSprintFilter } from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import BoardView from "../src/components/BoardView";
import CreateCardDialog from "../src/components/CreateCardDialog";
import CardDetailDialog from "../src/components/CardDetailDialog";

// Mock API
jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
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

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const MOCK_SPRINTS = [
  { objectId: "s1", name: "Sprint 1", order: 1 },
  { objectId: "s2", name: "Sprint 2", order: 2 },
];

const MOCK_BOARD = { objectId: "b1", projectHash: "testhash", nextId: 5 };

const MOCK_CARDS = [
  { cardId: "CARD-001", title: "Card A", status: "scope", priority: "high", assignee: "developer-1", sprint: "Sprint 1" },
  { cardId: "CARD-002", title: "Card B", status: "scope", priority: "medium", assignee: null, sprint: "Sprint 2" },
  { cardId: "CARD-003", title: "Card C", status: "implement", priority: "low", assignee: "qa-1", sprint: null },
  { cardId: "CARD-004", title: "Card D", status: "done", priority: "medium", assignee: null, sprint: "Sprint 1" },
];

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      ...preloadedState,
    },
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
  api.getOrCreateBoard.mockResolvedValue({ board: MOCK_BOARD, cards: MOCK_CARDS, sprints: MOCK_SPRINTS });
  api.createCard.mockResolvedValue({ card: { cardId: "CARD-005", title: "New Card", status: "create", priority: "medium", sprint: null } });
  api.updateCard.mockResolvedValue({ card: { cardId: "CARD-001", title: "Card A", status: "scope", priority: "high", sprint: "Sprint 2" } });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({ agents: [] });
});

// Helper to render BoardView and wait for it to finish loading
async function renderBoardView(storeOverrides = {}) {
  const store = createTestStore({
    board: {
      board: null,
      cards: [],
      sprints: [],
      sprintFilter: null,
      selectedCard: null,
      loading: false,
      error: null,
      lastPoll: null,
    },
    projects: {
      projects: [],
      activeProject: { path: "/test", name: "test" },
      loading: false,
      error: null,
    },
    ...storeOverrides,
  });

  const result = renderWithProviders(<BoardView />, { store });

  // Wait for the board to load (fetchBoard to complete)
  await waitFor(() => {
    expect(screen.getByText("Board")).toBeInTheDocument();
  });

  return { ...result, store };
}

// Helper to create a store with board already loaded (for dialogs that don't re-fetch)
function createBoardLoadedStore(overrides = {}) {
  return createTestStore({
    board: {
      board: MOCK_BOARD,
      cards: MOCK_CARDS,
      sprints: MOCK_SPRINTS,
      sprintFilter: null,
      selectedCard: null,
      loading: false,
      error: null,
      lastPoll: new Date().toISOString(),
      ...overrides,
    },
    projects: {
      projects: [],
      activeProject: { path: "/test", name: "test" },
      loading: false,
      error: null,
    },
  });
}

// ─── CARD-063: Sprint filter dropdown + sprint chip on BoardView ────────────

describe("CARD-063: BoardView sprint filter dropdown", () => {
  test("sprint filter dropdown appears when sprints exist", async () => {
    await renderBoardView();

    // Sprint label should be present as a select field
    expect(screen.getByLabelText("Sprint")).toBeInTheDocument();
  });

  test("sprint filter dropdown is hidden when no sprints exist", async () => {
    api.getOrCreateBoard.mockResolvedValue({ board: MOCK_BOARD, cards: MOCK_CARDS, sprints: [] });
    await renderBoardView();

    // No Sprint select should appear on BoardView when sprints is empty
    // The only "Sprint" text should not be a form label
    expect(screen.queryByLabelText("Sprint")).not.toBeInTheDocument();
  });

  test("filtering by sprint shows only matching cards", async () => {
    const { store } = await renderBoardView();

    // Apply sprint filter via Redux
    store.dispatch(setSprintFilter("Sprint 1"));

    // Sprint 1 cards: CARD-001 (todo) and CARD-004 (done) should be visible
    await waitFor(() => {
      expect(screen.getByText("Card A")).toBeInTheDocument();
      expect(screen.getByText("Card D")).toBeInTheDocument();
    });

    // Sprint 2 card and no-sprint card should not be visible
    expect(screen.queryByText("Card B")).not.toBeInTheDocument();
    expect(screen.queryByText("Card C")).not.toBeInTheDocument();
  });

  test("clearing sprint filter shows all cards", async () => {
    const { store } = await renderBoardView();

    // First filter, then clear
    store.dispatch(setSprintFilter("Sprint 1"));
    await waitFor(() => {
      expect(screen.queryByText("Card B")).not.toBeInTheDocument();
    });

    store.dispatch(setSprintFilter(null));
    await waitFor(() => {
      // All 4 cards should be visible
      expect(screen.getByText("Card A")).toBeInTheDocument();
      expect(screen.getByText("Card B")).toBeInTheDocument();
      expect(screen.getByText("Card C")).toBeInTheDocument();
      expect(screen.getByText("Card D")).toBeInTheDocument();
    });
  });

  test("all cards are shown when no sprint filter is active", async () => {
    await renderBoardView();

    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
    expect(screen.getByText("Card C")).toBeInTheDocument();
    expect(screen.getByText("Card D")).toBeInTheDocument();
  });
});

describe("CARD-063: BoardView sprint chip on cards", () => {
  test("card with sprint shows sprint chip text", async () => {
    await renderBoardView();

    // CARD-001 and CARD-004 have sprint "Sprint 1"
    // The sprint text should appear as chip labels
    const sprint1Chips = screen.getAllByText("Sprint 1");
    expect(sprint1Chips.length).toBeGreaterThanOrEqual(1);
  });

  test("card without sprint does not render extra chip", async () => {
    // Use a single card with no sprint
    api.getOrCreateBoard.mockResolvedValue({
      board: MOCK_BOARD,
      cards: [
        { cardId: "CARD-003", title: "Card C", status: "implement", priority: "low", assignee: "qa-1", sprint: null },
      ],
      sprints: [],
    });

    await renderBoardView();

    expect(screen.getByText("Card C")).toBeInTheDocument();
    // No sprint chips should be present (no "Sprint X" text as chip)
    expect(screen.queryByText("Sprint 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Sprint 2")).not.toBeInTheDocument();
  });

  test("cards with different sprints show their respective sprint chips", async () => {
    await renderBoardView();

    // Sprint 1 appears on CARD-001 and CARD-004 (at least 2 chips)
    const sprint1Elements = screen.getAllByText("Sprint 1");
    expect(sprint1Elements.length).toBeGreaterThanOrEqual(2);

    // Sprint 2 appears on CARD-002
    const sprint2Elements = screen.getAllByText("Sprint 2");
    expect(sprint2Elements.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CARD-063: BoardView column counts with sprint filter", () => {
  test("filtered view only shows cards matching sprint", async () => {
    const { store } = await renderBoardView();

    // Filter to Sprint 1: CARD-001 (todo) + CARD-004 (done)
    store.dispatch(setSprintFilter("Sprint 1"));

    await waitFor(() => {
      expect(screen.getByText("Card A")).toBeInTheDocument();
      expect(screen.getByText("Card D")).toBeInTheDocument();
    });

    // Sprint 2 and no-sprint cards should be filtered out
    expect(screen.queryByText("Card B")).not.toBeInTheDocument();
    expect(screen.queryByText("Card C")).not.toBeInTheDocument();
  });
});

// ─── CARD-064: Sprint field in CreateCardDialog ─────────────────────────────

describe("CARD-064: CreateCardDialog sprint field", () => {
  test("sprint dropdown renders in create card dialog", () => {
    const store = createBoardLoadedStore();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByLabelText("Sprint")).toBeInTheDocument();
  });

  test("sprint dropdown is populated from Redux sprints", async () => {
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    // Click the Sprint select to open dropdown
    const sprintSelect = screen.getByLabelText("Sprint");
    await user.click(sprintSelect);

    // Sprint options should appear in the popup listbox
    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();
    });

    expect(screen.getByText("No Sprint")).toBeInTheDocument();
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2")).toBeInTheDocument();
  });

  test("creating card with sprint sends sprint to API", async () => {
    const onClose = jest.fn();
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={onClose} projectHash="testhash" />,
      { store }
    );

    // Fill in title
    const titleInput = screen.getByLabelText("Title *");
    await user.type(titleInput, "Test Card");

    // Select sprint
    const sprintSelect = screen.getByLabelText("Sprint");
    await user.click(sprintSelect);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Sprint 1"));

    // Submit
    const createBtn = screen.getByRole("button", { name: "Create" });
    await user.click(createBtn);

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          title: "Test Card",
          sprint: "Sprint 1",
        })
      );
    });
  });

  test("creating card without sprint sends null for sprint", async () => {
    const onClose = jest.fn();
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CreateCardDialog open={true} onClose={onClose} projectHash="testhash" />,
      { store }
    );

    // Fill in title only, leave sprint as default (No Sprint)
    const titleInput = screen.getByLabelText("Title *");
    await user.type(titleInput, "No Sprint Card");

    const createBtn = screen.getByRole("button", { name: "Create" });
    await user.click(createBtn);

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          title: "No Sprint Card",
          sprint: null,
        })
      );
    });
  });
});

// ─── CARD-065: Sprint field in CardDetailDialog ─────────────────────────────

describe("CARD-065: CardDetailDialog sprint field", () => {
  const mockCard = {
    cardId: "CARD-001",
    title: "Test Card",
    description: "Description",
    status: "scope",
    priority: "high",
    assignee: "developer-1",
    sprint: "Sprint 1",
    comments: [],
  };

  test("sprint dropdown renders in card detail dialog", () => {
    const store = createBoardLoadedStore();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={mockCard} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByLabelText("Sprint")).toBeInTheDocument();
  });

  test("sprint chip displays for card with sprint", () => {
    const store = createBoardLoadedStore();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={mockCard} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByText("Sprint: Sprint 1")).toBeInTheDocument();
  });

  test("no sprint chip for card without sprint", () => {
    const cardNoSprint = { ...mockCard, sprint: null };
    const store = createBoardLoadedStore();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={cardNoSprint} projectHash="testhash" />,
      { store }
    );

    expect(screen.queryByText(/Sprint:/)).not.toBeInTheDocument();
  });

  test("changing sprint dispatches updateCard", async () => {
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={mockCard} projectHash="testhash" />,
      { store }
    );

    // Click Sprint select to open options
    const sprintSelect = screen.getByLabelText("Sprint");
    await user.click(sprintSelect);

    // Select Sprint 2
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Sprint 2"));

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          cardId: "CARD-001",
          sprint: "Sprint 2",
          author: "human",
        })
      );
    });
  });

  test("clearing sprint dispatches updateCard with null", async () => {
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={mockCard} projectHash="testhash" />,
      { store }
    );

    // Click Sprint select to open options
    const sprintSelect = screen.getByLabelText("Sprint");
    await user.click(sprintSelect);

    // Select "No Sprint"
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.click(screen.getByText("No Sprint"));

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          cardId: "CARD-001",
          sprint: null,
          author: "human",
        })
      );
    });
  });

  test("sprint dropdown populated from Redux sprints", async () => {
    const store = createBoardLoadedStore();
    const user = userEvent.setup();
    renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={mockCard} projectHash="testhash" />,
      { store }
    );

    const sprintSelect = screen.getByLabelText("Sprint");
    await user.click(sprintSelect);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    // Scope queries to the listbox to avoid matching the selected value display
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("No Sprint")).toBeInTheDocument();
    expect(within(listbox).getByText("Sprint 1")).toBeInTheDocument();
    expect(within(listbox).getByText("Sprint 2")).toBeInTheDocument();
  });
});

// ─── boardSlice sprint state ────────────────────────────────────────────────

describe("boardSlice sprint state", () => {
  test("fetchBoard populates sprints from API response", async () => {
    const store = createTestStore({
      board: { board: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });

    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      const state = store.getState().board;
      expect(state.sprints).toEqual(MOCK_SPRINTS);
    });
  });

  test("fetchBoard defaults sprints to empty array when API response omits sprints", async () => {
    api.getOrCreateBoard.mockResolvedValue({ board: MOCK_BOARD, cards: [] });

    const store = createTestStore({
      board: { board: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });

    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      const state = store.getState().board;
      expect(state.board).toBeTruthy();
    });

    // sprints should default to [] when not in response
    const state = store.getState().board;
    expect(Array.isArray(state.sprints)).toBe(true);
    expect(state.sprints).toEqual([]);
  });

  test("setSprintFilter updates sprintFilter state", () => {
    const store = createBoardLoadedStore();

    store.dispatch(setSprintFilter("Sprint 1"));
    expect(store.getState().board.sprintFilter).toBe("Sprint 1");

    store.dispatch(setSprintFilter(null));
    expect(store.getState().board.sprintFilter).toBeNull();
  });
});
