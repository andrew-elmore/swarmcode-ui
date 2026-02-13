import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

export const signUp = createAsyncThunk(
  "auth/signUp",
  async ({ email, password, displayName }) => {
    return api.signUp({ email, password, displayName });
  }
);

export const logIn = createAsyncThunk(
  "auth/logIn",
  async ({ email, password }) => {
    return api.logIn({ email, password });
  }
);

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async () => {
    return api.getMe();
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    sessionToken: localStorage.getItem("sessionToken") || null,
    user: null,
    account: null,
    profile: null,
    loading: false,
    error: null,
    initialized: false,
  },
  reducers: {
    logout(state) {
      state.sessionToken = null;
      state.user = null;
      state.account = null;
      state.profile = null;
      state.error = null;
      localStorage.removeItem("sessionToken");
      api.clearSessionToken();
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // signUp
    builder.addCase(signUp.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signUp.fulfilled, (state, action) => {
      state.loading = false;
      state.sessionToken = action.payload.sessionToken;
      state.user = action.payload.user;
      state.account = action.payload.account;
      state.profile = action.payload.profile;
      state.initialized = true;
      localStorage.setItem("sessionToken", action.payload.sessionToken);
      api.setSessionToken(action.payload.sessionToken);
    });
    builder.addCase(signUp.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // logIn
    builder.addCase(logIn.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(logIn.fulfilled, (state, action) => {
      state.loading = false;
      state.sessionToken = action.payload.sessionToken;
      state.user = action.payload.user;
      state.account = action.payload.account;
      state.profile = action.payload.profile;
      state.initialized = true;
      localStorage.setItem("sessionToken", action.payload.sessionToken);
      api.setSessionToken(action.payload.sessionToken);
    });
    builder.addCase(logIn.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // fetchMe
    builder.addCase(fetchMe.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchMe.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.account = action.payload.account;
      state.profile = action.payload.profile;
      state.initialized = true;
    });
    builder.addCase(fetchMe.rejected, (state) => {
      state.loading = false;
      state.sessionToken = null;
      state.user = null;
      state.account = null;
      state.profile = null;
      state.initialized = true;
      localStorage.removeItem("sessionToken");
      api.clearSessionToken();
    });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
