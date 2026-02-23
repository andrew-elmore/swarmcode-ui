import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

// Default empty conversation state for a single agent
function emptyConvo(hasMore = true) {
  return { messages: [], loaded: false, hasMore, loadingMore: false };
}

// Ensure a conversation slot exists for an agent (called lazily)
function ensureConvo(state, agentName) {
  if (!state.conversations[agentName]) {
    state.conversations[agentName] = emptyConvo();
  }
  if (state.unreadCounts[agentName] === undefined) {
    state.unreadCounts[agentName] = 0;
  }
}


export const loadConversation = createAsyncThunk(
  "messages/loadConversation",
  async (agent, { getState }) => {
    if (agent === "all") {
      return { agent, messages: [], hasMore: false };
    }
    const projectHash = getState().board.board?.projectHash;
    const result = await api.getConversation(projectHash, "owner", agent, { limit: 30 });
    return { agent, messages: result.messages, hasMore: result.hasMore };
  }
);

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async ({ to, message }, { getState }) => {
    const projectHash = getState().board.board?.projectHash;
    const result = await api.sendMessage({ projectHash, from: "owner", to, message });
    return { to, message, result };
  }
);

export const refreshConversation = createAsyncThunk(
  "messages/refreshConversation",
  async (agent, { getState }) => {
    if (agent === "all") {
      return { agent, messages: [], hasMore: false };
    }
    const projectHash = getState().board.board?.projectHash;
    const result = await api.getConversation(projectHash, "owner", agent, { limit: 30 });
    return { agent, messages: result.messages, hasMore: result.hasMore };
  }
);

export const loadMoreMessages = createAsyncThunk(
  "messages/loadMoreMessages",
  async (agent, { getState }) => {
    const state = getState();
    const convo = state.messages.conversations[agent];
    if (!convo || convo.messages.length === 0) {
      return { agent, messages: [], hasMore: false };
    }
    const projectHash = state.board.board?.projectHash;
    const oldestMsg = convo.messages[0];
    const before = oldestMsg.createdAt?.iso || oldestMsg.createdAt;
    const result = await api.getConversation(projectHash, "owner", agent, { before });
    return { agent, messages: result.messages, hasMore: result.hasMore };
  }
);


const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    conversations: { all: emptyConvo(false) },
    unreadCounts: { all: 0 },
    selectedAgent: null,
    sending: false,
    refreshing: false,
    liveQueryRefreshFlag: false,
    error: null,
    mobileDrawerOpen: false,
  },
  reducers: {
    selectAgent(state, action) {
      state.selectedAgent = action.payload;
      ensureConvo(state, action.payload);
      state.unreadCounts[action.payload] = 0;
    },
    appendMessage(state, action) {
      // Append a single message from LiveQuery
      const msg = action.payload;
      const { from, to } = msg;
      const isIncoming = from !== "owner";

      if (msg.broadcast) {
        ensureConvo(state, "all");
        const allConvo = state.conversations["all"];
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

      // Also file under the specific agent conversation
      const otherAgent = from === "owner" ? to : from;
      if (otherAgent !== "all") {
        ensureConvo(state, otherAgent);
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
    setMobileDrawerOpen(state, action) {
      state.mobileDrawerOpen = action.payload;
    },
    refreshLiveQuery(state) {
      state.liveQueryRefreshFlag = !state.liveQueryRefreshFlag;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadConversation.pending, (state) => {
      state.error = null;
    });
    builder.addCase(loadConversation.fulfilled, (state, action) => {
      const { agent, messages, hasMore } = action.payload;
      ensureConvo(state, agent);
      state.conversations[agent].messages = messages;
      state.conversations[agent].loaded = true;
      state.conversations[agent].hasMore = hasMore ?? false;
    });
    builder.addCase(loadConversation.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(loadMoreMessages.pending, (state, action) => {
      const agent = action.meta.arg;
      ensureConvo(state, agent);
      state.conversations[agent].loadingMore = true;
    });
    builder.addCase(loadMoreMessages.fulfilled, (state, action) => {
      const { agent, messages, hasMore } = action.payload;
      ensureConvo(state, agent);
      state.conversations[agent].messages = [...messages, ...state.conversations[agent].messages];
      state.conversations[agent].hasMore = hasMore ?? false;
      state.conversations[agent].loadingMore = false;
    });
    builder.addCase(loadMoreMessages.rejected, (state, action) => {
      const agent = action.meta.arg;
      ensureConvo(state, agent);
      state.conversations[agent].loadingMore = false;
    });

    builder.addCase(refreshConversation.pending, (state) => {
      state.refreshing = true;
      state.error = null;
    });
    builder.addCase(refreshConversation.fulfilled, (state, action) => {
      state.refreshing = false;
      const { agent, messages, hasMore } = action.payload;
      ensureConvo(state, agent);
      state.conversations[agent].messages = messages;
      state.conversations[agent].loaded = true;
      state.conversations[agent].hasMore = hasMore ?? false;
    });
    builder.addCase(refreshConversation.rejected, (state, action) => {
      state.refreshing = false;
      state.error = action.error.message;
    });

    builder.addCase(sendMessage.pending, (state) => {
      state.sending = true;
      state.error = null;
    });
    builder.addCase(sendMessage.fulfilled, (state, action) => {
      state.sending = false;
      const { to, message } = action.payload;
      const now = new Date().toISOString();
      const newMsg = { from: "owner", to, message, createdAt: now };

      ensureConvo(state, to);
      state.conversations[to].messages.push(newMsg);
    });
    builder.addCase(sendMessage.rejected, (state, action) => {
      state.sending = false;
      state.error = action.error.message;
    });

  },
});

export const { selectAgent, appendMessage, clearError, setMobileDrawerOpen, refreshLiveQuery } = messagesSlice.actions;
export default messagesSlice.reducer;
