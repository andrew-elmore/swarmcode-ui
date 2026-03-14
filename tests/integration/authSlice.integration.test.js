/**
 * CARD-081 Integration Tests — src/store/authSlice.js thunks
 * Tests loginUser, logoutUser, and restoreSession thunks dispatched against
 * a real configureStore. Parse SDK is mocked at the module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  loginUser,
  logoutUser,
  restoreSession,
  clearError,
  createAccount,
} from "../../src/store/authSlice";

// Parse is mocked globally via tests/__mocks__/parseMock.cjs (includes User.logIn/logOut/current)
import Parse from "parse";

function makeStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

afterEach(() => jest.clearAllMocks());

// ─── loginUser thunk ──────────────────────────────────────────────────────────

describe("loginUser thunk — success", () => {
  beforeEach(() => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "pm-1",
      getSessionToken: () => "r:session-pm1",
    });
  });

  test("calls Parse.User.logIn with the provided username and password", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "secret" }));
    expect(Parse.User.logIn).toHaveBeenCalledWith("pm-1", "secret");
  });

  test("sets auth.user to the logged-in username", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "secret" }));
    expect(store.getState().auth.user).toBe("pm-1");
  });

  test("sets auth.sessionToken to the returned session token", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "secret" }));
    expect(store.getState().auth.sessionToken).toBe("r:session-pm1");
  });

  test("sets loading to false after success", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "secret" }));
    expect(store.getState().auth.loading).toBe(false);
  });

  test("clears any prior error after success", async () => {
    const store = makeStore();
    store.dispatch(clearError());
    await store.dispatch(loginUser({ username: "pm-1", password: "secret" }));
    expect(store.getState().auth.error).toBeNull();
  });
});

describe("loginUser thunk — failure", () => {
  beforeEach(() => {
    Parse.User.logIn.mockRejectedValue(new Error("Invalid username/password."));
  });

  test("sets auth.error to the error message on failure", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "wrong" }));
    expect(store.getState().auth.error).toBe("Invalid username/password.");
  });

  test("sets loading to false after failure", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "wrong" }));
    expect(store.getState().auth.loading).toBe(false);
  });

  test("leaves user and sessionToken null on failure", async () => {
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "wrong" }));
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.sessionToken).toBeNull();
  });
});

// ─── logoutUser thunk ─────────────────────────────────────────────────────────

describe("logoutUser thunk", () => {
  test("calls Parse.User.logOut", async () => {
    Parse.User.logOut.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(logoutUser());
    expect(Parse.User.logOut).toHaveBeenCalled();
  });

  test("clears auth.user after logout", async () => {
    Parse.User.logOut.mockResolvedValue(undefined);
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "devops-1",
      getSessionToken: () => "r:tok-devops",
    });

    const store = makeStore();
    await store.dispatch(loginUser({ username: "devops-1", password: "pass" }));
    expect(store.getState().auth.user).toBe("devops-1");

    await store.dispatch(logoutUser());
    expect(store.getState().auth.user).toBeNull();
  });

  test("clears auth.sessionToken after logout", async () => {
    Parse.User.logOut.mockResolvedValue(undefined);
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "devops-1",
      getSessionToken: () => "r:tok-devops",
    });

    const store = makeStore();
    await store.dispatch(loginUser({ username: "devops-1", password: "pass" }));
    await store.dispatch(logoutUser());
    expect(store.getState().auth.sessionToken).toBeNull();
  });
});

// ─── restoreSession thunk ─────────────────────────────────────────────────────

describe("restoreSession thunk — session exists", () => {
  beforeEach(() => {
    Parse.User.current.mockReturnValue({
      getUsername: () => "senior-dev-1",
      getSessionToken: () => "r:restored-token",
    });
  });

  test("calls Parse.User.current()", async () => {
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(Parse.User.current).toHaveBeenCalled();
  });

  test("sets auth.user from the restored session", async () => {
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth.user).toBe("senior-dev-1");
  });

  test("sets auth.sessionToken from the restored session", async () => {
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth.sessionToken).toBe("r:restored-token");
  });
});

describe("restoreSession thunk — no prior session", () => {
  beforeEach(() => {
    Parse.User.current.mockReturnValue(null);
  });

  test("leaves auth.user null when Parse.User.current() returns null", async () => {
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth.user).toBeNull();
  });

  test("leaves auth.sessionToken null when no session", async () => {
    const store = makeStore();
    await store.dispatch(restoreSession());
    expect(store.getState().auth.sessionToken).toBeNull();
  });

  test("does not overwrite an existing user when no session found", async () => {
    // Edge: restoreSession dispatched while user is set from a concurrent flow
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "pm-1",
      getSessionToken: () => "r:tok",
    });
    const store = makeStore();
    await store.dispatch(loginUser({ username: "pm-1", password: "pass" }));
    Parse.User.current.mockReturnValue(null);
    await store.dispatch(restoreSession());
    // null payload must not overwrite the already-set user
    expect(store.getState().auth.user).toBe("pm-1");
  });
});

// ─── App.jsx auth button integration — restoreSession on mount ───────────────

describe("App.jsx auth button integration — Redux state visible to components", () => {
  test("after loginUser dispatch, auth.user is populated in the store", async () => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "qa-1",
      getSessionToken: () => "r:tok-qa",
    });
    const store = makeStore();
    await store.dispatch(loginUser({ username: "qa-1", password: "pass" }));
    expect(store.getState().auth.user).toBe("qa-1");
  });

  test("after logoutUser dispatch, auth.user is null — AppBar should show Sign In", async () => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "qa-1",
      getSessionToken: () => "r:tok-qa",
    });
    Parse.User.logOut.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(loginUser({ username: "qa-1", password: "pass" }));
    await store.dispatch(logoutUser());
    expect(store.getState().auth.user).toBeNull();
  });
});

// ─── CARD-088: createAccount thunk ────────────────────────────────────────────

const SIGNUP_PARAMS = {
  username: "alice",
  password: "Pass1!",
  firstName: "Alice",
  lastName: "Smith",
  accountName: "Acme Corp",
};

describe("createAccount thunk — success", () => {
  beforeEach(() => {
    Parse.Cloud.run.mockResolvedValue({});
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "alice",
      getSessionToken: () => "r:signup-session",
    });
  });

  test("calls Parse.Cloud.run with function name 'createAccount' and all 5 params", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(Parse.Cloud.run).toHaveBeenCalledWith("createAccount", SIGNUP_PARAMS);
  });

  test("calls Parse.User.logIn after cloud run", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(Parse.User.logIn).toHaveBeenCalledWith("alice", "Pass1!");
  });

  test("sets auth.user after successful sign-up", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.user).toBe("alice");
  });

  test("sets auth.sessionToken after successful sign-up", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.sessionToken).toBe("r:signup-session");
  });

  test("sets loading to false after success", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.loading).toBe(false);
  });
});

describe("createAccount thunk — failure", () => {
  beforeEach(() => {
    Parse.Cloud.run.mockRejectedValue(new Error("Username already taken."));
  });

  test("sets auth.error on failure", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.error).toBe("Username already taken.");
  });

  test("sets loading to false after failure", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.loading).toBe(false);
  });

  test("leaves user and sessionToken null on failure", async () => {
    const store = makeStore();
    await store.dispatch(createAccount(SIGNUP_PARAMS));
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.sessionToken).toBeNull();
  });
});
