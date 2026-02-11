import { createSlice } from "@reduxjs/toolkit";

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

const ttsSlice = createSlice({
  name: "tts",
  initialState: {
    enabled: false,
    volume: saved?.volume ?? 1.0,
    rate: saved?.rate ?? 1.0,
    voice: saved?.voice ?? "",    // CARD-090: browser voice name
    error: null,
    // CARD-090: visible message queue
    queue: [],          // Array of { id, from, message, status: 'pending'|'speaking'|'done' }
    currentIndex: -1,   // Index of currently speaking message (-1 = idle)
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
    // CARD-090: Queue management
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
