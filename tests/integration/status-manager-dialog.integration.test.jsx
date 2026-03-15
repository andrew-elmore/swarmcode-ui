/**
 * CARD-001: CRUD for Board Statuses
 * Integration tests for StatusManagerDialog with Redux store.
 * Tests create/edit/delete flows using mocked API and real Redux reducers.
 */

import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../../src/services/api";
import agentsReducer from "../../src/store/agentsSlice";
import articlesReducer from "../../src/store/articlesSlice";
import projectReducer from "../../src/store/projectSlice";
import messagesReducer from "../../src/store/messagesSlice";
import projectsReducer from "../../src/store/projectsSlice";
import ttsReducer from "../../src/store/ttsSlice";
import StatusManagerDialog from "../../src/components/StatusManagerDialog";

jest.mock("../../src/services/api", () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  subscribeToMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  createSprint: jest.fn(),
  getSprints: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
  createStatus: jest.fn(),
  updateStatus: jest.fn(),
  deleteStatus: jest.fn(),
}));

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, secondary: { main: "#9c27b0" } },
});

const PROJECT_ID = "proj-test-123";

const MOCK_AGENTS = [
  { name: "pm-1", description: "Project manager" },
  { name: "developer-1", description: "Developer" },
  { name: "qa-1", description: "QA engineer" },
];

const MOCK_STATUSES = [
  {
    objectId: "st1", name: "create", agentName: "pm-1",
    description: "Initial creation", instructions: "Create card", order: 0,
  },
  {
    objectId: "st2", name: "implement", agentName: "developer-1",
    description: "Implementation phase", instructions: "Write the code", order: 1,
  },
  {
    objectId: "st3", name: "done", agentName: null,
    description: "Completed", instructions: "Mark done", order: 2,
  },
];

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      project: projectReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      agents: { agents: MOCK_AGENTS, allAgents: [], loading: false, error: null },
      ...preloadedState,
    },
  });
}

function makeProjectState(statusOverride = []) {
  return {
    project: {
      project: { objectId: PROJECT_ID },
      cards: [],
      sprints: [],
      statuses: statusOverride,
      sprintFilter: null,
      selectedCard: null,
      loading: false,
      error: null,
      lastPoll: null,
    },
  };
}

function renderDialog(propOverrides = {}, storeState = {}) {
  const store = createTestStore(storeState);
  const onClose = jest.fn();
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <StatusManagerDialog
          open={true}
          onClose={onClose}
          projectId={PROJECT_ID}
          {...propOverrides}
        />
      </ThemeProvider>
    </Provider>
  );
  return { store, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.createStatus.mockResolvedValue({
    status: { objectId: "st-new", name: "New Status", agentName: "qa-1", order: 0 },
  });
  api.updateStatus.mockResolvedValue({
    status: { objectId: "st1", name: "Updated", agentName: "pm-1", order: 0 },
  });
  api.deleteStatus.mockResolvedValue({ cardsUpdated: 0 });
});

// ─── Create form ─────────────────────────────────────────────────────────────

describe("CARD-001: StatusManagerDialog — create form", () => {
  test("renders dialog with all required form fields", () => {
    renderDialog();
    expect(screen.getByTestId("status-manager-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-name")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-description")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-instructions")).toBeInTheDocument();
    expect(screen.getByTestId("status-new-agent")).toBeInTheDocument();
    expect(screen.getByTestId("status-add-button")).toBeInTheDocument();
  });

  test("Add button is disabled when form is empty", () => {
    renderDialog();
    expect(screen.getByTestId("status-add-button")).toBeDisabled();
  });

  test("Add button is disabled when only name is filled", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "My Status"
    );
    expect(screen.getByTestId("status-add-button")).toBeDisabled();
  });

  test("Add button is enabled when all required fields are filled", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "My Status"
    );
    await user.type(
      screen.getByTestId("status-new-description").querySelector("input"),
      "A clear description"
    );
    await user.type(
      screen.getByTestId("status-new-instructions").querySelector("textarea"),
      "Do this step carefully"
    );
    // MUI Select requires mouseDown to open the listbox
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /agent/i }));
    await waitFor(() => screen.getByRole("option", { name: "pm-1" }));
    fireEvent.click(screen.getByRole("option", { name: "pm-1" }));

    expect(screen.getByTestId("status-add-button")).toBeEnabled();
  });

  test("dispatches createStatus with correct args on Add click", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([]));

    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "My Status"
    );
    await user.type(
      screen.getByTestId("status-new-description").querySelector("input"),
      "Good description"
    );
    await user.type(
      screen.getByTestId("status-new-instructions").querySelector("textarea"),
      "Follow these steps"
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /agent/i }));
    await waitFor(() => screen.getByRole("option", { name: "qa-1" }));
    fireEvent.click(screen.getByRole("option", { name: "qa-1" }));

    await user.click(screen.getByTestId("status-add-button"));

    await waitFor(() => {
      expect(api.createStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          name: "My Status",
          description: "Good description",
          instructions: "Follow these steps",
          agentName: "qa-1",
          order: 0,
        })
      );
    });
  });

  test("form resets after successful create", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([]));

    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "Temp Status"
    );
    await user.type(
      screen.getByTestId("status-new-description").querySelector("input"),
      "Temp description"
    );
    await user.type(
      screen.getByTestId("status-new-instructions").querySelector("textarea"),
      "Temp instructions"
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /agent/i }));
    await waitFor(() => screen.getByRole("option", { name: "pm-1" }));
    fireEvent.click(screen.getByRole("option", { name: "pm-1" }));

    await user.click(screen.getByTestId("status-add-button"));

    await waitFor(() => {
      expect(api.createStatus).toHaveBeenCalled();
    });

    // Form should be cleared
    expect(screen.getByTestId("status-new-name").querySelector("input").value).toBe("");
  });
});

// ─── Status list ─────────────────────────────────────────────────────────────

describe("CARD-001: StatusManagerDialog — status list", () => {
  test("shows empty state message when no statuses exist", () => {
    renderDialog();
    expect(screen.getByText("No statuses yet. Create one above.")).toBeInTheDocument();
  });

  test("renders statuses sorted by order", () => {
    // Provide statuses out of order — they should render sorted
    const unsorted = [MOCK_STATUSES[2], MOCK_STATUSES[0], MOCK_STATUSES[1]];
    renderDialog({}, makeProjectState(unsorted));

    const items = screen.getAllByTestId("status-list-item");
    expect(items).toHaveLength(3);
    // order 0 = "create" should be first
    expect(within(items[0]).getByText("create")).toBeInTheDocument();
    // order 2 = "done" should be last
    expect(within(items[2]).getByText("done")).toBeInTheDocument();
  });

  test("shows agentName next to status name when present", () => {
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));
    expect(screen.getByText("[pm-1]")).toBeInTheDocument();
  });

  test("does not show agent label when agentName is null", () => {
    renderDialog({}, makeProjectState([MOCK_STATUSES[2]]));
    // done status has agentName: null — no bracket label
    expect(screen.queryByText(/\[/)).not.toBeInTheDocument();
  });
});

// ─── Edit flow ───────────────────────────────────────────────────────────────

describe("CARD-001: StatusManagerDialog — edit flow", () => {
  test("clicking a status row enters edit mode", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByText("create"));

    expect(screen.getByTestId("status-edit-name")).toBeInTheDocument();
    expect(screen.getByTestId("status-edit-description")).toBeInTheDocument();
    expect(screen.getByTestId("status-edit-instructions")).toBeInTheDocument();
  });

  test("edit form is pre-populated with existing values", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByText("create"));

    expect(screen.getByTestId("status-edit-name").querySelector("input").value).toBe("create");
    expect(screen.getByTestId("status-edit-description").querySelector("input").value).toBe("Initial creation");
  });

  test("Save dispatches updateStatus with only changed fields", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByText("create"));

    const nameInput = screen.getByTestId("status-edit-name").querySelector("input");
    await user.clear(nameInput);
    await user.type(nameInput, "renamed");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          statusId: "st1",
          name: "renamed",
        })
      );
    });
  });

  test("Save does not dispatch updateStatus when nothing changed", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByText("create"));

    // Click Save without changing anything
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateStatus).not.toHaveBeenCalled();
    });
  });

  test("Cancel exits edit mode without calling updateStatus", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByText("create"));
    expect(screen.getByTestId("status-edit-name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.updateStatus).not.toHaveBeenCalled();
    expect(screen.queryByTestId("status-edit-name")).not.toBeInTheDocument();
  });
});

// ─── Delete flow ─────────────────────────────────────────────────────────────

describe("CARD-001: StatusManagerDialog — delete flow", () => {
  test("dispatches deleteStatus after window.confirm approval", async () => {
    const user = userEvent.setup();
    jest.spyOn(window, "confirm").mockReturnValueOnce(true);

    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByTestId("status-delete"));

    await waitFor(() => {
      expect(api.deleteStatus).toHaveBeenCalledWith(PROJECT_ID, "st1");
    });
  });

  test("does not dispatch deleteStatus when confirm is cancelled", async () => {
    const user = userEvent.setup();
    jest.spyOn(window, "confirm").mockReturnValueOnce(false);

    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByTestId("status-delete"));

    expect(api.deleteStatus).not.toHaveBeenCalled();
  });

  test("confirm dialog message includes the status name", async () => {
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValueOnce(false);

    renderDialog({}, makeProjectState([MOCK_STATUSES[0]]));

    await user.click(screen.getByTestId("status-delete"));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("create")
    );
  });
});

// ─── CARD-094: monitor field in StatusManagerDialog ──────────────────────────

const STATUS_WITH_MONITOR = {
  objectId: "st-m1",
  name: "implement",
  agentName: "developer-1",
  description: "Implementation phase",
  instructions: "Write the code",
  order: 1,
  monitor: true,
};

const STATUS_WITHOUT_MONITOR = {
  objectId: "st-m2",
  name: "review",
  agentName: "qa-1",
  description: "Review phase",
  instructions: "Review carefully",
  order: 2,
  monitor: false,
};

describe("CARD-094: StatusManagerDialog — monitor toggle (create form)", () => {
  test("status-new-monitor Switch renders and is unchecked by default", () => {
    renderDialog();
    const switchEl = screen.getByTestId("status-new-monitor");
    expect(switchEl).toBeInTheDocument();
    const checkbox = switchEl.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
  });

  test("toggling status-new-monitor checks the switch", async () => {
    const user = userEvent.setup();
    renderDialog();
    const checkbox = screen
      .getByTestId("status-new-monitor")
      .querySelector('input[type="checkbox"]');
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  test("createStatus dispatched with monitor: true when switch is on", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([]));

    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "Monitored Step"
    );
    await user.type(
      screen.getByTestId("status-new-description").querySelector("input"),
      "Step description"
    );
    await user.type(
      screen.getByTestId("status-new-instructions").querySelector("textarea"),
      "Do this step"
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /agent/i }));
    await waitFor(() => screen.getByRole("option", { name: "pm-1" }));
    fireEvent.click(screen.getByRole("option", { name: "pm-1" }));

    // Toggle monitor ON
    const checkbox = screen
      .getByTestId("status-new-monitor")
      .querySelector('input[type="checkbox"]');
    await user.click(checkbox);

    await user.click(screen.getByTestId("status-add-button"));

    await waitFor(() => {
      expect(api.createStatus).toHaveBeenCalledWith(
        expect.objectContaining({ monitor: true })
      );
    });
  });

  test("createStatus dispatched with monitor: false when switch is off (default)", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([]));

    await user.type(
      screen.getByTestId("status-new-name").querySelector("input"),
      "Plain Step"
    );
    await user.type(
      screen.getByTestId("status-new-description").querySelector("input"),
      "Step description"
    );
    await user.type(
      screen.getByTestId("status-new-instructions").querySelector("textarea"),
      "Do this step"
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /agent/i }));
    await waitFor(() => screen.getByRole("option", { name: "pm-1" }));
    fireEvent.click(screen.getByRole("option", { name: "pm-1" }));

    // Leave monitor switch OFF (default)
    await user.click(screen.getByTestId("status-add-button"));

    await waitFor(() => {
      expect(api.createStatus).toHaveBeenCalledWith(
        expect.objectContaining({ monitor: false })
      );
    });
  });
});

describe("CARD-094: StatusManagerDialog — monitor badge in status list", () => {
  test("[monitor] badge is shown when status.monitor is true", () => {
    renderDialog({}, makeProjectState([STATUS_WITH_MONITOR]));
    expect(screen.getByText("[monitor]")).toBeInTheDocument();
  });

  test("[monitor] badge is absent when status.monitor is false", () => {
    renderDialog({}, makeProjectState([STATUS_WITHOUT_MONITOR]));
    expect(screen.queryByText("[monitor]")).not.toBeInTheDocument();
  });

  test("[monitor] badge absent when monitor field is undefined (legacy status)", () => {
    const legacyStatus = {
      objectId: "st-legacy",
      name: "old-step",
      agentName: "pm-1",
      description: "Old step",
      instructions: "Do it",
      order: 0,
      // no monitor field
    };
    renderDialog({}, makeProjectState([legacyStatus]));
    expect(screen.queryByText("[monitor]")).not.toBeInTheDocument();
  });
});

describe("CARD-094: StatusManagerDialog — monitor toggle (edit form)", () => {
  test("status-edit-monitor Switch renders with monitor: true when status has monitor: true", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([STATUS_WITH_MONITOR]));

    await user.click(screen.getByText("implement"));

    const editSwitch = screen.getByTestId("status-edit-monitor");
    expect(editSwitch).toBeInTheDocument();
    const checkbox = editSwitch.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
  });

  test("status-edit-monitor Switch renders unchecked when status has monitor: false", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([STATUS_WITHOUT_MONITOR]));

    await user.click(screen.getByText("review"));

    const editSwitch = screen.getByTestId("status-edit-monitor");
    const checkbox = editSwitch.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
  });

  test("toggling monitor OFF in edit dispatches updateStatus with monitor: false", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([STATUS_WITH_MONITOR]));

    await user.click(screen.getByText("implement"));

    // Toggle monitor OFF (it starts as true)
    const checkbox = screen
      .getByTestId("status-edit-monitor")
      .querySelector('input[type="checkbox"]');
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ monitor: false })
      );
    });
  });

  test("no updateStatus dispatch when monitor is unchanged in edit", async () => {
    const user = userEvent.setup();
    renderDialog({}, makeProjectState([STATUS_WITH_MONITOR]));

    await user.click(screen.getByText("implement"));

    // Save without changing anything
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateStatus).not.toHaveBeenCalled();
    });
  });
});
