import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

const AGENTS = ["pm-1", "senior-dev-1", "developer-1", "qa-1", "devops-1"];

// Build initial per-agent conversation state
function buildInitialConversations() {
  const convos = {};
  AGENTS.forEach((agent) => {
    convos[agent] = { messages: [], loaded: false };
  });
  // "all" channel for broadcast
  convos["all"] = { messages: [], loaded: false };
  return convos;
}

function buildInitialUnreadCounts() {
  const counts = {};
  AGENTS.forEach((agent) => {
    counts[agent] = 0;
  });
  counts["all"] = 0;
  return counts;
}

// --- Async Thunks ---

export const loadConversation = createAsyncThunk(
  "messages/loadConversation",
  async (agent) => {
    if (agent === "all") {
      // For broadcast, we don't have a single conversation to load
      // Just return empty — broadcast messages appear via LiveQuery
      return { agent, messages: [] };
    }
    const result = await api.getConversation("owner", agent);
    return { agent, messages: result.messages };
  }
);

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async ({ to, message }) => {
    const result = await api.sendMessage({ from: "owner", to, message });
    return { to, message, result };
  }
);

// Legacy poll thunk — kept for backward compatibility
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
    conversations: buildInitialConversations(),
    unreadCounts: buildInitialUnreadCounts(),
    selectedAgent: null,
    sending: false,
    error: null,
    // Legacy fields for backward compat
    messages: [],
    polling: false,
    lastPoll: null,
  },
  reducers: {
    selectAgent(state, action) {
      state.selectedAgent = action.payload;
      state.unreadCounts[action.payload] = 0;
    },
    appendMessage(state, action) {
      // Append a single message from LiveQuery
      const msg = action.payload;
      const { from, to } = msg;
      const isIncoming = from !== "owner";

      if (msg.broadcast) {
        // Broadcast messages go to the "all" channel
        const allConvo = state.conversations["all"];
        if (allConvo) {
          const isDupe = allConvo.messages.some(
            (m) => m.id === msg.id || (m.createdAt === msg.createdAt && m.message === msg.message && m.from === msg.from)
          );
          if (!isDupe) {
            allConvo.messages.push(msg);
            if (isIncoming && state.selectedAgent !== "all") {
              state.unreadCounts["all"] += 1;
            }
          }
        }
      }

      // Also file under the specific agent conversation
      // Determine which agent this conversation is with
      const otherAgent = from === "owner" ? to : from;
      if (otherAgent !== "all" && state.conversations[otherAgent]) {
        const convo = state.conversations[otherAgent];
        const isDupe = convo.messages.some(
          (m) => m.id === msg.id || (m.createdAt === msg.createdAt && m.message === msg.message && m.from === msg.from)
        );
        if (!isDupe) {
          convo.messages.push(msg);
          if (isIncoming && state.selectedAgent !== otherAgent) {
            state.unreadCounts[otherAgent] += 1;
          }
        }
      }
    },
    clearError(state) {
      state.error = null;
    },
    clearMessages(state) {
      state.conversations = buildInitialConversations();
      state.unreadCounts = buildInitialUnreadCounts();
      state.messages = [];
    },
  },
  extraReducers: (builder) => {
    // loadConversation
    builder.addCase(loadConversation.pending, (state) => {
      state.error = null;
    });
    builder.addCase(loadConversation.fulfilled, (state, action) => {
      const { agent, messages } = action.payload;
      if (state.conversations[agent]) {
        state.conversations[agent].messages = messages;
        state.conversations[agent].loaded = true;
      }
    });
    builder.addCase(loadConversation.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // sendMessage
    builder.addCase(sendMessage.pending, (state) => {
      state.sending = true;
      state.error = null;
    });
    builder.addCase(sendMessage.fulfilled, (state, action) => {
      state.sending = false;
      const { to, message } = action.payload;
      const now = new Date().toISOString();
      const newMsg = { from: "owner", to, message, createdAt: now };

      if (to === "all") {
        // Add to broadcast channel
        state.conversations["all"].messages.push(newMsg);
      } else if (state.conversations[to]) {
        state.conversations[to].messages.push(newMsg);
      }
    });
    builder.addCase(sendMessage.rejected, (state, action) => {
      state.sending = false;
      state.error = action.error.message;
    });

    // Legacy pollMessages
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

export const { selectAgent, appendMessage, clearError, clearMessages } = messagesSlice.actions;
export default messagesSlice.reducer;
