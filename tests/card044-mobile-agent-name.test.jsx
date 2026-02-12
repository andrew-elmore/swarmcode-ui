/**
 * CARD-044 QA Tests — Mobile agent list should show name only.
 *
 * On mobile (below md breakpoint), the AgentSidebar should show only the agent
 * name — no description, no secondary text. Rows should be compact with smaller
 * icons and reduced padding.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer from "../src/store/agentsSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import AgentSidebar from "../src/components/AgentSidebar";

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
}));

// Mock useMediaQuery to control mobile/desktop rendering
jest.mock("@mui/material/useMediaQuery");

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const TEST_AGENTS = [
  { name: "pm-1", description: "Project Manager", isActive: true, sortOrder: 0 },
  { name: "developer-1", description: "Full-Stack Developer", isActive: true, sortOrder: 1 },
  { name: "qa-1", description: "QA Engineer", isActive: true, sortOrder: 2 },
];

function createTestStore() {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
    },
    preloadedState: {
      agents: { agents: TEST_AGENTS, loading: false, error: null },
      board: { board: { projectHash: "test-hash" }, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
    },
  });
}

function renderSidebar(store) {
  const testStore = store || createTestStore();
  return render(
    <Provider store={testStore}>
      <ThemeProvider theme={theme}>
        <AgentSidebar
          selectedAgent={null}
          onSelectAgent={jest.fn()}
          unreadCounts={{}}
        />
      </ThemeProvider>
    </Provider>
  );
}

beforeEach(() => {
  api.getAgents.mockResolvedValue({ agents: TEST_AGENTS });
});

afterEach(() => jest.restoreAllMocks());

// ─── Mobile: Agent name only (no description) ──────────────────────────────

describe("CARD-044: Mobile agent list shows name only", () => {
  beforeEach(() => {
    // Simulate mobile viewport — breakpoints.down("md") returns true
    require("@mui/material/useMediaQuery").default.mockImplementation((query) => {
      // down("md") query matches mobile screens
      if (typeof query === "string" && query.includes("max-width")) return true;
      // For function-based queries, match "md" breakpoint
      if (typeof query === "function") {
        const result = query(theme);
        if (typeof result === "string" && result.includes("max-width")) return true;
      }
      return true; // Treat as mobile for all breakpoint queries
    });
  });

  test("shows agent name (not description) as primary text on mobile", () => {
    renderSidebar();

    // On mobile, primary text should be agent.name, NOT agent.description
    expect(screen.getByText("pm-1")).toBeInTheDocument();
    expect(screen.getByText("developer-1")).toBeInTheDocument();
    expect(screen.getByText("qa-1")).toBeInTheDocument();
  });

  test("does NOT show agent description on mobile", () => {
    renderSidebar();

    // Description should not appear as primary or secondary text
    expect(screen.queryByText("Project Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("Full-Stack Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("QA Engineer")).not.toBeInTheDocument();
  });

  test("does NOT show secondary text on mobile", () => {
    renderSidebar();

    // Each agent list item should only have primary text (name appears once, not twice)
    for (const agent of TEST_AGENTS) {
      // The name appears exactly once (as primary text), not twice
      const matches = screen.getAllByText(agent.name);
      expect(matches).toHaveLength(1);
    }
  });
});

// ─── Desktop: Shows description + name ──────────────────────────────────────

describe("CARD-044: Desktop agent list shows description + name", () => {
  beforeEach(() => {
    // Simulate desktop viewport — breakpoints.down("md") returns false
    require("@mui/material/useMediaQuery").default.mockImplementation(() => false);
  });

  test("shows agent description as primary text on desktop", () => {
    renderSidebar();

    // On desktop, primary text should be agent.description
    expect(screen.getByText("Project Manager")).toBeInTheDocument();
    expect(screen.getByText("Full-Stack Developer")).toBeInTheDocument();
    expect(screen.getByText("QA Engineer")).toBeInTheDocument();
  });

  test("shows agent name as secondary text on desktop", () => {
    renderSidebar();

    // On desktop, secondary text should be agent.name
    expect(screen.getByText("pm-1")).toBeInTheDocument();
    expect(screen.getByText("developer-1")).toBeInTheDocument();
    expect(screen.getByText("qa-1")).toBeInTheDocument();
  });
});
