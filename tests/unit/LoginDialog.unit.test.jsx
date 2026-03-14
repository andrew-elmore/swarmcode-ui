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

// ─── CARD-088: Sign Up mode ────────────────────────────────────────────────────

describe("LoginDialog — Sign Up mode", () => {
  test("clicking 'Don't have an account? Sign Up' switches dialog title to 'Sign Up'", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));
    expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
  });

  test("First Name, Last Name, Account Name fields visible in Sign Up mode", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
  });

  test("First Name, Last Name, Account Name fields NOT visible in Sign In mode", () => {
    renderDialog();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account name/i)).not.toBeInTheDocument();
  });

  test("clicking 'Already have an account? Sign In' switches back to Sign In", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));
    expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /already have an account/i }));
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  });

  test("submit in Sign Up mode dispatches createAccount with all 5 params", async () => {
    Parse.Cloud.run.mockResolvedValue({});
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "alice",
      getSessionToken: () => "r:tok-signup",
    });

    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Pass1!" } });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: "Acme" } });

    const signUpBtn = screen.getAllByRole("button").find((b) => b.textContent === "Sign Up");
    fireEvent.click(signUpBtn);

    await waitFor(() =>
      expect(Parse.Cloud.run).toHaveBeenCalledWith("createAccount", {
        username: "alice",
        password: "Pass1!",
        firstName: "Alice",
        lastName: "Smith",
        accountName: "Acme",
      })
    );
  });

  test("calls onClose after successful sign-up", async () => {
    Parse.Cloud.run.mockResolvedValue({});
    Parse.User.logIn.mockResolvedValue({
      getUsername: () => "alice",
      getSessionToken: () => "r:tok-signup",
    });

    const onClose = jest.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Pass1!" } });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: "Acme" } });

    const signUpBtn = screen.getAllByRole("button").find((b) => b.textContent === "Sign Up");
    fireEvent.click(signUpBtn);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

// ─── CARD-088: Submit button text ─────────────────────────────────────────────

describe("LoginDialog — submit button text", () => {
  test("shows 'Sign Up' (not 'Sign In') when in sign-up mode with loading=false", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));
    const buttons = screen.getAllByRole("button");
    expect(buttons.some((b) => b.textContent === "Sign Up")).toBe(true);
    expect(buttons.every((b) => b.textContent !== "Sign In")).toBe(true);
  });

  test("shows 'Signing up…' when in sign-up mode with loading=true", () => {
    renderDialog({}, { loading: true });
    fireEvent.click(screen.getByRole("button", { name: /don't have an account/i }));
    expect(screen.getByText("Signing up…")).toBeInTheDocument();
  });
});
