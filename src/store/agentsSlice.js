import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";


// Fetch agents assigned to the current project (via ProjectAgent join table)
export const fetchAgents = createAsyncThunk(
  "agents/fetchAgents",
  async (boardId) => {
    return api.getAgents(boardId);
  }
);

// Fetch ALL global agents (for the agent management page)
export const fetchAllAgents = createAsyncThunk(
  "agents/fetchAllAgents",
  async () => {
    return api.getAllAgents();
  }
);

// Create a global agent (no boardId)
export const createAgent = createAsyncThunk(
  "agents/createAgent",
  async (agentData) => {
    return api.createAgent(agentData);
  }
);

// Update a global agent (no boardId)
export const updateAgent = createAsyncThunk(
  "agents/updateAgent",
  async (agentData) => {
    return api.updateAgent(agentData);
  }
);

// Delete a global agent (cascades ProjectAgent rows)
export const deleteAgent = createAsyncThunk(
  "agents/deleteAgent",
  async ({ name }) => {
    await api.deleteAgent(name);
    return { name };
  }
);

// Assign a global agent to a project
export const assignAgent = createAsyncThunk(
  "agents/assignAgent",
  async ({ boardId, agentName }) => {
    return api.assignAgentToProject({ boardId, agentName });
  }
);

// Unassign an agent from a project
export const unassignAgent = createAsyncThunk(
  "agents/unassignAgent",
  async ({ boardId, agentName }) => {
    await api.unassignAgentFromProject({ boardId, agentName });
    return { agentName };
  }
);

// Update per-project agent overrides (isActive, sortOrder)
export const updateProjectAgent = createAsyncThunk(
  "agents/updateProjectAgent",
  async ({ boardId, agentName, isActive, sortOrder }) => {
    return api.updateProjectAgent({ boardId, agentName, isActive, sortOrder });
  }
);


const agentsSlice = createSlice({
  name: "agents",
  initialState: {
    agents: [],      // project-scoped agents (backward-compatible for existing consumers)
    allAgents: [],   // global agent pool
    loading: false,
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAgents (project-scoped)
    builder.addCase(fetchAgents.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAgents.fulfilled, (state, action) => {
      state.loading = false;
      state.agents = action.payload.agents;
    });
    builder.addCase(fetchAgents.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // fetchAllAgents (global pool)
    builder.addCase(fetchAllAgents.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllAgents.fulfilled, (state, action) => {
      state.loading = false;
      state.allAgents = action.payload.agents;
    });
    builder.addCase(fetchAllAgents.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // createAgent (adds to global pool)
    builder.addCase(createAgent.fulfilled, (state, action) => {
      state.allAgents.push(action.payload.agent);
      state.allAgents.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });
    builder.addCase(createAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateAgent (updates in global pool)
    builder.addCase(updateAgent.fulfilled, (state, action) => {
      const updated = action.payload.agent;
      const idx = state.allAgents.findIndex((a) => a.name === updated.name);
      if (idx !== -1) {
        state.allAgents[idx] = updated;
      }
      // Also update in project-scoped list if present
      const pidx = state.agents.findIndex((a) => a.name === updated.name);
      if (pidx !== -1) {
        state.agents[pidx] = { ...state.agents[pidx], ...updated };
      }
    });
    builder.addCase(updateAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // deleteAgent (removes from both lists)
    builder.addCase(deleteAgent.fulfilled, (state, action) => {
      state.allAgents = state.allAgents.filter((a) => a.name !== action.payload.name);
      state.agents = state.agents.filter((a) => a.name !== action.payload.name);
    });
    builder.addCase(deleteAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // assignAgent (add to project-scoped list)
    builder.addCase(assignAgent.fulfilled, (state, action) => {
      const { agentName } = action.payload.projectAgent;
      // Find the global agent data and add to project list
      const globalAgent = state.allAgents.find((a) => a.name === agentName);
      if (globalAgent) {
        const alreadyAssigned = state.agents.some((a) => a.name === agentName);
        if (!alreadyAssigned) {
          state.agents.push({
            ...globalAgent,
            isActive: action.payload.projectAgent.isActive,
            sortOrder: action.payload.projectAgent.sortOrder,
          });
          state.agents.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }
      }
    });
    builder.addCase(assignAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // unassignAgent (remove from project-scoped list)
    builder.addCase(unassignAgent.fulfilled, (state, action) => {
      state.agents = state.agents.filter((a) => a.name !== action.payload.agentName);
    });
    builder.addCase(unassignAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateProjectAgent (update per-project overrides)
    builder.addCase(updateProjectAgent.fulfilled, (state, action) => {
      const { agentName, isActive, sortOrder } = action.payload.projectAgent;
      const idx = state.agents.findIndex((a) => a.name === agentName);
      if (idx !== -1) {
        state.agents[idx] = { ...state.agents[idx], isActive, sortOrder };
      }
    });
    builder.addCase(updateProjectAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError } = agentsSlice.actions;
export default agentsSlice.reducer;
