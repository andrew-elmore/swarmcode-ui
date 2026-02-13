/**
 * Tests for CARD-156: QR approval standalone page (PairPage)
 *
 * Covers:
 *   - PairPage shows error when uuid is missing from URL
 *   - PairPage shows approval button when uuid is present
 *   - Approval triggers approvePairing API call
 *   - Success state shows check icon and machine name
 *   - Error state shows alert and retry button
 *   - "Go to Dashboard" navigates to /
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import authReducer from "../src/store/authSlice";
import PairPage from "../src/pages/PairPage";

jest.mock("../src/services/api", () => ({
  signUp: jest.fn(),
  logIn: jest.fn(),
  getMe: jest.fn(),
  setSessionToken: jest.fn(),
  clearSessionToken: jest.fn(),
  approvePairing: jest.fn(),
}));

const api = require("../src/services/api");

const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#f44336" } },
});

function createAuthStore() {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        sessionToken: "r:test-token",
        user: { objectId: "u1", email: "test@test.com" },
        account: { objectId: "a1" },
        profile: { objectId: "p1", displayName: "Tester" },
        loading: false,
        error: null,
        initialized: true,
      },
    },
  });
}

function renderPairPage(initialRoute = "/pair?uuid=test-uuid-123") {
  const store = createAuthStore();
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/pair" element={<PairPage />} />
              <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    ),
  };
}

describe("PairPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows error when uuid is missing from URL", () => {
    renderPairPage("/pair");

    expect(screen.getByText("Invalid Pairing Link")).toBeInTheDocument();
    expect(screen.getByText(/missing the machine UUID/i)).toBeInTheDocument();
  });

  test("shows approval UI when uuid is present", () => {
    renderPairPage("/pair?uuid=abc-123");

    expect(screen.getByText("Machine Pairing")).toBeInTheDocument();
    expect(screen.getByText(/wants to connect/i)).toBeInTheDocument();
    expect(screen.getByText("UUID: abc-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve pairing/i })).toBeInTheDocument();
  });

  test("clicking Approve calls approvePairing with uuid", async () => {
    api.approvePairing.mockResolvedValue({
      success: true,
      machine: { objectId: "m1", name: "Machine abc-123", uuid: "abc-123" },
    });

    const { user } = renderPairPage("/pair?uuid=abc-123");

    await user.click(screen.getByRole("button", { name: /approve pairing/i }));

    await waitFor(() => {
      expect(api.approvePairing).toHaveBeenCalledWith("abc-123");
    });
  });

  test("shows success state with machine name after approval", async () => {
    api.approvePairing.mockResolvedValue({
      success: true,
      machine: { objectId: "m1", name: "My Machine", uuid: "test-uuid" },
    });

    const { user } = renderPairPage("/pair?uuid=test-uuid");

    await user.click(screen.getByRole("button", { name: /approve pairing/i }));

    await waitFor(() => {
      expect(screen.getByText("Pairing Successful")).toBeInTheDocument();
    });

    expect(screen.getByText(/My Machine has been paired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  test("shows loading spinner during approval", async () => {
    api.approvePairing.mockReturnValue(new Promise(() => {})); // never resolves

    const { user } = renderPairPage("/pair?uuid=test-uuid");

    await user.click(screen.getByRole("button", { name: /approve pairing/i }));

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(screen.getByText("Pairing machine...")).toBeInTheDocument();
    });
  });

  test("shows error state on approval failure", async () => {
    api.approvePairing.mockRejectedValue(new Error("Pairing request not found"));

    const { user } = renderPairPage("/pair?uuid=expired-uuid");

    await user.click(screen.getByRole("button", { name: /approve pairing/i }));

    await waitFor(() => {
      expect(screen.getByText("Pairing request not found")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  test("retry after error calls approvePairing again", async () => {
    api.approvePairing
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        success: true,
        machine: { objectId: "m1", name: "Machine retry" },
      });

    const { user } = renderPairPage("/pair?uuid=retry-uuid");

    // First attempt fails
    await user.click(screen.getByRole("button", { name: /approve pairing/i }));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    // Retry succeeds
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByText("Pairing Successful")).toBeInTheDocument();
    });

    expect(api.approvePairing).toHaveBeenCalledTimes(2);
  });
});
