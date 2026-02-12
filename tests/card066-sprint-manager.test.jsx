/**
 * CARD-066 QA Tests — SprintManagerDialog: CRUD + reorder sprints.
 *
 * Tests:
 *  1. Dialog renders with title and close button
 *  2. Empty state shows "No sprints yet" message
 *  3. Create sprint: type name + click Add
 *  4. Create sprint: Enter key submits
 *  5. Add button disabled when name is empty
 *  6. Sprint list renders sorted by order
 *  7. Inline rename: click name to edit
 *  8. Inline rename: Escape cancels edit
 *  9. Reorder: Up/Down buttons call updateSprint with swapped orders
 * 10. Reorder: First sprint has disabled Up, last has disabled Down
 * 11. Delete sprint: calls deleteSprint with confirmation
 * 12. Manage Sprints button visible on BoardView
 * 13. Manage Sprints button opens dialog
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import SprintManagerDialog from "../src/components/SprintManagerDialog";
import BoardView from "../src/components/BoardView";

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
  { objectId: "s1", name: "Sprint 1", order: 0 },
  { objectId: "s2", name: "Sprint 2", order: 1 },
  { objectId: "s3", name: "Sprint 3", order: 2 },
];

const MOCK_BOARD = { objectId: "b1", projectHash: "testhash", nextId: 5 };

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

function createBoardStore(sprintOverrides = {}) {
  return createTestStore({
    board: {
      board: MOCK_BOARD,
      cards: [],
      sprints: MOCK_SPRINTS,
      sprintFilter: null,
      selectedCard: null,
      loading: false,
      error: null,
      lastPoll: new Date().toISOString(),
      ...sprintOverrides,
    },
    projects: {
      projects: [],
      activeProject: { path: "/test", name: "test" },
      loading: false,
      error: null,
    },
  });
}

beforeEach(() => {
  api.getOrCreateBoard.mockResolvedValue({ board: MOCK_BOARD, cards: [], sprints: MOCK_SPRINTS });
  api.createSprint.mockResolvedValue({ objectId: "s-new", name: "New Sprint", order: 3 });
  api.updateSprint.mockResolvedValue({ objectId: "s1", name: "Sprint 1", order: 0 });
  api.deleteSprint.mockResolvedValue({ deleted: true, sprintId: "s1", cardsUpdated: 0 });
  api.createCard.mockResolvedValue({ card: {} });
  api.updateCard.mockResolvedValue({ card: {} });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: {} });
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({ agents: [] });
});

// ─── SprintManagerDialog rendering ──────────────────────────────────────────

describe("CARD-066: SprintManagerDialog rendering", () => {
  test("renders dialog with title and close button", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByText("Manage Sprints")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={false} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    expect(screen.queryByText("Manage Sprints")).not.toBeInTheDocument();
  });

  test("shows empty state when no sprints exist", () => {
    const store = createBoardStore({ sprints: [] });
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByText("No sprints yet. Create one above.")).toBeInTheDocument();
  });

  test("shows sprint list when sprints exist", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2")).toBeInTheDocument();
    expect(screen.getByText("Sprint 3")).toBeInTheDocument();
  });

  test("sprints are displayed sorted by order", () => {
    // Provide sprints in reversed order to verify sorting
    const store = createBoardStore({
      sprints: [
        { objectId: "s3", name: "Sprint 3", order: 2 },
        { objectId: "s1", name: "Sprint 1", order: 0 },
        { objectId: "s2", name: "Sprint 2", order: 1 },
      ],
    });
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const listItems = screen.getAllByRole("listitem");
    expect(within(listItems[0]).getByText("Sprint 1")).toBeInTheDocument();
    expect(within(listItems[1]).getByText("Sprint 2")).toBeInTheDocument();
    expect(within(listItems[2]).getByText("Sprint 3")).toBeInTheDocument();
  });

  test("close button calls onClose", async () => {
    const onClose = jest.fn();
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={onClose} projectHash="testhash" />,
      { store }
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Create sprint ──────────────────────────────────────────────────────────

describe("CARD-066: Create sprint", () => {
  test("Add button is disabled when name is empty", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  test("Add button is enabled when name is entered", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const input = screen.getByLabelText("New sprint name");
    await user.type(input, "Sprint 4");

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).not.toBeDisabled();
  });

  test("clicking Add dispatches createSprint", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const input = screen.getByLabelText("New sprint name");
    await user.type(input, "Sprint 4");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(api.createSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          name: "Sprint 4",
        })
      );
    });
  });

  test("pressing Enter in name field dispatches createSprint", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const input = screen.getByLabelText("New sprint name");
    await user.type(input, "Sprint 4{Enter}");

    await waitFor(() => {
      expect(api.createSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          name: "Sprint 4",
        })
      );
    });
  });

  test("name field clears after successful create", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const input = screen.getByLabelText("New sprint name");
    await user.type(input, "Sprint 4");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });
});

// ─── Inline rename ──────────────────────────────────────────────────────────

describe("CARD-066: Inline rename", () => {
  test("clicking sprint name enters edit mode", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    // Click on "Sprint 1" text to edit
    await user.click(screen.getByText("Sprint 1"));

    // An input field should appear with the sprint name
    const editInput = screen.getByDisplayValue("Sprint 1");
    expect(editInput).toBeInTheDocument();
    expect(editInput.tagName.toLowerCase()).toBe("input");
  });

  test("pressing Escape cancels inline edit", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    await user.click(screen.getByText("Sprint 1"));

    const editInput = screen.getByDisplayValue("Sprint 1");
    await user.clear(editInput);
    await user.type(editInput, "Changed Name{Escape}");

    // Should exit edit mode without calling API
    expect(api.updateSprint).not.toHaveBeenCalled();
    // Original text should be back
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  test("pressing Enter saves renamed sprint", async () => {
    api.updateSprint.mockResolvedValue({ objectId: "s1", name: "Renamed Sprint", order: 0 });

    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    await user.click(screen.getByText("Sprint 1"));

    const editInput = screen.getByDisplayValue("Sprint 1");
    await user.clear(editInput);
    await user.type(editInput, "Renamed Sprint{Enter}");

    await waitFor(() => {
      expect(api.updateSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          projectHash: "testhash",
          sprintId: "s1",
          name: "Renamed Sprint",
        })
      );
    });
  });

  test("renaming to same name does not call API", async () => {
    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    // Clear any mocks from prior tests
    api.updateSprint.mockClear();

    await user.click(screen.getByText("Sprint 2"));

    // Press Enter without changing the name
    const editInput = screen.getByDisplayValue("Sprint 2");
    await user.type(editInput, "{Enter}");

    // handleRename checks editName.trim() === sprint.name and returns early
    expect(api.updateSprint).not.toHaveBeenCalled();
  });
});

// ─── Reorder sprints ────────────────────────────────────────────────────────

describe("CARD-066: Reorder sprints", () => {
  test("first sprint has disabled move-up button", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const moveUpButtons = screen.getAllByTitle("Move up");
    // First one (for Sprint 1) should be disabled
    expect(moveUpButtons[0]).toBeDisabled();
  });

  test("last sprint has disabled move-down button", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const moveDownButtons = screen.getAllByTitle("Move down");
    // Last one (for Sprint 3) should be disabled
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  test("middle sprint has both up and down enabled", () => {
    const store = createBoardStore();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const moveUpButtons = screen.getAllByTitle("Move up");
    const moveDownButtons = screen.getAllByTitle("Move down");

    // Sprint 2 (index 1) should have both enabled
    expect(moveUpButtons[1]).not.toBeDisabled();
    expect(moveDownButtons[1]).not.toBeDisabled();
  });

  test("clicking move-down dispatches updateSprint calls to swap orders", async () => {
    api.updateSprint.mockClear();
    api.updateSprint.mockResolvedValue({ objectId: "s1", name: "Sprint 1", order: 1 });

    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const moveDownButtons = screen.getAllByTitle("Move down");
    // Click move-down on Sprint 1 (index 0), swapping with Sprint 2 (index 1)
    await user.click(moveDownButtons[0]);

    await waitFor(() => {
      expect(api.updateSprint).toHaveBeenCalledTimes(2);
    });

    // First call: Sprint 1 gets Sprint 2's order (1)
    expect(api.updateSprint).toHaveBeenCalledWith(
      expect.objectContaining({
        projectHash: "testhash",
        sprintId: "s1",
        order: 1,
      })
    );

    // Second call: Sprint 2 gets Sprint 1's order (0)
    expect(api.updateSprint).toHaveBeenCalledWith(
      expect.objectContaining({
        projectHash: "testhash",
        sprintId: "s2",
        order: 0,
      })
    );
  });
});

// ─── Delete sprint ──────────────────────────────────────────────────────────

describe("CARD-066: Delete sprint", () => {
  test("cancelling delete confirmation does not dispatch", async () => {
    api.deleteSprint.mockClear();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const deleteButtons = screen.getAllByTitle("Delete sprint");
    await user.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.deleteSprint).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test("confirming delete dispatches deleteSprint", async () => {
    api.deleteSprint.mockClear();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteSprint.mockResolvedValue({ deleted: true, sprintId: "s1", cardsUpdated: 0 });

    const store = createBoardStore();
    const user = userEvent.setup();
    renderWithProviders(
      <SprintManagerDialog open={true} onClose={jest.fn()} projectHash="testhash" />,
      { store }
    );

    const deleteButtons = screen.getAllByTitle("Delete sprint");
    await user.click(deleteButtons[0]); // Delete Sprint 1

    expect(confirmSpy).toHaveBeenCalledWith('Delete sprint "Sprint 1"?');

    await waitFor(() => {
      expect(api.deleteSprint).toHaveBeenCalledWith("testhash", "s1");
    });

    confirmSpy.mockRestore();
  });
});

// ─── BoardView integration ──────────────────────────────────────────────────

describe("CARD-066: BoardView integration", () => {
  test("Manage Sprints button is visible on BoardView", async () => {
    const store = createTestStore({
      board: { board: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Manage Sprints" })).toBeInTheDocument();
  });

  test("clicking Manage Sprints opens SprintManagerDialog", async () => {
    const store = createTestStore({
      board: { board: null, cards: [], sprints: [], sprintFilter: null, selectedCard: null, loading: false, error: null, lastPoll: null },
      projects: { projects: [], activeProject: { path: "/test", name: "test" }, loading: false, error: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<BoardView />, { store });

    await waitFor(() => {
      expect(screen.getByText("Board")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Manage Sprints" }));

    // Dialog opens — check for the "New sprint name" input which is unique to SprintManagerDialog
    await waitFor(() => {
      expect(screen.getByLabelText("New sprint name")).toBeInTheDocument();
    });

    // Also verify the dialog has a Close button
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
