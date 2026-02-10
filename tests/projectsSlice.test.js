/**
 * Tests for store/projectsSlice.js — Redux slice for projects state.
 * API calls are mocked at the services/api module level.
 */

import { configureStore } from "@reduxjs/toolkit";
import * as api from "../src/services/api";
import projectsReducer, { fetchRecentProjects, addRecentProject, setActiveProject, clearError, deleteProject } from "../src/store/projectsSlice";

jest.mock("../src/services/api", () => ({
  getOrCreateBoard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  pollBoard: jest.fn(),
  sendMessage: jest.fn(),
  pollMessages: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
}));

function createTestStore(preloadedState) {
  return configureStore({
    reducer: { projects: projectsReducer },
    preloadedState: preloadedState
      ? { projects: { ...projectsReducer(undefined, { type: "@@INIT" }), ...preloadedState } }
      : undefined,
  });
}

afterEach(() => jest.restoreAllMocks());

// ─── Initial State ───────────────────────────────────────────────────────────

describe("projectsSlice initial state", () => {
  test("has correct default values", () => {
    const store = createTestStore();
    const state = store.getState().projects;
    expect(state.projects).toEqual([]);
    expect(state.activeProject).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── Synchronous Reducers ────────────────────────────────────────────────────

describe("projectsSlice reducers", () => {
  test("setActiveProject sets the active project", () => {
    const project = { path: "C:\\test", name: "test" };
    const store = createTestStore();
    store.dispatch(setActiveProject(project));
    expect(store.getState().projects.activeProject).toEqual(project);
  });

  test("clearError resets error to null", () => {
    const store = createTestStore({ error: "Load failed" });
    store.dispatch(clearError());
    expect(store.getState().projects.error).toBeNull();
  });
});

// ─── fetchRecentProjects ─────────────────────────────────────────────────────

describe("fetchRecentProjects thunk", () => {
  test("populates projects array on fulfilled", async () => {
    const projects = [
      { path: "C:\\proj1", name: "proj1", lastOpened: "2026-02-07" },
      { path: "C:\\proj2", name: "proj2", lastOpened: "2026-02-06" },
    ];
    api.getRecentProjects.mockResolvedValue({ projects });

    const store = createTestStore();
    await store.dispatch(fetchRecentProjects());

    const state = store.getState().projects;
    expect(state.loading).toBe(false);
    expect(state.projects).toEqual(projects);
    expect(state.error).toBeNull();
  });

  test("sets error on rejected", async () => {
    api.getRecentProjects.mockRejectedValue(new Error("Server down"));

    const store = createTestStore();
    await store.dispatch(fetchRecentProjects());

    const state = store.getState().projects;
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Server down");
  });
});

// ─── addRecentProject ────────────────────────────────────────────────────────

describe("addRecentProject thunk", () => {
  test("prepends new project to list on fulfilled", async () => {
    api.addRecentProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [{ path: "C:\\old", name: "old", lastOpened: "2026-02-01" }],
    });
    await store.dispatch(addRecentProject({ path: "C:\\new", name: "new" }));

    const projects = store.getState().projects.projects;
    expect(projects).toHaveLength(2);
    expect(projects[0].path).toBe("C:\\new");
    expect(projects[0].name).toBe("new");
  });

  test("updates existing project name and lastOpened if path matches", async () => {
    api.addRecentProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [{ path: "C:\\proj", name: "OldName", lastOpened: "2026-02-01" }],
    });
    await store.dispatch(addRecentProject({ path: "C:\\proj", name: "NewName" }));

    const projects = store.getState().projects.projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("NewName");
  });

  test("sets error on rejected", async () => {
    api.addRecentProject.mockRejectedValue(new Error("Path is required"));

    const store = createTestStore();
    await store.dispatch(addRecentProject({ path: "", name: "bad" }));

    expect(store.getState().projects.error).toBe("Path is required");
  });
});

// ─── deleteProject ──────────────────────────────────────────────────────────

describe("deleteProject thunk", () => {
  test("removes the project from the list on fulfilled", async () => {
    api.deleteProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [
        { path: "C:\\proj1", name: "proj1", lastOpened: "2026-02-07" },
        { path: "C:\\proj2", name: "proj2", lastOpened: "2026-02-06" },
      ],
    });
    await store.dispatch(deleteProject({ path: "C:\\proj1" }));

    const projects = store.getState().projects.projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].path).toBe("C:\\proj2");
  });

  test("switches activeProject to next project when active is deleted", async () => {
    api.deleteProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [
        { path: "C:\\active", name: "active", lastOpened: "2026-02-07" },
        { path: "C:\\other", name: "other", lastOpened: "2026-02-06" },
      ],
      activeProject: { path: "C:\\active", name: "active" },
    });
    await store.dispatch(deleteProject({ path: "C:\\active" }));

    const state = store.getState().projects;
    expect(state.projects).toHaveLength(1);
    expect(state.activeProject).toEqual(state.projects[0]);
  });

  test("sets activeProject to null when last project is deleted", async () => {
    api.deleteProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [{ path: "C:\\only", name: "only", lastOpened: "2026-02-07" }],
      activeProject: { path: "C:\\only", name: "only" },
    });
    await store.dispatch(deleteProject({ path: "C:\\only" }));

    const state = store.getState().projects;
    expect(state.projects).toHaveLength(0);
    expect(state.activeProject).toBeNull();
  });

  test("does not change activeProject when non-active project is deleted", async () => {
    api.deleteProject.mockResolvedValue({ success: true });

    const store = createTestStore({
      projects: [
        { path: "C:\\active", name: "active", lastOpened: "2026-02-07" },
        { path: "C:\\other", name: "other", lastOpened: "2026-02-06" },
      ],
      activeProject: { path: "C:\\active", name: "active" },
    });
    await store.dispatch(deleteProject({ path: "C:\\other" }));

    const state = store.getState().projects;
    expect(state.activeProject).toEqual({ path: "C:\\active", name: "active" });
    expect(state.projects).toHaveLength(1);
  });

  test("sets error on rejected", async () => {
    api.deleteProject.mockRejectedValue(new Error("Project not found"));

    const store = createTestStore();
    await store.dispatch(deleteProject({ path: "C:\\bad" }));

    expect(store.getState().projects.error).toBe("Project not found");
  });

  test("does not remove project from list on rejected (failed delete)", async () => {
    api.deleteProject.mockRejectedValue(new Error("Server error"));

    const store = createTestStore({
      projects: [
        { path: "C:\\proj1", name: "proj1", lastOpened: "2026-02-07" },
        { path: "C:\\proj2", name: "proj2", lastOpened: "2026-02-06" },
      ],
    });
    await store.dispatch(deleteProject({ path: "C:\\proj1" }));

    const state = store.getState().projects;
    expect(state.projects).toHaveLength(2);
    expect(state.error).toBe("Server error");
  });
});
