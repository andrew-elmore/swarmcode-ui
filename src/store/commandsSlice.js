// commandsSlice.js — Redux slice for remote agent commands

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";


export const fetchRecentCommands = createAsyncThunk(
  "commands/fetchRecentCommands",
  async (projectId) => {
    return api.listRecentCommands(projectId);
  }
);

export const createCommand = createAsyncThunk(
  "commands/createCommand",
  async ({ projectId, action }) => {
    return api.createCommand(projectId, action);
  }
);

export const fetchLatestPing = createAsyncThunk(
  "commands/fetchLatestPing",
  async (projectId) => {
    return api.getLatestPing(projectId);
  }
);


const commandsSlice = createSlice({
  name: "commands",
  initialState: {
    commands: [],
    latestPing: null,
    loading: false,
    sending: false,
    error: null,
  },
  reducers: {
    updateCommand(state, action) {
      const updated = action.payload;
      const idx = state.commands.findIndex((c) => c.objectId === updated.objectId);
      if (idx !== -1) {
        state.commands[idx] = updated;
      } else {
        // New command — prepend and keep only 5
        state.commands.unshift(updated);
        if (state.commands.length > 5) {
          state.commands = state.commands.slice(0, 5);
        }
      }
    },
    setPing(state, action) {
      state.latestPing = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchRecentCommands.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRecentCommands.fulfilled, (state, action) => {
      state.loading = false;
      state.commands = action.payload.commands;
    });
    builder.addCase(fetchRecentCommands.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    builder.addCase(createCommand.pending, (state) => {
      state.sending = true;
      state.error = null;
    });
    builder.addCase(createCommand.fulfilled, (state, action) => {
      state.sending = false;
      // Prepend the new command and keep only 5
      state.commands.unshift(action.payload);
      if (state.commands.length > 5) {
        state.commands = state.commands.slice(0, 5);
      }
    });
    builder.addCase(createCommand.rejected, (state, action) => {
      state.sending = false;
      state.error = action.error.message;
    });

    builder.addCase(fetchLatestPing.fulfilled, (state, action) => {
      state.latestPing = action.payload.ping;
    });
  },
});

export const { updateCommand, setPing, clearError } = commandsSlice.actions;
export default commandsSlice.reducer;
