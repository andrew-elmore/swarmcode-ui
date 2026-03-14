import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import Parse from "parse";

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ username, password }) => {
    const user = await Parse.User.logIn(username, password);
    return {
      username: user.getUsername(),
      sessionToken: user.getSessionToken(),
    };
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async () => {
    await Parse.User.logOut();
  }
);

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async () => {
    const user = Parse.User.current();
    if (!user) return null;
    return { username: user.getUsername(), sessionToken: user.getSessionToken() };
  }
);

export const createAccount = createAsyncThunk(
  "auth/createAccount",
  async ({ username, password, firstName, lastName, accountName }) => {
    await Parse.Cloud.run("createAccount", { username, password, firstName, lastName, accountName });
    const user = await Parse.User.logIn(username, password);
    return { username: user.getUsername(), sessionToken: user.getSessionToken() };
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    sessionToken: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.username;
      state.sessionToken = action.payload.sessionToken;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.sessionToken = null;
    });
    builder.addCase(createAccount.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createAccount.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.username;
      state.sessionToken = action.payload.sessionToken;
    });
    builder.addCase(createAccount.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });
    builder.addCase(restoreSession.fulfilled, (state, action) => {
      if (action.payload) {
        state.user = action.payload.username;
        state.sessionToken = action.payload.sessionToken;
      }
    });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
