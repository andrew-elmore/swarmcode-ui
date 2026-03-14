/**
 * CARD-081 Unit Tests — src/store/authSlice.js
 * Pure reducer tests — no thunks, no async, no Parse SDK.
 * Dispatches pre-built action objects directly into the reducer.
 */

import authReducer, {
  clearError,
  loginUser,
  logoutUser,
  restoreSession,
  createAccount,
} from "../../src/store/authSlice";

const initialState = {
  user: null,
  sessionToken: null,
  loading: false,
  error: null,
};

// ─── Initial state ────────────────────────────────────────────────────────────

describe("authSlice — initial state", () => {
  test("has correct default values", () => {
    const state = authReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initialState);
  });
});

// ─── clearError reducer ───────────────────────────────────────────────────────

describe("authSlice — clearError", () => {
  test("resets error to null", () => {
    const state = authReducer({ ...initialState, error: "Bad credentials" }, clearError());
    expect(state.error).toBeNull();
  });

  test("does not affect other fields", () => {
    const prev = { ...initialState, user: "pm-1", sessionToken: "tok", error: "err" };
    const state = authReducer(prev, clearError());
    expect(state.user).toBe("pm-1");
    expect(state.sessionToken).toBe("tok");
  });
});

// ─── loginUser thunk actions ──────────────────────────────────────────────────

describe("authSlice — loginUser.pending", () => {
  const action = { type: loginUser.pending.type };

  test("sets loading to true", () => {
    const state = authReducer(initialState, action);
    expect(state.loading).toBe(true);
  });

  test("clears any prior error", () => {
    const state = authReducer({ ...initialState, error: "old error" }, action);
    expect(state.error).toBeNull();
  });

  test("does not modify user or sessionToken", () => {
    const prev = { ...initialState, user: "pm-1", sessionToken: "tok" };
    const state = authReducer(prev, action);
    expect(state.user).toBe("pm-1");
    expect(state.sessionToken).toBe("tok");
  });
});

describe("authSlice — loginUser.fulfilled", () => {
  const payload = { username: "pm-1", sessionToken: "r:session-abc" };
  const action = { type: loginUser.fulfilled.type, payload };

  test("sets user to the returned username", () => {
    const state = authReducer(initialState, action);
    expect(state.user).toBe("pm-1");
  });

  test("sets sessionToken to the returned token", () => {
    const state = authReducer(initialState, action);
    expect(state.sessionToken).toBe("r:session-abc");
  });

  test("sets loading to false", () => {
    const state = authReducer({ ...initialState, loading: true }, action);
    expect(state.loading).toBe(false);
  });

  test("error field unchanged by fulfilled (pending already cleared it)", () => {
    // loginUser.pending sets error=null; fulfilled does not modify the error field
    const state = authReducer(initialState, action);
    expect(state.error).toBeNull();
  });
});

describe("authSlice — loginUser.rejected", () => {
  const action = {
    type: loginUser.rejected.type,
    error: { message: "Invalid username/password." },
  };

  test("sets error to the rejection message", () => {
    const state = authReducer(initialState, action);
    expect(state.error).toBe("Invalid username/password.");
  });

  test("sets loading to false", () => {
    const state = authReducer({ ...initialState, loading: true }, action);
    expect(state.loading).toBe(false);
  });

  test("does not overwrite user or sessionToken when they were already set", () => {
    const prev = { ...initialState, user: "pm-1", sessionToken: "tok" };
    const state = authReducer(prev, action);
    expect(state.user).toBe("pm-1");
    expect(state.sessionToken).toBe("tok");
  });
});

// ─── createAccount thunk actions ─────────────────────────────────────────────

describe("authSlice — createAccount.pending", () => {
  const action = { type: createAccount.pending.type };

  test("sets loading to true", () => {
    const state = authReducer(initialState, action);
    expect(state.loading).toBe(true);
  });

  test("clears any prior error", () => {
    const state = authReducer({ ...initialState, error: "old error" }, action);
    expect(state.error).toBeNull();
  });

  test("does not modify user or sessionToken", () => {
    const prev = { ...initialState, user: "alice", sessionToken: "r:tok" };
    const state = authReducer(prev, action);
    expect(state.user).toBe("alice");
    expect(state.sessionToken).toBe("r:tok");
  });
});

describe("authSlice — createAccount.fulfilled", () => {
  const payload = { username: "alice", sessionToken: "r:signup-tok" };
  const action = { type: createAccount.fulfilled.type, payload };

  test("sets user to the new username", () => {
    const state = authReducer(initialState, action);
    expect(state.user).toBe("alice");
  });

  test("sets sessionToken to the returned token", () => {
    const state = authReducer(initialState, action);
    expect(state.sessionToken).toBe("r:signup-tok");
  });

  test("sets loading to false", () => {
    const state = authReducer({ ...initialState, loading: true }, action);
    expect(state.loading).toBe(false);
  });

  test("error field remains null (pending already cleared it)", () => {
    const state = authReducer(initialState, action);
    expect(state.error).toBeNull();
  });
});

describe("authSlice — createAccount.rejected", () => {
  const action = {
    type: createAccount.rejected.type,
    error: { message: "Username already taken." },
  };

  test("sets error to the rejection message", () => {
    const state = authReducer(initialState, action);
    expect(state.error).toBe("Username already taken.");
  });

  test("sets loading to false", () => {
    const state = authReducer({ ...initialState, loading: true }, action);
    expect(state.loading).toBe(false);
  });

  test("does not overwrite user or sessionToken when they were already set", () => {
    const prev = { ...initialState, user: "existing-user", sessionToken: "r:existing-tok" };
    const state = authReducer(prev, action);
    expect(state.user).toBe("existing-user");
    expect(state.sessionToken).toBe("r:existing-tok");
  });
});

// ─── logoutUser thunk actions ─────────────────────────────────────────────────

describe("authSlice — logoutUser.fulfilled", () => {
  const action = { type: logoutUser.fulfilled.type };

  test("clears user to null", () => {
    const state = authReducer({ ...initialState, user: "pm-1" }, action);
    expect(state.user).toBeNull();
  });

  test("clears sessionToken to null", () => {
    const state = authReducer({ ...initialState, sessionToken: "r:tok" }, action);
    expect(state.sessionToken).toBeNull();
  });

  test("does not set loading or error", () => {
    const state = authReducer({ ...initialState, user: "pm-1" }, action);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── restoreSession thunk actions ─────────────────────────────────────────────

describe("authSlice — restoreSession.fulfilled (with payload)", () => {
  const payload = { username: "devops-1", sessionToken: "r:restored-tok" };
  const action = { type: restoreSession.fulfilled.type, payload };

  test("sets user from restored session", () => {
    const state = authReducer(initialState, action);
    expect(state.user).toBe("devops-1");
  });

  test("sets sessionToken from restored session", () => {
    const state = authReducer(initialState, action);
    expect(state.sessionToken).toBe("r:restored-tok");
  });

  test("does not set loading or error", () => {
    const state = authReducer(initialState, action);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe("authSlice — restoreSession.fulfilled (null payload — no prior session)", () => {
  const action = { type: restoreSession.fulfilled.type, payload: null };

  test("leaves user as null when payload is null", () => {
    const state = authReducer(initialState, action);
    expect(state.user).toBeNull();
  });

  test("leaves sessionToken as null when payload is null", () => {
    const state = authReducer(initialState, action);
    expect(state.sessionToken).toBeNull();
  });

  test("does not overwrite existing user when payload is null", () => {
    const prev = { ...initialState, user: "pm-1", sessionToken: "r:tok" };
    const state = authReducer(prev, action);
    expect(state.user).toBe("pm-1");
    expect(state.sessionToken).toBe("r:tok");
  });
});
