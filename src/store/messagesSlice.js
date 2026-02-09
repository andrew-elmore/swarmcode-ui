import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

// --- Async Thunks ---

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async (messageData) => {
    return api.sendMessage(messageData);
  }
);

export const pollMessages = createAsyncThunk(
  "messages/pollMessages",
  async (since) => {
    return api.pollMessages(since);
  }
);

// --- Slice ---

const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    messages: [],
    sending: false,
    polling: false,
    error: null,
    lastPoll: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearMessages(state) {
      state.messages = [];
    },
  },
  extraReducers: (builder) => {
    // sendMessage
    builder.addCase(sendMessage.pending, (state) => {
      state.sending = true;
      state.error = null;
    });
    builder.addCase(sendMessage.fulfilled, (state) => {
      state.sending = false;
    });
    builder.addCase(sendMessage.rejected, (state, action) => {
      state.sending = false;
      state.error = action.error.message;
    });

    // pollMessages
    builder.addCase(pollMessages.pending, (state) => {
      state.polling = true;
    });
    builder.addCase(pollMessages.fulfilled, (state, action) => {
      state.polling = false;
      if (action.payload.messages.length > 0) {
        state.messages = [...state.messages, ...action.payload.messages];
      }
      state.lastPoll = new Date().toISOString();
    });
    builder.addCase(pollMessages.rejected, (state, action) => {
      state.polling = false;
      state.error = action.error.message;
    });
  },
});

export const { clearError, clearMessages } = messagesSlice.actions;
export default messagesSlice.reducer;
