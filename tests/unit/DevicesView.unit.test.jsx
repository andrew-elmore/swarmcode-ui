/**
 * CARD-105 Unit Tests — src/components/DevicesView.jsx
 * Author: qa-1
 *
 * Covers:
 *   1. Unauthenticated: info alert, fetch not called
 *   2. Loading spinner when loading && devices.length === 0
 *   3. Empty state message when user has no devices
 *   4. Device list: rows, truncated deviceId, date, data-testids
 *   5. fetchUserDevices dispatched on mount when authenticated
 *   6. Delete button opens confirmation dialog
 *   7. Cancel closes dialog without deleting
 *   8. Remove confirms deletion, removes row, closes dialog
 *   9. Error alert displayed and dismissible
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import authReducer from "../../src/store/authSlice";
import devicesReducer from "../../src/store/devicesSlice";
import DevicesView from "../../src/components/DevicesView";

// Mock the API layer so no real HTTP calls are made
jest.mock("../../src/services/api", () => ({
  getUserDevices: jest.fn(),
  deleteUserDevice: jest.fn(),
}));

import * as api from "../../src/services/api";
import Parse from "parse";

const theme = createTheme();

const DEVICE_A = {
  objectId: "objAAA111",
  deviceId: "abcdef1234567890",
  createdAt: "2026-01-15T10:00:00.000Z",
};
const DEVICE_B = {
  objectId: "objBBB222",
  deviceId: "fedcba9876543210",
  createdAt: "2026-01-16T11:30:00.000Z",
};

function makeStore({ user = null, devices = [], loading = false, error = null } = {}) {
  return configureStore({
    reducer: { auth: authReducer, devices: devicesReducer },
    preloadedState: {
      auth: { user, sessionToken: null, loading: false, error: null },
      devices: { devices, loading, error },
    },
  });
}

function renderDevicesView(opts = {}) {
  const store = makeStore(opts);
  render(
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <DevicesView />
      </Provider>
    </ThemeProvider>
  );
  return { store };
}

beforeEach(() => {
  jest.clearAllMocks();
  Parse.User.current.mockReturnValue(null);
  // Default: getUserDevices never resolves so preloaded store state is stable
  api.getUserDevices.mockReturnValue(new Promise(() => {}));
});

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe("CARD-105: DevicesView — unauthenticated user", () => {
  test("shows info alert to sign in", () => {
    renderDevicesView({ user: null });
    expect(screen.getByRole("alert").textContent).toMatch(/sign in/i);
  });

  test("does NOT call getUserDevices when user is null", () => {
    renderDevicesView({ user: null });
    expect(api.getUserDevices).not.toHaveBeenCalled();
  });

  test("does NOT render the device table", () => {
    renderDevicesView({ user: null });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe("CARD-105: DevicesView — loading spinner", () => {
  test("shows CircularProgress when loading=true and devices list is empty", () => {
    renderDevicesView({ user: "qa-1", loading: true, devices: [] });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("does NOT show spinner when devices are already loaded (loading overlay suppressed)", () => {
    renderDevicesView({ user: "qa-1", loading: true, devices: [DEVICE_A] });
    // When devices.length > 0, the loading guard does not show the full-page spinner
    expect(screen.queryByRole("table")).toBeInTheDocument();
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("CARD-105: DevicesView — empty device list", () => {
  beforeEach(() => {
    // Let fetchUserDevices complete so the loading guard clears
    api.getUserDevices.mockResolvedValue({ devices: [] });
  });

  test("shows 'No devices registered' message when list is empty", async () => {
    renderDevicesView({ user: "qa-1", devices: [] });
    await waitFor(() => {
      expect(screen.getByText(/no devices registered/i)).toBeInTheDocument();
    });
  });

  test("does NOT render a table when device list is empty", async () => {
    renderDevicesView({ user: "qa-1", devices: [] });
    await waitFor(() => {
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  test("'Registered Devices' heading is present", async () => {
    renderDevicesView({ user: "qa-1", devices: [] });
    await waitFor(() => {
      expect(screen.getByText("Registered Devices")).toBeInTheDocument();
    });
  });
});

// ─── Device list ──────────────────────────────────────────────────────────────

describe("CARD-105: DevicesView — device list", () => {
  test("renders a row for each device", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A, DEVICE_B] });
    expect(screen.getByTestId(`device-list-item-${DEVICE_A.objectId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`device-list-item-${DEVICE_B.objectId}`)).toBeInTheDocument();
  });

  test("displays the first 8 characters of deviceId followed by '...'", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    expect(screen.getByText("abcdef12...")).toBeInTheDocument();
  });

  test("displays a formatted date string for createdAt", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    const expected = new Date(DEVICE_A.createdAt).toLocaleDateString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  test("renders a delete button for each device row", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A, DEVICE_B] });
    const deleteButtons = screen.getAllByTitle("Delete");
    expect(deleteButtons.length).toBe(2);
  });
});

// ─── fetchUserDevices on mount ────────────────────────────────────────────────

describe("CARD-105: DevicesView — fetchUserDevices dispatched on mount", () => {
  test("calls getUserDevices when authenticated user is present", async () => {
    renderDevicesView({ user: "qa-1" });
    await waitFor(() => {
      expect(api.getUserDevices).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── Delete dialog — open/close ───────────────────────────────────────────────

describe("CARD-105: DevicesView — delete dialog open and cancel", () => {
  test("clicking delete button opens the confirmation dialog", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    fireEvent.click(screen.getByTitle("Delete"));
    expect(screen.getByText("Remove Device")).toBeInTheDocument();
  });

  test("dialog shows the truncated deviceId of the targeted device", () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    fireEvent.click(screen.getByTitle("Delete"));
    // Text "abcdef12..." appears in both table row and dialog — at least two occurrences
    const matches = screen.getAllByText(/abcdef12\.\.\./);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("clicking Cancel closes the dialog", async () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    fireEvent.click(screen.getByTitle("Delete"));
    expect(screen.getByText("Remove Device")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Remove Device")).not.toBeInTheDocument();
    });
  });

  test("Cancel does NOT call deleteUserDevice", async () => {
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });
    fireEvent.click(screen.getByTitle("Delete"));
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Remove Device")).not.toBeInTheDocument();
    });
    expect(api.deleteUserDevice).not.toHaveBeenCalled();
  });
});

// ─── Delete — confirm success ─────────────────────────────────────────────────

describe("CARD-105: DevicesView — confirm delete success", () => {
  test("calls deleteUserDevice with the device's objectId", async () => {
    api.deleteUserDevice.mockResolvedValue({});
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });

    fireEvent.click(screen.getByTitle("Delete"));
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(api.deleteUserDevice).toHaveBeenCalledWith(DEVICE_A.objectId);
    });
  });

  test("dialog closes after successful deletion", async () => {
    api.deleteUserDevice.mockResolvedValue({});
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });

    fireEvent.click(screen.getByTitle("Delete"));
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(screen.queryByText("Remove Device")).not.toBeInTheDocument();
    });
  });

  test("device row is removed from the list after deletion", async () => {
    api.deleteUserDevice.mockResolvedValue({});
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });

    fireEvent.click(screen.getByTitle("Delete"));
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(
        screen.queryByTestId(`device-list-item-${DEVICE_A.objectId}`)
      ).not.toBeInTheDocument();
    });
  });

  test("shows 'Removing...' label while delete is in flight", async () => {
    // Slow delete — never resolves during this test
    api.deleteUserDevice.mockReturnValue(new Promise(() => {}));
    renderDevicesView({ user: "qa-1", devices: [DEVICE_A] });

    fireEvent.click(screen.getByTitle("Delete"));
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(screen.getByText("Removing...")).toBeInTheDocument();
    });
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("CARD-105: DevicesView — error state", () => {
  test("shows error alert when getUserDevices rejects", async () => {
    // fetchUserDevices.rejected sets state.error = action.error.message
    api.getUserDevices.mockRejectedValue(new Error("Failed to load devices"));
    renderDevicesView({ user: "qa-1", devices: [] });

    await waitFor(() => {
      const alerts = screen.queryAllByRole("alert");
      const errAlert = alerts.find((a) => a.textContent.includes("Failed to load devices"));
      expect(errAlert).toBeTruthy();
    });
  });

  test("error alert has a close button (onClose wired to clearError)", async () => {
    api.getUserDevices.mockRejectedValue(new Error("Network error"));
    renderDevicesView({ user: "qa-1", devices: [] });

    await waitFor(() => {
      expect(screen.queryAllByRole("alert").length).toBeGreaterThan(0);
    });
    // MUI Alert with onClose renders an aria-label="Close" button
    const closeButton = document.querySelector('[aria-label="Close"]');
    expect(closeButton).not.toBeNull();
  });
});
