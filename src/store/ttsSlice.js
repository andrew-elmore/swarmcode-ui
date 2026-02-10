import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "swarmcode_tts";

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
      enabled: state.enabled,
      volume: state.volume,
      rate: state.rate,
      perAgentVoice: state.perAgentVoice,
      speakAgentName: state.speakAgentName,
    }));
  } catch {
    // ignore
  }
}

const saved = loadFromStorage();

const ttsSlice = createSlice({
  name: "tts",
  initialState: {
    enabled: saved?.enabled ?? false,
    volume: saved?.volume ?? 1.0,
    rate: saved?.rate ?? 1.0,
    perAgentVoice: saved?.perAgentVoice ?? {},
    speakAgentName: saved?.speakAgentName ?? false,
    error: null,
  },
  reducers: {
    setEnabled(state, action) {
      state.enabled = action.payload;
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
    setAgentVoice(state, action) {
      const { agent, voiceName } = action.payload;
      state.perAgentVoice[agent] = voiceName;
      saveToStorage(state);
    },
    setSpeakAgentName(state, action) {
      state.speakAgentName = action.payload;
      saveToStorage(state);
    },
    setError(state, action) {
      state.error = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
});

export const {
  setEnabled,
  setVolume,
  setRate,
  setAgentVoice,
  setSpeakAgentName,
  setError,
  clearError,
} = ttsSlice.actions;

export default ttsSlice.reducer;
