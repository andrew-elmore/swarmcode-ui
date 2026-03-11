/**
 * CARD-237: Status class replacing enum card statuses
 * Tests for: projectSlice status thunks, StatusManagerDialog,
 * BoardView dynamic columns, CreateCardDialog status dropdown,
 * CardDetailDialog status dropdown.
 */

import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import projectReducer, {
  fetchProject,
  createStatus,
  updateStatus,
  deleteStatus,
} from "../src/store/projectSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import StatusManagerDialog from "../src/components/StatusManagerDialog";
import BoardView from "../src/components/BoardView";
import CreateCardDialog from "../src/components/CreateCardDialog";
import CardDetailDialog from "../src/components/CardDetailDialog";

// ─── API mock ─────────────────────────────────────────────────────────────────

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
  createStatus: jest.fn(),
  updateStatus: jest.fn(),
  deleteStatus: jest.fn(),
  getStatuses: jest.fn(),
  listArticles: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
  searchArticles: jest.fn(),
  getArticle: jest.fn(),
}));

// ─── test fixtures ────────────────────────────────────────────────────────────

const MOCK_STATUSES = [
  { objectId: "s1", name: "create", description: "New card", instructions: "Review", agentName: "pm-1", order: 0, projectId: "proj-1" },
  { objectId: "s2", name: "implement", description: "In dev", instructions: "Implement", agentName: "developer-1", order: 1, projectId: "proj-1" },
  { objectId: "s3", name: "done", description: "Complete", instructions: "Close", agentName: "pm-1", order: 2, projectId: "proj-1" },
];

const MOCK_AGENTS = [
  { objectId: "a1", name: "pm-1" },
  { objectId: "a2", name: "developer-1" },
  { objectId: "a3", name: "qa-1" },
];

const MOCK_CARD = {
  objectId: "c1",
  cardId: "CARD-001",
  title: "Test Card",
  description: "A test card",
  status: "create",
  statusId: "s1",
  priority: "medium",
  assignee: null,
  sprint: null,
  sprintName: null,
  comments: [],
};

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

// ─── store helpers ────────────────────────────────────────────────────────────

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      agents: { agents: MOCK_AGENTS, loading: false, error: null },
      project: {
        project: { objectId: "proj-1" },
        cards: [],
        sprints: [],
        statuses: MOCK_STATUSES,
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
      projects: {
        activeProject: { objectId: "proj-1", path: "C:\\test\\project" },
        recentProjects: [],
        loading: false,
        error: null,
      },
      ...preloadedState,
    },
  });
}

/** Pure projectReducer store — no component slices needed */
function createProjectStore(preloadedState = {}) {
  return configureStore({
    reducer: { project: projectReducer },
    preloadedState: preloadedState
      ? {
          project: {
            ...projectReducer(undefined, { type: "@@INIT" }),
            ...preloadedState,
          },
        }
      : undefined,
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
  jest.clearAllMocks();
  api.getOrCreateProject.mockResolvedValue({
    project: { objectId: "proj-1" },
    cards: [],
    sprints: [],
    statuses: MOCK_STATUSES,
  });
  api.createCard.mockResolvedValue({ card: MOCK_CARD });
  api.updateCard.mockResolvedValue({ card: MOCK_CARD, changes: "updated" });
  api.addComment.mockResolvedValue({ comment: {} });
  api.listCards.mockResolvedValue({ cards: [] });
  api.showCard.mockResolvedValue({ card: MOCK_CARD });
  api.getConversation.mockResolvedValue({ messages: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
  api.subscribeToCommands.mockResolvedValue(jest.fn());
  api.subscribeToPings.mockResolvedValue(jest.fn());
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.addRecentProject.mockResolvedValue({ success: true });
  api.getAgents.mockResolvedValue({ agents: MOCK_AGENTS });
  api.createStatus.mockResolvedValue({
    status: { objectId: "s-new", name: "new_status", description: "desc", instructions: "instr", agentName: "pm-1", order: 10, projectId: "proj-1" },
  });
  api.updateStatus.mockResolvedValue({
    status: { objectId: "s1", name: "create_updated", description: "Updated", instructions: "Updated instr", agentName: "pm-1", order: 0, projectId: "proj-1" },
  });
  api.deleteStatus.mockResolvedValue({ deleted: true, statusId: "s1", cardsUpdated: 0 });
  api.listArticles.mockResolvedValue({ articles: [] });
});

afterEach(() => jest.restoreAllMocks());

// ─── ST-3: projectSlice status thunks ─────────────────────────────────────────

describe("ST-3: projectSlice — statuses", () => {
  test("fetchProject.fulfilled populates statuses from API response", async () => {
    api.getOrCreateProject.mockResolvedValue({
      project: { objectId: "proj-1" },
      cards: [],
      sprints: [],
      statuses: MOCK_STATUSES,
    });
    const store = createProjectStore();
    await store.dispatch(fetchProject("C:\\test\\project"));
    expect(store.getState().project.statuses).toEqual(MOCK_STATUSES);
  });

  test("fetchProject.fulfilled sets statuses to [] when response omits statuses", async () => {
    api.getOrCreateProject.mockResolvedValue({
      project: { objectId: "proj-1" },
      cards: [],
      sprints: [],
      // no statuses field
    });
    const store = createProjectStore();
    await store.dispatch(fetchProject("C:\\test\\project"));
    expect(store.getState().project.statuses).toEqual([]);
  });

  test("createStatus.fulfilled appends new status and sorts by order", async () => {
    const initial = [
      { objectId: "s2", name: "beta", order: 2 },
      { objectId: "s3", name: "gamma", order: 3 },
    ];
    const newStatus = { objectId: "s1", name: "alpha", order: 1 };
    api.createStatus.mockResolvedValue({ status: newStatus });

    const store = createProjectStore({ statuses: initial });
    await store.dispatch(createStatus({ projectId: "proj-1", name: "alpha", description: "d", instructions: "i", agentName: "pm-1", order: 1 }));

    const statuses = store.getState().project.statuses;
    expect(statuses).toHaveLength(3);
    expect(statuses[0].objectId).toBe("s1"); // order:1 sorts first
    expect(statuses[1].objectId).toBe("s2"); // order:2
    expect(statuses[2].objectId).toBe("s3"); // order:3
  });

  test("createStatus.rejected sets error", async () => {
    api.createStatus.mockRejectedValue(new Error("name is required"));
    const store = createProjectStore();
    await store.dispatch(createStatus({ projectId: "proj-1" }));
    expect(store.getState().project.error).toBe("name is required");
  });

  test("updateStatus.fulfilled replaces the status in place and re-sorts by order", async () => {
    const initial = [
      { objectId: "s1", name: "alpha", order: 0 },
      { objectId: "s2", name: "beta", order: 1 },
    ];
    const updatedStatus = { objectId: "s1", name: "alpha_updated", order: 5 };
    api.updateStatus.mockResolvedValue({ status: updatedStatus });

    const store = createProjectStore({ statuses: initial });
    await store.dispatch(updateStatus({ projectId: "proj-1", statusId: "s1", name: "alpha_updated", order: 5 }));

    const statuses = store.getState().project.statuses;
    expect(statuses).toHaveLength(2);
    // order:1 (s2) now comes before order:5 (s1)
    expect(statuses[0].objectId).toBe("s2");
    expect(statuses[1].objectId).toBe("s1");
    expect(statuses[1].name).toBe("alpha_updated");
  });

  test("updateStatus.rejected sets error", async () => {
    api.updateStatus.mockRejectedValue(new Error("No changes specified"));
    const store = createProjectStore({ statuses: MOCK_STATUSES });
    await store.dispatch(updateStatus({ projectId: "proj-1", statusId: "s1" }));
    expect(store.getState().project.error).toBe("No changes specified");
  });

  test("deleteStatus.fulfilled filters out the status by statusId", async () => {
    const initial = [
      { objectId: "s1", name: "alpha", order: 0 },
      { objectId: "s2", name: "beta", order: 1 },
      { objectId: "s3", name: "gamma", order: 2 },
    ];
    api.deleteStatus.mockResolvedValue({ deleted: true, statusId: "s2", cardsUpdated: 0 });

    const store = createProjectStore({ statuses: initial });
    await store.dispatch(deleteStatus({ projectId: "proj-1", statusId: "s2" }));

    const statuses = store.getState().project.statuses;
    expect(statuses).toHaveLength(2);
    expect(statuses.find((s) => s.objectId === "s2")).toBeUndefined();
    expect(statuses.find((s) => s.objectId === "s1")).toBeDefined();
    expect(statuses.find((s) => s.objectId === "s3")).toBeDefined();
  });

  test("deleteStatus.rejected sets error", async () => {
    api.deleteStatus.mockRejectedValue(new Error("Status does not belong to this project"));
    const store = createProjectStore({ statuses: MOCK_STATUSES });
    await store.dispatch(deleteStatus({ projectId: "other-proj", statusId: "s1" }));
    expect(store.getState().project.error).toBe("Status does not belong to this project");
  });
});

// ─── ST-4: StatusManagerDialog ────────────────────────────────────────────────

describe("ST-4: StatusManagerDialog", () => {
  function renderDialog(props = {}) {
    const store = createTestStore();
    const onClose = jest.fn();
    const result = renderWithProviders(
      <StatusManagerDialog open={true} onClose={onClose} projectId="proj-1" {...props} />,
      { store }
    );
    return { ...result, store, onClose };
  }

  test("renders with required data-testid attributes", () => {
    renderDialog();
    expect(screen.getByTestId("status-manager-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-name")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-description")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-instructions")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-agent")).toBeInTheDocument();
    expect(screen.getByTestId("status-add-button")).toBeInTheDocument();
  });

  test("Add button is disabled when form is empty", () => {
    renderDialog();
    const addBtn = screen.getByTestId("status-add-button");
    expect(addBtn).toBeDisabled();
  });

  test("Add button is disabled when all text fields filled but agentName is empty", () => {
    renderDialog();
    fireEvent.change(screen.getByTestId("status-new-name").querySelector("input"), {
      target: { value: "My Status" },
    });
    fireEvent.change(screen.getByTestId("status-new-description").querySelector("input, textarea"), {
      target: { value: "A description" },
    });
    fireEvent.change(screen.getByTestId("status-new-instructions").querySelector("textarea"), {
      target: { value: "Some instructions" },
    });
    // agentName still empty
    expect(screen.getByTestId("status-add-button")).toBeDisabled();
  });

  test("renders a list item for each status in Redux state", () => {
    renderDialog();
    const items = screen.getAllByTestId("status-list-item");
    expect(items).toHaveLength(MOCK_STATUSES.length);
  });

  test("renders delete button for each status", () => {
    renderDialog();
    const deleteButtons = screen.getAllByTestId("status-delete");
    expect(deleteButtons).toHaveLength(MOCK_STATUSES.length);
  });

  test("calls deleteStatus dispatch with confirm when delete is clicked", async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    renderDialog();

    const deleteButtons = screen.getAllByTestId("status-delete");
    await userEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(api.deleteStatus).toHaveBeenCalledWith("proj-1", MOCK_STATUSES[0].objectId);
    });
  });

  test("does NOT call deleteStatus when confirm is cancelled", async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    renderDialog();

    const deleteButtons = screen.getAllByTestId("status-delete");
    await userEvent.click(deleteButtons[0]);

    expect(api.deleteStatus).not.toHaveBeenCalled();
  });

  test("clicking a status row enters edit mode and shows edit testids", async () => {
    renderDialog();
    const items = screen.getAllByTestId("status-list-item");
    // Click the ListItemText (the text content of the first item)
    await userEvent.click(within(items[0]).getByText(MOCK_STATUSES[0].name));

    expect(screen.getByTestId("status-edit-name")).toBeInTheDocument();
    expect(screen.getByTestId("status-edit-description")).toBeInTheDocument();
    expect(screen.getByTestId("status-edit-instructions")).toBeInTheDocument();
    expect(screen.getByTestId("status-edit-agent")).toBeInTheDocument();
  });

  test("calls updateStatus dispatch when edit Save is clicked after a change", async () => {
    renderDialog();
    const items = screen.getAllByTestId("status-list-item");
    await userEvent.click(within(items[0]).getByText(MOCK_STATUSES[0].name));

    // Change the instructions field
    const instrInput = screen.getByTestId("status-edit-instructions").querySelector("textarea");
    fireEvent.change(instrInput, { target: { value: "New instructions text" } });

    // Click Save
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(api.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          statusId: MOCK_STATUSES[0].objectId,
          instructions: "New instructions text",
        })
      );
    });
  });

  test("move-up button is disabled for the first status", () => {
    renderDialog();
    const moveUpButtons = screen.getAllByTestId("status-move-up");
    expect(moveUpButtons[0]).toBeDisabled();
  });

  test("move-down button is disabled for the last status", () => {
    renderDialog();
    const moveDownButtons = screen.getAllByTestId("status-move-down");
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });
});

// ─── ST-5: BoardView — dynamic columns ────────────────────────────────────────

describe("ST-5: BoardView — columns derived from statuses", () => {
  test("renders a board column for each status in Redux state", async () => {
    const customStatuses = [
      { objectId: "x1", name: "open", order: 0 },
      { objectId: "x2", name: "in_review", order: 1 },
      { objectId: "x3", name: "closed", order: 2 },
    ];
    api.getOrCreateProject.mockResolvedValue({
      project: { objectId: "proj-1" },
      cards: [],
      sprints: [],
      statuses: customStatuses,
    });

    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByTestId("board-column-open")).toBeInTheDocument();
      expect(screen.getByTestId("board-column-in_review")).toBeInTheDocument();
      expect(screen.getByTestId("board-column-closed")).toBeInTheDocument();
    });
  });

  test("does not render hardcoded columns absent from statuses state", async () => {
    const customStatuses = [
      { objectId: "x1", name: "custom_only", order: 0 },
    ];
    api.getOrCreateProject.mockResolvedValue({
      project: { objectId: "proj-1" },
      cards: [],
      sprints: [],
      statuses: customStatuses,
    });

    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByTestId("board-column-custom_only")).toBeInTheDocument();
    });
    // Standard statuses that aren't in the state should not render
    expect(screen.queryByTestId("board-column-create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-column-done")).not.toBeInTheDocument();
  });

  test("Manage Statuses button is present", async () => {
    renderWithProviders(<BoardView />);
    expect(await screen.findByTestId("manage-statuses-button")).toBeInTheDocument();
  });

  test("column label is derived from status name (underscores to spaces, title-cased)", async () => {
    const customStatuses = [
      { objectId: "x1", name: "code_review", order: 0 },
    ];
    api.getOrCreateProject.mockResolvedValue({
      project: { objectId: "proj-1" },
      cards: [],
      sprints: [],
      statuses: customStatuses,
    });

    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText(/Code Review/)).toBeInTheDocument();
    });
  });
});

// ─── ST-5: CreateCardDialog — status dropdown ──────────────────────────────────

describe("ST-5: CreateCardDialog — status dropdown from statuses state", () => {
  function renderCreateDialog(storeOverrides = {}) {
    const store = createTestStore(storeOverrides);
    return renderWithProviders(
      <CreateCardDialog open={true} onClose={jest.fn()} projectId="proj-1" />,
      { store }
    );
  }

  test("renders the status select with data-testid", () => {
    renderCreateDialog();
    expect(screen.getByTestId("card-status-select")).toBeInTheDocument();
  });

  test("status options are populated from Redux statuses state", async () => {
    renderCreateDialog();
    // MUI Select only renders MenuItems in the DOM after the dropdown is opened
    const selectInput = within(screen.getByTestId("card-status-select")).getByRole("combobox");
    await userEvent.click(selectInput);
    for (const s of MOCK_STATUSES) {
      const expected = s.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      expect(await screen.findByRole("option", { name: expected })).toBeInTheDocument();
    }
    await userEvent.keyboard("{Escape}");
  });

  test("renders zero status options when statuses state is empty", async () => {
    renderCreateDialog({
      project: {
        project: { objectId: "proj-1" },
        cards: [],
        sprints: [],
        statuses: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });
    const statusSelect = screen.getByTestId("card-status-select");
    const selectInput = within(statusSelect).getByRole("combobox");
    await userEvent.click(selectInput);
    expect(document.querySelectorAll("[role=option]")).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
  });
});

// ─── ST-5: CardDetailDialog — status dropdown ─────────────────────────────────

describe("ST-5: CardDetailDialog — status dropdown from statuses state", () => {
  function renderDetailDialog(card = MOCK_CARD, storeOverrides = {}) {
    const store = createTestStore(storeOverrides);
    return renderWithProviders(
      <CardDetailDialog open={true} onClose={jest.fn()} card={card} projectId="proj-1" />,
      { store }
    );
  }

  test("renders the status select with data-testid", () => {
    renderDetailDialog();
    expect(screen.getByTestId("card-status-select")).toBeInTheDocument();
  });

  test("status options are populated from Redux statuses state", async () => {
    renderDetailDialog();
    // MUI Select only renders MenuItems in the DOM after the dropdown is opened
    const selectInput = within(screen.getByTestId("card-status-select")).getByRole("combobox");
    await userEvent.click(selectInput);
    for (const s of MOCK_STATUSES) {
      const expected = s.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      expect(await screen.findByRole("option", { name: expected })).toBeInTheDocument();
    }
    await userEvent.keyboard("{Escape}");
  });

  test("dispatches updateCard with new status name when status select changes", async () => {
    renderDetailDialog();
    // Open the MUI Select dropdown
    const selectInput = within(screen.getByTestId("card-status-select")).getByRole("combobox");
    await userEvent.click(selectInput);
    // Click the "Done" option
    await userEvent.click(await screen.findByRole("option", { name: "Done" }));

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          cardId: "CARD-001",
          status: "done",
          author: "human",
        })
      );
    });
  });

  test("uses sortedStatuses (sorted by order) for the status dropdown", async () => {
    // Statuses provided in reverse order — dialog should still sort correctly
    const unorderedStatuses = [
      { objectId: "s3", name: "done", order: 2 },
      { objectId: "s1", name: "create", order: 0 },
      { objectId: "s2", name: "implement", order: 1 },
    ];
    renderDetailDialog(MOCK_CARD, {
      project: {
        project: { objectId: "proj-1" },
        cards: [],
        sprints: [],
        statuses: unorderedStatuses,
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });
    // Open the dropdown to render options into the DOM
    const selectInput = within(screen.getByTestId("card-status-select")).getByRole("combobox");
    await userEvent.click(selectInput);
    expect(await screen.findByRole("option", { name: "Create" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Implement" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Done" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  });
});
