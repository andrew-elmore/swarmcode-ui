/**
 * CARD-104 Unit Tests — src/components/RegisterView.jsx (re-scope)
 * Author: qa-1
 *
 * Re-scope: deviceId now comes from URL query params (?deviceId=...) via
 * useSearchParams, NOT localStorage/crypto.randomUUID.
 *
 * Covers:
 *   1. Missing deviceId in URL → missing_device error alert
 *   2. Unauthenticated user → warning alert, registerUserDevice never called
 *   3. Authenticated + deviceId → success alert after resolve
 *   4. Spinner shown while registerUserDevice is pending
 *   5. API error → error alert
 *   6. registerUserDevice called with the exact deviceId from URL
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material";
import authReducer from "../../src/store/authSlice";
import RegisterView from "../../src/components/RegisterView";

// Mock the API layer — registerUserDevice must not make real HTTP calls
jest.mock("../../src/services/api", () => ({
  registerUserDevice: jest.fn(),
}));

import * as api from "../../src/services/api";

// Parse is mocked globally via tests/__mocks__/parseMock.cjs
// Parse.User.current() returns null → restoreSession fulfills with null payload
// The reducer does NOT overwrite a preloaded user when payload is null.
import Parse from "parse";

const theme = createTheme();

const TEST_DEVICE_ID = "test-device-uuid-abc123";

beforeEach(() => {
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

/**
 * Render RegisterView inside MemoryRouter so useSearchParams works.
 * @param {object} opts
 * @param {object} [opts.authState] - Preloaded auth state.
 * @param {string|null} [opts.deviceId] - deviceId to include in URL query params.
 *   Pass null to render without any deviceId param.
 */
function renderRegisterView({ authState = {}, deviceId = TEST_DEVICE_ID } = {}) {
  const initialEntries = deviceId
    ? [`/register?deviceId=${encodeURIComponent(deviceId)}`]
    : ["/register"];
  const store = makeStore(authState);
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider theme={theme}>
        <Provider store={store}>
          <RegisterView />
        </Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
  return { store };
}

// ─── Static content ───────────────────────────────────────────────────────────

describe("RegisterView — static content", () => {
  test("renders 'Device Registration' heading", () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {}));
    renderRegisterView({ authState: { user: "qa-1" } });
    expect(screen.getByText("Device Registration")).toBeInTheDocument();
  });
});

// ─── Missing deviceId in URL ─────────────────────────────────────────────────

describe("CARD-104: RegisterView — missing deviceId in URL", () => {
  test("shows error alert when deviceId is absent from URL", async () => {
    renderRegisterView({ authState: { user: "qa-1" }, deviceId: null });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/Invalid registration link/i);
  });

  test("does NOT call registerUserDevice when deviceId is missing from URL", async () => {
    renderRegisterView({ authState: { user: "qa-1" }, deviceId: null });
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(api.registerUserDevice).not.toHaveBeenCalled();
  });
});

// ─── Unauthenticated user ─────────────────────────────────────────────────────

describe("CARD-104: RegisterView — unauthenticated user", () => {
  test("shows warning alert when user is not logged in", async () => {
    renderRegisterView({ authState: { user: null } });
    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const warning = alerts.find((a) => a.textContent.includes("must be signed in"));
      expect(warning).toBeTruthy();
    });
  });

  test("does NOT call registerUserDevice when user is not logged in", async () => {
    renderRegisterView({ authState: { user: null } });
    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      expect(alerts.some((a) => a.textContent.includes("must be signed in"))).toBe(true);
    });
    expect(api.registerUserDevice).not.toHaveBeenCalled();
  });
});

// ─── Authenticated user — success ─────────────────────────────────────────────

describe("CARD-104: RegisterView — authenticated user, success", () => {
  test("shows success alert after registerUserDevice resolves", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const success = alerts.find((a) =>
        a.textContent.includes("Device registered successfully")
      );
      expect(success).toBeTruthy();
    });
  });

  test("calls registerUserDevice with the deviceId from URL query param", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => {
      expect(api.registerUserDevice).toHaveBeenCalledWith(TEST_DEVICE_ID);
    });
  });

  test("calls registerUserDevice exactly once", async () => {
    api.registerUserDevice.mockResolvedValue({ registered: true });
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => expect(api.registerUserDevice).toHaveBeenCalledTimes(1));
  });
});

// ─── Spinner while loading ────────────────────────────────────────────────────

describe("CARD-104: RegisterView — spinner while loading", () => {
  test("shows CircularProgress while registerUserDevice is pending", async () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {})); // never resolves
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  test("shows 'Registering device…' text while loading", async () => {
    api.registerUserDevice.mockReturnValue(new Promise(() => {}));
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => {
      expect(screen.getByText("Registering device…")).toBeInTheDocument();
    });
  });
});

// ─── API error path ───────────────────────────────────────────────────────────

describe("CARD-104: RegisterView — API error", () => {
  test("shows error alert when registerUserDevice rejects", async () => {
    api.registerUserDevice.mockRejectedValue(new Error("Server error"));
    renderRegisterView({ authState: { user: "qa-1", sessionToken: "r:tok" } });
    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const errAlert = alerts.find((a) =>
        a.textContent.includes("Registration failed")
      );
      expect(errAlert).toBeTruthy();
    });
  });
});
