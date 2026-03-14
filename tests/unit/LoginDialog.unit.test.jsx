/**
 * CARD-081 Unit Tests — src/components/LoginDialog.jsx
 * Component render and interaction tests with a minimal Redux store.
 * Parse.User.logIn is mocked so no real network calls are made.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import authReducer from "../../src/store/authSlice";
import LoginDialog from "../../src/components/LoginDialog";

// Parse is mocked globally via tests/__mocks__/parseMock.cjs (includes User.logIn/logOut/current)
import Parse from "parse";

const theme = createTheme();

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

function renderDialog(props = {}, authState = {}) {
  const store = makeStore(authState);
  const onClose = props.onClose || jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <LoginDialog open={props.open !== undefined ? props.open : true} onClose={onClose} />
      </Provider>
    </ThemeProvider>
  );
  return { store, onClose };
}

afterEach(() => jest.clearAllMocks());

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("LoginDialog — rendering", () => {
  test("renders dialog title 'Sign In'", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  });

  test("renders Username text field", () => {
    renderDialog();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  test("renders Password text field", () => {
    renderDialog();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test("password field is type='password'", () => {
    renderDialog();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
  });

  test("renders Sign In submit button", () => {
    renderDialog();
    const buttons = screen.getAllByRole("button");
    const signInBtn = buttons.find((b) => b.textContent === "Sign In");
    expect(signInBtn).toBeTruthy();
  });

  test("renders Cancel button", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  test("does not render when open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });
});

// ─── Error display ─────────────────────────────────────────────────────────────

describe("LoginDialog — error state", () => {
  test("shows error alert when auth.error is set", () => {
    renderDialog({}, { error: "Invalid username/password." });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Invalid username/password.")).toBeInTheDocument();
  });

  test("does not show alert when auth.error is null", () => {
    renderDialog();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ─── Loading state ─────────────────────────────────────────────────────────────

describe("LoginDialog — loading state", () => {
  test("Sign In button shows 'Signing in…' when loading=true", () => {
    renderDialog({}, { loading: true });
    expect(screen.getByText("Signing in…")).toBeInTheDocument();
  });

  test("Sign In button is disabled when loading=true", () => {
    renderDialog({}, { loading: true });
    const btn = screen.getByText("Signing in…").closest("button");
    expect(btn).toBeDisabled();
  });

  test("Sign In button is enabled when loading=false", () => {
    renderDialog();
    const buttons = screen.getAllByRole("button");
    const signInBtn = buttons.find((b) => b.textContent === "Sign In");
    expect(signInBtn).not.toBeDisabled();
  });
});

// ─── Submit behaviour ─────────────────────────────────────────────────────────

describe("LoginDialog — form submission", () => {
  test("dispatches loginUser with username and password on Sign In click", async () => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "pm-1",
      getSessionToken: () => "r:tok-abc",
    });

    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "pm-1" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });

    const buttons = screen.getAllByRole("button");
    const signInBtn = buttons.find((b) => b.textContent === "Sign In");
    fireEvent.click(signInBtn);

    await waitFor(() =>
      expect(Parse.User.logIn).toHaveBeenCalledWith("pm-1", "secret")
    );
  });

  test("calls onClose after successful login", async () => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "pm-1",
      getSessionToken: () => "r:tok-abc",
    });

    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "pm-1" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons.find((b) => b.textContent === "Sign In"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("submits on Enter key press in the password field", async () => {
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "qa-1",
      getSessionToken: () => "r:tok-qa",
    });

    renderDialog();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "qa-1" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.keyDown(screen.getByLabelText(/password/i), { key: "Enter" });

    await waitFor(() =>
      expect(Parse.User.logIn).toHaveBeenCalledWith("qa-1", "pass")
    );
  });
});

// ─── Cancel behaviour ─────────────────────────────────────────────────────────

describe("LoginDialog — cancel behaviour", () => {
  test("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
