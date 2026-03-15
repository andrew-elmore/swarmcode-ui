import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

const STORAGE_KEY = "swarmcode_tts";

let _nextId = 1;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      volume: state.volume,
      rate: state.rate,
      voice: state.voice,
    }));
  } catch {
    // ignore
  }
}

const saved = loadFromStorage();

export const fetchStreamMessages = createAsyncThunk(
  "tts/fetchStreamMessages",
  async (projectId) => {
    return api.getRecentMessages(projectId);
  }
);

const ttsSlice = createSlice({
  name: "tts",
  initialState: {
    enabled: false,
    volume: saved?.volume ?? 1.0,
    rate: saved?.rate ?? 1.0,
    error: null,
    queue: [],          // Array of { id, from, message, status: 'pending'|'speaking'|'done' }
    currentIndex: -1,   // Index of currently speaking message (-1 = idle)
    streamLoading: false,
  },
  reducers: {
    setEnabled(state, action) {
      state.enabled = action.payload;
      if (!action.payload) {
        // Stop → clear queue
        state.queue = [];
        state.currentIndex = -1;
      }
      saveToStorage(state);
    },
    setVolume(state, action) {
      state.volume = Math.max(0, Math.min(1, action.payload));
      saveToStorage(state);
    },
    setRate(state, action) {
      state.rate = Math.max(0.5, Math.min(2.0, action.payload));
      saveToStorage(state);
    },
    setVoice(state, action) {
      state.voice = action.payload;
      saveToStorage(state);
    },
    setError(state, action) {
      state.error = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    enqueueMessage(state, action) {
      const { from, message } = action.payload;
      state.queue.push({ id: _nextId++, from, message, status: "pending" });
      // Auto-start if idle and TTS is enabled
      if (state.currentIndex === -1 && state.enabled) {
        state.currentIndex = state.queue.length - 1;
        state.queue[state.currentIndex].status = "speaking";
      }
    },
    advanceQueue(state) {
      if (state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
        state.queue[state.currentIndex].status = "done";
      }
      const nextIndex = state.currentIndex + 1;
      if (nextIndex < state.queue.length) {
        state.currentIndex = nextIndex;
        state.queue[nextIndex].status = "speaking";
      } else {
        state.currentIndex = -1; // idle — all done
      }
    },
    skipToMessage(state, action) {
      const targetIndex = action.payload;
      if (targetIndex < 0 || targetIndex >= state.queue.length) return;
      // Mark current as done
      if (state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
        state.queue[state.currentIndex].status = "done";
      }
      // Mark everything between current and target as done
      for (let i = 0; i < state.queue.length; i++) {
        if (i < targetIndex && state.queue[i].status !== "done") {
          state.queue[i].status = "done";
        }
      }
      state.currentIndex = targetIndex;
      state.queue[targetIndex].status = "speaking";
    },
    clearQueue(state) {
      state.queue = [];
      state.currentIndex = -1;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchStreamMessages.pending, (state) => {
      state.streamLoading = true;
    });
    builder.addCase(fetchStreamMessages.fulfilled, (state, action) => {
      state.streamLoading = false;
      const incoming = action.payload?.messages ?? [];

      // Map historical messages to done-status queue items
      const historicalItems = incoming.map((msg) => ({
        id: _nextId++,
        from: msg.from || '',
        message: msg.message || '',
        status: 'done',
      }));

      // Find the first active (pending or speaking) item to preserve it and everything after
      const firstActiveIdx = state.queue.findIndex((item) => item.status !== 'done');
      const activeItems = firstActiveIdx === -1 ? [] : state.queue.slice(firstActiveIdx);

      // Remember what was speaking so we can recalculate its index
      const speakingItem = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null;

      // Rebuild queue: fresh done-prefix + preserved active items
      state.queue = [...historicalItems, ...activeItems];

      // Recalculate currentIndex
      if (speakingItem) {
        const newIdx = state.queue.findIndex((item) => item.id === speakingItem.id);
        state.currentIndex = newIdx;
      } else {
        state.currentIndex = -1;
      }
    });
    builder.addCase(fetchStreamMessages.rejected, (state) => {
      state.streamLoading = false;
    });
  },
});

export const {
  setEnabled,
  setVolume,
  setRate,
  setVoice,
  setError,
  clearError,
  enqueueMessage,
  advanceQueue,
  skipToMessage,
  clearQueue,
} = ttsSlice.actions;

export default ttsSlice.reducer;
