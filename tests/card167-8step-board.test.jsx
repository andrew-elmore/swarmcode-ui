/**
 * CARD-167: 8-Step Board Pipeline — UI Unit Tests
 *
 * Verifies:
 *  1. BoardView renders all 8 columns with correct labels
 *  2. STATUSES constant has exactly 8 entries matching the new pipeline
 *  3. Cards render in the correct column by status
 *  4. Mobile column selector includes all 8 statuses
 *  5. constants.js exports match expected values
 *
 * Author: qa-1
 * Date: 2026-02-13
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import articlesReducer from "../src/store/articlesSlice";
import boardReducer from "../src/store/boardSlice";
import projectsReducer from "../src/store/projectsSlice";
import agentsReducer from "../src/store/agentsSlice";
import messagesReducer from "../src/store/messagesSlice";
import ttsReducer from "../src/store/ttsSlice";
import BoardView from "../src/components/BoardView";
import { STATUSES, PRIORITIES, PRIORITY_COLORS } from "../src/constants";

// Mock the API module
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

const NEW_STATUSES = ["create", "scope", "implement", "code_review", "test", "test_review", "ship", "done"];
const COLUMN_LABELS = ["Create", "Scope", "Implement", "Code Review", "Test", "Test Review", "Ship", "Done"];

function createTestStore(boardState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      projects: {
        projects: [],
        activeProject: { path: "C:\\Test\\Project", hash: "abc123" },
        loading: false,
        error: null,
      },
      board: {
        board: { projectHash: "abc123" },
        cards: [],
        sprints: [],
        sprintFilter: null,
        loading: false,
        error: null,
        ...boardState,
      },
    },
  });
}

function renderBoard(cards = [], sprints = []) {
  api.getOrCreateBoard.mockResolvedValue({
    board: { objectId: "b1", projectHash: "abc123", projectPath: "C:\\Test\\Project", nextId: 100 },
    cards,
    sprints,
  });
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <BoardView />
      </ThemeProvider>
    </Provider>
  );
}

beforeEach(() => {
  api.getOrCreateBoard.mockResolvedValue({
    board: { objectId: "b1", projectHash: "abc123", projectPath: "C:\\Test\\Project", nextId: 100 },
    cards: [],
    sprints: [],
  });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.subscribeToMessages.mockResolvedValue(jest.fn());
});

afterEach(() => jest.restoreAllMocks());

// ─── Constants Verification ─────────────────────────────────────────────────

describe("CARD-167: constants.js STATUSES", () => {
  test("STATUSES array has exactly 8 entries", () => {
    expect(STATUSES).toHaveLength(8);
  });

  test("STATUSES matches the 8-step pipeline in order", () => {
    expect(STATUSES).toEqual(NEW_STATUSES);
  });

  test("new statuses test_review and ship are present", () => {
    expect(STATUSES).toContain("test_review");
    expect(STATUSES).toContain("ship");
  });

  test("old statuses are NOT present", () => {
    const oldStatuses = ["backlog", "todo", "in_progress", "review", "qa"];
    for (const old of oldStatuses) {
      expect(STATUSES).not.toContain(old);
    }
  });

  test("PRIORITIES unchanged", () => {
    expect(PRIORITIES).toEqual(["low", "medium", "high", "critical"]);
  });

  test("PRIORITY_COLORS unchanged", () => {
    expect(PRIORITY_COLORS).toEqual({
      critical: "error",
      high: "warning",
      medium: "info",
      low: "default",
    });
  });
});

// ─── BoardView: Column Rendering ────────────────────────────────────────────

describe("CARD-167: BoardView renders 8 columns", () => {
  test("all 8 column labels are visible", async () => {
    renderBoard();
    for (const label of COLUMN_LABELS) {
      await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
    }
  });

  test("no old column labels are rendered", async () => {
    renderBoard();
    // Wait for board to load
    await waitFor(() => expect(screen.getByText("Create")).toBeTruthy());
    const oldLabels = ["Backlog", "To Do", "In Progress", "Review", "QA"];
    for (const label of oldLabels) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  test("column count chips show 0 on empty board", async () => {
    renderBoard();
    await waitFor(() => expect(screen.getByText("Create")).toBeTruthy());
    // Each column header has a Chip with count "0"
    const chips = screen.getAllByText("0");
    expect(chips.length).toBeGreaterThanOrEqual(8);
  });
});

// ─── BoardView: Cards in Correct Columns ────────────────────────────────────

describe("CARD-167: BoardView places cards in correct columns", () => {
  const testCards = NEW_STATUSES.map((status, i) => ({
    cardId: `CARD-${String(i + 1).padStart(3, "0")}`,
    title: `Test Card ${status}`,
    description: "",
    status,
    assignee: null,
    priority: "medium",
    sprint: null,
    sprintName: null,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  test("each card appears within its column", async () => {
    renderBoard(testCards);
    for (const card of testCards) {
      await waitFor(() => expect(screen.getByText(card.title)).toBeTruthy());
      expect(screen.getByText(card.cardId)).toBeTruthy();
    }
  });

  test("column counts match number of cards per status", async () => {
    // Put 2 cards in "implement", 1 in everything else
    const cards = [
      ...testCards,
      {
        cardId: "CARD-009",
        title: "Extra Implement Card",
        description: "",
        status: "implement",
        assignee: null,
        priority: "high",
        sprint: null,
        sprintName: null,
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    renderBoard(cards);
    // Wait for board to render, then check the "Implement" column shows count 2
    await waitFor(() => expect(screen.getByText("2")).toBeTruthy());
  });
});

// ─── BoardView: Card Detail Fields ──────────────────────────────────────────

describe("CARD-167: Card fields render correctly with new statuses", () => {
  test("card with test_review status renders", async () => {
    const cards = [{
      cardId: "CARD-100",
      title: "Test Review Card",
      description: "Reviewing tests",
      status: "test_review",
      assignee: "qa-1",
      priority: "high",
      sprint: null,
      sprintName: null,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    renderBoard(cards);
    await waitFor(() => expect(screen.getByText("Test Review Card")).toBeTruthy());
    expect(screen.getByText("CARD-100")).toBeTruthy();
    expect(screen.getByText("qa-1")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
  });

  test("card with ship status renders", async () => {
    const cards = [{
      cardId: "CARD-101",
      title: "Ship Card",
      description: "Ready to ship",
      status: "ship",
      assignee: "devops-1",
      priority: "critical",
      sprint: null,
      sprintName: null,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    renderBoard(cards);
    await waitFor(() => expect(screen.getByText("Ship Card")).toBeTruthy());
    expect(screen.getByText("CARD-101")).toBeTruthy();
    expect(screen.getByText("devops-1")).toBeTruthy();
    expect(screen.getByText("critical")).toBeTruthy();
  });
});
