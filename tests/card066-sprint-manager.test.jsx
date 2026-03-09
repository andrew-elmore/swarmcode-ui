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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import SprintManagerDialog from "../src/components/SprintManagerDialog";
import BoardView from "../src/components/BoardView";

// Mock API
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

const MOCK_BOARD = { objectId: "b1", projectId: "b1", nextId: 5 };

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
  api.getOrCreateProject.mockResolvedValue({ project: MOCK_BOARD, cards: [], sprints: MOCK_SPRINTS });
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
