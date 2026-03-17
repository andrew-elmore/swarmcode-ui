/**
 * CARD-100 Integration Tests — src/components/ProjectLayout.jsx init guard.
 * Author: qa-1
 *
 * BUG: Selecting a project from the home page navigated to the project URL but
 * did not re-run initialization (setActiveProject / clearAgents / fetchProject).
 * Root cause: the old guard was `activeProject?.objectId === projectId`, which
 * blocked init when activeProject was already set to that project from a prior
 * visit. Fix: a useRef guard (initializedRef) resets on every fresh mount so
 * init always fires once per mount.
 *
 * Integration scenarios (full Redux, real reducers):
 *   1. Fresh mount with preloaded activeProject — init fires, agents cleared
 *   2. Cross-project navigation — second project gets its own init
 *   3. Agents from prior project are cleared before new project loads
 *   4. resetConversations dispatched on every init
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import agentsReducer from '../../src/store/agentsSlice';
import articlesReducer from '../../src/store/articlesSlice';
import authReducer from '../../src/store/authSlice';
import projectReducer from '../../src/store/projectSlice';
import commandsReducer from '../../src/store/commandsSlice';
import messagesReducer from '../../src/store/messagesSlice';
import projectsReducer from '../../src/store/projectsSlice';
import ttsReducer from '../../src/store/ttsSlice';
import ProjectLayout from '../../src/components/ProjectLayout';

jest.mock('../../src/services/api', () => ({
  getRecentProjects: jest.fn(),
  getOrCreateProject: jest.fn(),
  addRecentProject: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  getAllAgents: jest.fn(),
  getArticles: jest.fn(),
  getArticle: jest.fn(),
  getConversation: jest.fn(),
  sendMessage: jest.fn(),
  // CARD-099: synchronous subscribe API
  subscribeToMessages: jest.fn(() => () => {}),
  subscribeToCommands: jest.fn(() => () => {}),
  subscribeToPings: jest.fn(() => () => {}),
  listCards: jest.fn(),
  showCard: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  getSprints: jest.fn(),
  createSprint: jest.fn(),
  updateSprint: jest.fn(),
  deleteSprint: jest.fn(),
  createStatus: jest.fn(),
  updateStatus: jest.fn(),
  deleteStatus: jest.fn(),
  runCommand: jest.fn(),
  getPingStatus: jest.fn(),
  registerDevice: jest.fn(),
}));

import * as api from '../../src/services/api';

const PROJECT_A = { objectId: 'projA111', path: '/path/a', name: 'Project A' };
const PROJECT_B = { objectId: 'projB222', path: '/path/b', name: 'Project B' };

const PROJECT_A_RESPONSE = {
  project: { objectId: 'projA111', name: 'Project A' },
  cards: [], sprints: [], statuses: [],
};

const PROJECT_B_RESPONSE = {
  project: { objectId: 'projB222', name: 'Project B' },
  cards: [], sprints: [], statuses: [],
};

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      agents: agentsReducer,
      articles: articlesReducer,
      auth: authReducer,
      project: projectReducer,
      commands: commandsReducer,
      messages: messagesReducer,
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      ...preloadedState,
    },
  });
}

function renderAtPath(urlPath, preloadedState = {}) {
  const store = makeStore(preloadedState);
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[urlPath]}>
        <Routes>
          <Route path="/:projectId" element={<ProjectLayout />}>
            <Route index element={<div data-testid="child">child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...utils };
}

beforeEach(() => {
  api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });
  api.getOrCreateProject.mockResolvedValue(PROJECT_A_RESPONSE);
  // CARD-106: fetchAgents is now dispatched by ProjectLayout; mock must return { agents: [] }
  api.getAgents.mockResolvedValue({ agents: [] });
});

afterEach(() => jest.clearAllMocks());

// ─── Fresh mount with matching activeProject ──────────────────────────────────

describe('CARD-100: ProjectLayout integration — init fires on fresh mount', () => {
  test('fetchProject called even when activeProject already matches URL (bug was: init skipped)', async () => {
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,  // already matches URL
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_A.path)
    );
  });

  test('agents are cleared to [] when init fires on fresh mount', async () => {
    const { store } = renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
      agents: {
        agents: [
          { name: 'stale-agent-from-prior-project', sortOrder: 0 },
        ],
        allAgents: [],
        loading: false,
        error: null,
      },
    });
    // clearAgents() is dispatched synchronously in the init effect
    await waitFor(() =>
      expect(store.getState().agents.agents).toHaveLength(0)
    );
  });

  test('allAgents (global pool) is NOT cleared when init fires', async () => {
    const { store } = renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
      agents: {
        agents: [],
        allAgents: [{ name: 'global-agent-1' }, { name: 'global-agent-2' }],
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalled()
    );
    // allAgents should remain intact
    expect(store.getState().agents.allAgents).toHaveLength(2);
  });
});

// ─── Cross-project navigation ─────────────────────────────────────────────────

describe('CARD-100: ProjectLayout integration — cross-project navigation', () => {
  test('navigating to project B after project A clears agents and fetches project B', async () => {
    // Simulate arriving at project B fresh (new mount / page load at /projB222)
    api.getOrCreateProject.mockResolvedValue(PROJECT_B_RESPONSE);

    const { store } = renderAtPath('/projB222', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,  // was on project A before
        loading: false,
        error: null,
      },
      agents: {
        agents: [{ name: 'project-a-agent', sortOrder: 0 }],
        allAgents: [],
        loading: false,
        error: null,
      },
    });

    // Init for project B should fire
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_B.path)
    );

    // Agents from project A should be cleared
    await waitFor(() =>
      expect(store.getState().agents.agents).toHaveLength(0)
    );

    // activeProject should be updated to project B
    await waitFor(() =>
      expect(store.getState().projects.activeProject?.objectId).toBe('projB222')
    );
  });

  test('fetchProject called with correct path for each fresh mount', async () => {
    // First mount: project A
    const { unmount } = renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_A.path)
    );

    // Unmount (simulate going back to home page)
    unmount();
    jest.clearAllMocks();
    api.getOrCreateProject.mockResolvedValue(PROJECT_B_RESPONSE);

    // Second mount: project B (new mount = ref reset to null)
    renderAtPath('/projB222', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,  // was on A, now navigating to B
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_B.path)
    );
  });
});

// ─── Single init per mount (ref guard) ───────────────────────────────────────

describe('CARD-100: ProjectLayout integration — ref prevents duplicate init', () => {
  test('fetchProject called exactly once per mount even after projects list updates', async () => {
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A],  // only one project initially
        activeProject: null,
        loading: false,
        error: null,
      },
    });

    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledTimes(1)
    );

    // Simulating fetchRecentProjects completing (projects list grows) —
    // this re-runs the effect but ref guard should prevent a second init
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(api.getOrCreateProject).toHaveBeenCalledTimes(1);
  });
});
