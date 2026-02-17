/**
 * CARD-109 QA Tests — Many-to-many agents-projects feature
 *
 * Tests the revamped AgentsView UI and updated agentsSlice Redux state:
 * (1) AgentsView renders all global agents (allAgents)
 * (2) Project dropdown renders with available projects
 * (3) Assigned / Unassigned sections display correctly
 * (4) Assign/unassign buttons dispatch correct Redux thunks
 * (5) agentsSlice state transitions for new thunks
 * (6) No project selected shows flat global list
 * (7) Backward compatibility: existing consumers still work
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import agentsReducer, {
  fetchAgents,
  fetchAllAgents,
  assignAgent,
  unassignAgent,
  updateProjectAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from "../src/store/agentsSlice";
import articlesReducer from "../src/store/articlesSlice";
import boardReducer from "../src/store/boardSlice";
import messagesReducer from "../src/store/messagesSlice";
import projectsReducer from "../src/store/projectsSlice";
import ttsReducer from "../src/store/ttsSlice";
import commandsReducer from "../src/store/commandsSlice";
import AgentsView from "../src/components/AgentsView";

// --- API Mocks ---
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
  getAllAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  assignAgentToProject: jest.fn(),
  unassignAgentFromProject: jest.fn(),
  updateProjectAgent: jest.fn(),
  getSprints: jest.fn(),
  createSprint: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
  createCommand: jest.fn(),
  listRecentCommands: jest.fn(),
  updateCommandStatus: jest.fn(),
  recordPing: jest.fn(),
  getLatestPing: jest.fn(),
  getRequestedCommands: jest.fn(),
  subscribeToCommands: jest.fn(),
  subscribeToPings: jest.fn(),
}));

// --- Test Data ---
const theme = createTheme();

const ALL_AGENTS = [
  { name: "pm-1", description: "Project manager", isActive: true, sortOrder: 0, permissions: { allowedTools: ["Bash"] } },
  { name: "senior-dev-1", description: "Senior developer", isActive: true, sortOrder: 1, permissions: { allowedTools: ["Bash", "Read"] } },
  { name: "developer-1", description: "Developer", isActive: true, sortOrder: 2, permissions: { allowedTools: ["Bash", "Read", "Write"] } },
  { name: "qa-1", description: "QA engineer", isActive: true, sortOrder: 3, permissions: { allowedTools: ["Bash", "Read"] } },
  { name: "devops-1", description: "DevOps engineer", isActive: true, sortOrder: 4, permissions: { allowedTools: ["Bash"] } },
  { name: "custom-agent-1", description: "Custom agent not assigned", isActive: true, sortOrder: 5, permissions: { allowedTools: [] } },
];

const ASSIGNED_AGENTS = ALL_AGENTS.slice(0, 5); // first 5 are assigned
const UNASSIGNED_AGENTS = ALL_AGENTS.slice(5);  // custom-agent-1 is not assigned

const TEST_PROJECTS = [
  { path: "C:\\project-a", name: "Project A" },
  { path: "C:\\project-b", name: "Project B" },
];

const DEFAULT_TTS_STATE = {
  enabled: false,
  voice: null,
  rate: 1,
  volume: 1,
  speakAgentName: false,
  perAgentVoice: {},
  queue: [],
  currentIndex: -1,
};

// --- Test Helpers ---
function createTestStore(overrides = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      board: boardReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
      commands: commandsReducer,
    },
    preloadedState: {
      agents: overrides.agents || {
        agents: ASSIGNED_AGENTS,
        allAgents: ALL_AGENTS,
        loading: false,
        error: null,
      },
      board: overrides.board || {
        board: { projectHash: "test-hash-123" },
        cards: [],
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
        sprints: [],
        sprintFilter: null,
      },
      messages: overrides.messages || {
        conversations: {},
        unreadCounts: {},
        selectedAgent: null,
        sending: false,
        error: null,
        mobileDrawerOpen: false,
        messages: [],
        polling: false,
        lastPoll: null,
      },
      projects: overrides.projects || {
        projects: TEST_PROJECTS,
        activeProject: TEST_PROJECTS[0],
        loading: false,
        error: null,
      },
      tts: DEFAULT_TTS_STATE,
      commands: overrides.commands || {
        commands: [],
        ping: null,
        loading: false,
        error: null,
      },
    },
  });
}

function renderAgentsView(overrides = {}) {
  const store = createTestStore(overrides);
  const result = render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <AgentsView />
      </ThemeProvider>
    </Provider>
  );
  return { ...result, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.getAllAgents.mockResolvedValue({ agents: ALL_AGENTS });
  api.getAgents.mockResolvedValue({ agents: ASSIGNED_AGENTS });
  api.getRecentProjects.mockResolvedValue({ projects: TEST_PROJECTS });
  api.assignAgentToProject.mockResolvedValue({
    success: true,
    projectAgent: { projectHash: "test-hash-123", agentName: "custom-agent-1", isActive: true, sortOrder: 5 },
  });
  api.unassignAgentFromProject.mockResolvedValue({ success: true });
  api.updateProjectAgent.mockResolvedValue({
    projectAgent: { projectHash: "test-hash-123", agentName: "qa-1", isActive: false, sortOrder: 3 },
  });
});

// ---------------------------------------------------------------------------
// 1. AgentsView rendering with project selected
// ---------------------------------------------------------------------------
describe("AgentsView rendering (project selected)", () => {
  test("TC-22: renders all agents in assigned and unassigned sections", () => {
    renderAgentsView();
    // Assigned section header
    expect(screen.getByText(/Assigned to this project/)).toBeInTheDocument();
    // Assigned agents
    for (const agent of ASSIGNED_AGENTS) {
      expect(screen.getByText(agent.name)).toBeInTheDocument();
    }
    // Available section header
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  test("TC-23: project dropdown renders with available projects", () => {
    renderAgentsView();
    // The dropdown should show Project A (active project)
    const dropdown = screen.getByLabelText("Project");
    expect(dropdown).toBeInTheDocument();
  });

  test("TC-24: assigned and unassigned sections render correct agents", () => {
    renderAgentsView();
    // Assigned section should contain 5 agents
    expect(screen.getByText(/Assigned to this project \(5\)/)).toBeInTheDocument();
    // Available section should contain 1 agent (custom-agent-1)
    expect(screen.getByText(/Available \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("custom-agent-1")).toBeInTheDocument();
  });

  test("renders Add Agent button", () => {
    renderAgentsView();
    expect(screen.getByText("Add Agent")).toBeInTheDocument();
  });

  test("assigned agents show active toggle switch", () => {
    renderAgentsView();
    // MUI Switch uses <input type="checkbox"> internally — query via CSS class
    const switches = document.querySelectorAll(".MuiSwitch-input");
    expect(switches.length).toBeGreaterThanOrEqual(5);
  });

  test("assigned agents show unassign button", () => {
    renderAgentsView();
    const unassignButtons = screen.getAllByTitle("Unassign from project");
    expect(unassignButtons.length).toBe(5);
  });

  test("unassigned agents show assign button", () => {
    renderAgentsView();
    const assignButtons = screen.getAllByTitle("Assign to project");
    expect(assignButtons.length).toBe(1); // only custom-agent-1
  });
});

// ---------------------------------------------------------------------------
// 2. No project selected — flat global list
// ---------------------------------------------------------------------------
describe("AgentsView rendering (no project)", () => {
  test("TC-25: no project shows all agents in single list", () => {
    renderAgentsView({
      board: { board: null, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null, sprints: [], sprintFilter: null },
      projects: { projects: [], activeProject: null, loading: false, error: null },
    });
    expect(screen.getByText(/All Agents/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Assign/Unassign interactions
// ---------------------------------------------------------------------------
describe("Assign/Unassign interactions", () => {
  test("TC-26: clicking assign button dispatches assignAgent thunk", async () => {
    renderAgentsView();
    const assignButton = screen.getByTitle("Assign to project");
    fireEvent.click(assignButton);
    await waitFor(() => {
      expect(api.assignAgentToProject).toHaveBeenCalledWith({
        projectHash: "test-hash-123",
        agentName: "custom-agent-1",
      });
    });
  });

  test("TC-27: clicking unassign button dispatches unassignAgent thunk", async () => {
    renderAgentsView();
    const unassignButtons = screen.getAllByTitle("Unassign from project");
    // Click first unassign button (pm-1)
    fireEvent.click(unassignButtons[0]);
    await waitFor(() => {
      expect(api.unassignAgentFromProject).toHaveBeenCalledWith({
        projectHash: "test-hash-123",
        agentName: "pm-1",
      });
    });
  });

  test("TC-28: toggling active switch dispatches updateProjectAgent", async () => {
    renderAgentsView();
    // MUI Switch uses <input type="checkbox"> — query via CSS class
    const switches = document.querySelectorAll(".MuiSwitch-input");
    expect(switches.length).toBeGreaterThan(0);
    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(api.updateProjectAgent).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Delete dialog
// ---------------------------------------------------------------------------
describe("Delete agent interaction", () => {
  test("delete button opens confirmation dialog", () => {
    renderAgentsView();
    const deleteButtons = screen.getAllByTitle("Delete");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    expect(screen.getByText(/This will remove it from all projects/)).toBeInTheDocument();
  });

  test("cancel button closes delete dialog", async () => {
    renderAgentsView();
    const deleteButtons = screen.getAllByTitle("Delete");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. agentsSlice Redux state transitions
// ---------------------------------------------------------------------------
describe("agentsSlice state transitions", () => {
  test("TC-30: assignAgent.fulfilled adds agent to project-scoped list", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: assignAgent.fulfilled.type,
      payload: {
        success: true,
        projectAgent: {
          projectHash: "test-hash",
          agentName: "custom-agent-1",
          isActive: true,
          sortOrder: 5,
        },
      },
    };

    const result = agentsReducer(state, action);
    expect(result.agents.find((a) => a.name === "custom-agent-1")).toBeDefined();
    expect(result.agents.length).toBe(6);
  });

  test("TC-31: unassignAgent.fulfilled removes agent from project-scoped list", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: unassignAgent.fulfilled.type,
      payload: { agentName: "qa-1" },
    };

    const result = agentsReducer(state, action);
    expect(result.agents.find((a) => a.name === "qa-1")).toBeUndefined();
    expect(result.agents.length).toBe(4);
  });

  test("TC-32: fetchAllAgents.fulfilled populates allAgents", () => {
    const state = {
      agents: [],
      allAgents: [],
      loading: true,
      error: null,
    };

    const action = {
      type: fetchAllAgents.fulfilled.type,
      payload: { agents: ALL_AGENTS },
    };

    const result = agentsReducer(state, action);
    expect(result.allAgents.length).toBe(6);
    expect(result.loading).toBe(false);
  });

  test("TC-33: error states set error message", () => {
    const state = { agents: [], allAgents: [], loading: false, error: null };

    const action = {
      type: fetchAllAgents.rejected.type,
      error: { message: "Network error" },
    };

    const result = agentsReducer(state, action);
    expect(result.error).toBe("Network error");
    expect(result.loading).toBe(false);
  });

  test("updateProjectAgent.fulfilled updates per-project overrides", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: updateProjectAgent.fulfilled.type,
      payload: {
        projectAgent: {
          agentName: "qa-1",
          isActive: false,
          sortOrder: 99,
        },
      },
    };

    const result = agentsReducer(state, action);
    const qa = result.agents.find((a) => a.name === "qa-1");
    expect(qa.isActive).toBe(false);
    expect(qa.sortOrder).toBe(99);
  });

  test("deleteAgent.fulfilled removes from both lists", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: deleteAgent.fulfilled.type,
      payload: { name: "qa-1" },
    };

    const result = agentsReducer(state, action);
    expect(result.agents.find((a) => a.name === "qa-1")).toBeUndefined();
    expect(result.allAgents.find((a) => a.name === "qa-1")).toBeUndefined();
  });

  test("createAgent.fulfilled adds to allAgents", () => {
    const state = {
      agents: [],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: createAgent.fulfilled.type,
      payload: {
        agent: { name: "new-agent-1", description: "New", isActive: true, sortOrder: 10, permissions: { allowedTools: [] } },
      },
    };

    const result = agentsReducer(state, action);
    expect(result.allAgents.find((a) => a.name === "new-agent-1")).toBeDefined();
  });

  test("updateAgent.fulfilled updates both allAgents and agents", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: updateAgent.fulfilled.type,
      payload: {
        agent: { ...ALL_AGENTS[0], description: "Updated PM" },
      },
    };

    const result = agentsReducer(state, action);
    expect(result.allAgents.find((a) => a.name === "pm-1").description).toBe("Updated PM");
    expect(result.agents.find((a) => a.name === "pm-1").description).toBe("Updated PM");
  });

  test("fetchAgents.fulfilled populates project-scoped agents", () => {
    const state = { agents: [], allAgents: ALL_AGENTS, loading: true, error: null };

    const action = {
      type: fetchAgents.fulfilled.type,
      payload: { agents: ASSIGNED_AGENTS },
    };

    const result = agentsReducer(state, action);
    expect(result.agents.length).toBe(5);
    expect(result.loading).toBe(false);
  });

  test("assignAgent.fulfilled does not duplicate if already assigned", () => {
    const state = {
      agents: [...ASSIGNED_AGENTS],
      allAgents: [...ALL_AGENTS],
      loading: false,
      error: null,
    };

    const action = {
      type: assignAgent.fulfilled.type,
      payload: {
        success: true,
        projectAgent: {
          projectHash: "test-hash",
          agentName: "pm-1", // already in agents
          isActive: true,
          sortOrder: 0,
        },
      },
    };

    const result = agentsReducer(state, action);
    const pmCount = result.agents.filter((a) => a.name === "pm-1").length;
    expect(pmCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  test("TC-34: empty project shows all as unassigned", () => {
    renderAgentsView({
      agents: {
        agents: [],
        allAgents: ALL_AGENTS,
        loading: false,
        error: null,
      },
    });
    expect(screen.getByText(/Assigned to this project \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/No agents assigned/)).toBeInTheDocument();
    expect(screen.getByText(/Available \(6\)/)).toBeInTheDocument();
  });

  test("all agents assigned shows empty available section", () => {
    renderAgentsView({
      agents: {
        agents: ALL_AGENTS,
        allAgents: ALL_AGENTS,
        loading: false,
        error: null,
      },
    });
    expect(screen.getByText(/Assigned to this project \(6\)/)).toBeInTheDocument();
    expect(screen.getByText(/All agents are assigned to this project/)).toBeInTheDocument();
  });

  test("loading state shows spinner", () => {
    renderAgentsView({
      agents: {
        agents: [],
        allAgents: [],
        loading: true,
        error: null,
      },
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("error state shows alert when API fails", async () => {
    api.getAllAgents.mockRejectedValue(new Error("Network failure"));
    renderAgentsView({
      agents: {
        agents: ASSIGNED_AGENTS,
        allAgents: ALL_AGENTS,
        loading: false,
        error: null,
      },
    });
    // Wait for the rejected thunk to set the error
    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });
});
