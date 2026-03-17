/**
 * CARD-104 Unit Tests — src/components/RegisterView.jsx
 * Author: qa-1
 *
 * Covers:
 *   1. Logged-in user: spinner while loading, success alert after resolve
 *   2. Not logged in: warning alert shown, registerUserDevice never called
 *   3. API error: error alert shown
 *   4. Idempotent: existing localStorage deviceId is reused (no new UUID)
 *   5. No localStorage deviceId: crypto.randomUUID() called and stored
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import authReducer from "../../src/store/authSlice";
import RegisterView from "../../src/components/RegisterView";

// Mock the API layer — registerUserDevice must not make real HTTP calls
jest.mock("../../src/services/api", () => ({
  registerUserDevice: jest.fn(),
}));

import * as api from "../../src/services/api";

// Parse is mocked globally via tests/__mocks__/parseMock.cjs
// Parse.User.current() returns null by default — restoreSession fulfills with null payload
// The reducer does NOT overwrite a preloaded user when payload is null.
import Parse from "parse";

const theme = createTheme();

// Stable UUID for asserting idempotent device ID behaviour
const MOCK_UUID = "mock-device-uuid-1234";

beforeAll(() => {
  // crypto.randomUUID is available in Node 15+ / jsdom 19+, but mock it for determinism
  Object.defineProperty(global, "crypto", {
    value: { randomUUID: jest.fn(() => MOCK_UUID) },
    writable: true,
    configurable: true,
  });
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  Parse.User.current.mockReturnValue(null);
});

function makeStore(authState = {}) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: null,
        sessionToken: null,
        loading: false,
        error: null,
        ...authState,
      },
    },
  });
}

function renderRegisterView(authState = {}) {
  const store = makeStore(authState);
  render(
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <RegisterView />
      </Provider>
    </ThemeProvider>
  );
  return { store };
}

// ─── Static content ───────────────────────────────────────────────────────────

describe("RegisterView — static content", () => {
  test("renders 'Device Registration' heading", () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {}));
    renderRegisterView({ user: "qa-1" });
    expect(screen.getByText("Device Registration")).toBeInTheDocument();
  });
});

// ─── Unauthenticated user ─────────────────────────────────────────────────────

describe("CARD-104: RegisterView — unauthenticated user", () => {
  test("shows warning alert when user is not logged in", async () => {
    renderRegisterView({ user: null });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/must be signed in/i);
  });

  test("does NOT call registerUserDevice when user is not logged in", async () => {
    renderRegisterView({ user: null });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(api.registerUserDevice).not.toHaveBeenCalled();
  });
});

// ─── Authenticated user — success ─────────────────────────────────────────────

describe("CARD-104: RegisterView — authenticated user, success", () => {
  test("shows success alert after registerUserDevice resolves", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const success = alerts.find((a) =>
        a.textContent.includes("Device registered successfully")
      );
      expect(success).toBeTruthy();
    });
  });

  test("calls registerUserDevice exactly once", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      expect(api.registerUserDevice).toHaveBeenCalledTimes(1);
    });
  });

  test("calls registerUserDevice with a non-empty string deviceId", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => expect(api.registerUserDevice).toHaveBeenCalled());
    expect(typeof api.registerUserDevice.mock.calls[0][0]).toBe("string");
    expect(api.registerUserDevice.mock.calls[0][0].length).toBeGreaterThan(0);
  });
});

// ─── Spinner while loading ────────────────────────────────────────────────────

describe("CARD-104: RegisterView — spinner while loading", () => {
  test("shows CircularProgress while registerUserDevice is pending", async () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {})); // never resolves
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  test("shows 'Registering device…' text while loading", async () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {}));
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      expect(screen.getByText("Registering device…")).toBeInTheDocument();
    });
  });
});

// ─── API error path ───────────────────────────────────────────────────────────

describe("CARD-104: RegisterView — API error", () => {
  test("shows error alert when registerUserDevice rejects", async () => {
    api.registerUserDevice.mockRejectedValue(new Error("Server error"));
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const errAlert = alerts.find((a) =>
        a.textContent.includes("Registration failed")
      );
      expect(errAlert).toBeTruthy();
    });
  });
});

// ─── Idempotent device ID ─────────────────────────────────────────────────────

describe("CARD-104: RegisterView — idempotent device ID", () => {
  test("uses existing localStorage deviceId instead of generating a new UUID", async () => {
    const existingId = "existing-device-id-abc";
    localStorage.setItem("swarmcode-device-id", existingId);
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      expect(api.registerUserDevice).toHaveBeenCalledWith(existingId);
    });
    expect(global.crypto.randomUUID).not.toHaveBeenCalled();
  });

  test("generates a new UUID and stores it when localStorage has no deviceId", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ user: "qa-1", sessionToken: "r:tok" });

    await waitFor(() => {
      expect(api.registerUserDevice).toHaveBeenCalledWith(MOCK_UUID);
    });
    expect(localStorage.getItem("swarmcode-device-id")).toBe(MOCK_UUID);
  });
});
