import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

// --- Async Thunks ---

export const fetchAgents = createAsyncThunk(
  "agents/fetchAgents",
  async (projectHash) => {
    return api.getAgents(projectHash);
  }
);

export const createAgent = createAsyncThunk(
  "agents/createAgent",
  async (agentData) => {
    return api.createAgent(agentData);
  }
);

export const updateAgent = createAsyncThunk(
  "agents/updateAgent",
  async (agentData) => {
    return api.updateAgent(agentData);
  }
);

export const deleteAgent = createAsyncThunk(
  "agents/deleteAgent",
  async ({ projectHash, name }) => {
    await api.deleteAgent(projectHash, name);
    return { name };
  }
);

// --- Slice ---

const agentsSlice = createSlice({
  name: "agents",
  initialState: {
    agents: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAgents
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

    // createAgent
    builder.addCase(createAgent.fulfilled, (state, action) => {
      state.agents.push(action.payload.agent);
      state.agents.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });
    builder.addCase(createAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateAgent
    builder.addCase(updateAgent.fulfilled, (state, action) => {
      const updated = action.payload.agent;
      const idx = state.agents.findIndex((a) => a.name === updated.name);
      if (idx !== -1) {
        state.agents[idx] = updated;
      }
    });
    builder.addCase(updateAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // deleteAgent
    builder.addCase(deleteAgent.fulfilled, (state, action) => {
      state.agents = state.agents.filter((a) => a.name !== action.payload.name);
    });
    builder.addCase(deleteAgent.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError } = agentsSlice.actions;
export default agentsSlice.reducer;
