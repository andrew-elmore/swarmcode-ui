/**
 * CARD-089 Unit Tests — src/components/ProjectLayout.jsx
 *
 * Tests URL param → Redux sync:
 *   - fetchRecentProjects dispatched when projects list is empty
 *   - setActiveProject + resetConversations + fetchProject dispatched when
 *     URL projectId matches a known project and activeProject differs
 *   - None of the above dispatched when activeProject already matches URL
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  cards: [],
  sprints: [],
  statuses: [],
};

const PROJECT_B_RESPONSE = {
  project: { objectId: 'projB222', name: 'Project B' },
  cards: [],
  sprints: [],
  statuses: [],
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

function renderAtPath(path, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:projectId" element={<ProjectLayout />}>
            <Route index element={<div data-testid="stream-child">Stream</div>} />
            <Route path="board" element={<div data-testid="board-child">Board</div>} />
            <Route path="messages" element={<div data-testid="messages-child">Messages</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });
  api.getOrCreateProject.mockResolvedValue(PROJECT_A_RESPONSE);
  // CARD-106: fetchAgents is now dispatched by ProjectLayout; mock must return { agents: [] }
  api.getAgents.mockResolvedValue({ agents: [] });
});

afterEach(() => jest.clearAllMocks());

// ─── Outlet rendering ─────────────────────────────────────────────────────────

describe('ProjectLayout — Outlet rendering', () => {
  test('renders index (Stream) child when projects and activeProject preloaded', async () => {
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('stream-child')).toBeInTheDocument()
    );
  });

  test('renders board child at /:projectId/board', async () => {
    renderAtPath('/projA111/board', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('board-child')).toBeInTheDocument()
    );
  });

  test('renders messages child at /:projectId/messages', async () => {
    renderAtPath('/projA111/messages', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('messages-child')).toBeInTheDocument()
    );
  });
});

// ─── fetchRecentProjects on empty projects list ────────────────────────────────

describe('ProjectLayout — fetchRecentProjects dispatch', () => {
  test('dispatches fetchRecentProjects when projects list is empty', async () => {
    // Empty store — no preloaded projects
    renderAtPath('/projA111');
    await waitFor(() =>
      expect(api.getRecentProjects).toHaveBeenCalledTimes(1)
    );
  });

  test('does NOT dispatch fetchRecentProjects when projects already loaded', async () => {
    api.getOrCreateProject.mockResolvedValue(PROJECT_A_RESPONSE);
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    // Wait for the sync effect to run
    await waitFor(() => expect(api.getOrCreateProject).toHaveBeenCalled());
    expect(api.getRecentProjects).not.toHaveBeenCalled();
  });
});

// ─── URL → Redux active project sync ──────────────────────────────────────────

describe('ProjectLayout — URL to Redux activeProject sync', () => {
  test('dispatches fetchProject with correct path when URL projectId matches', async () => {
    renderAtPath('/projA111', {
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
  });

  test('dispatches fetchProject with PROJECT_B path when URL is /projB222', async () => {
    api.getOrCreateProject.mockResolvedValue(PROJECT_B_RESPONSE);
    renderAtPath('/projB222', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_B.path)
    );
  });

  test('sets Redux activeProject to the matched project object', async () => {
    api.getOrCreateProject.mockResolvedValue(PROJECT_B_RESPONSE);
    const { store } = renderAtPath('/projB222', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(store.getState().projects.activeProject?.objectId).toBe('projB222')
    );
  });

  test('dispatches fetchProject on fresh mount even when activeProject already matches URL (CARD-100 fix)', async () => {
    // CARD-100: old guard was activeProject?.objectId === projectId which blocked init.
    // New guard is useRef-based: ref starts null on every fresh mount, so init always
    // fires once per mount regardless of activeProject state.
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
      project: {
        project: { objectId: 'projA111' },
        cards: [],
        sprints: [],
        statuses: [],
        sprintFilter: null,
        selectedCard: null,
        loading: false,
        error: null,
        lastPoll: null,
      },
    });
    await waitFor(() =>
      expect(api.getOrCreateProject).toHaveBeenCalledWith(PROJECT_A.path)
    );
  });

  test('does NOT dispatch fetchProject when URL projectId is not in projects list', async () => {
    renderAtPath('/unknownXXX', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(api.getOrCreateProject).not.toHaveBeenCalled();
  });
});

// ─── CARD-100: Source-level assertions — useRef init guard ────────────────────

const layoutSrc = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'components', 'ProjectLayout.jsx'),
  'utf8'
);

describe('CARD-100: ProjectLayout — source-level useRef init guard', () => {
  test('useRef is imported from react', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*useRef[^}]*\}\s*from\s*['"]react['"]/);
  });

  test('clearAgents is imported from agentsSlice', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*clearAgents[^}]*\}\s*from\s*['"][^'"]*agentsSlice['"]/);
  });

  test('initializedRef is declared with useRef(null)', () => {
    expect(layoutSrc).toMatch(/initializedRef\s*=\s*useRef\s*\(\s*null\s*\)/);
  });

  test('init guard checks initializedRef.current !== projectId', () => {
    expect(layoutSrc).toMatch(/initializedRef\.current\s*!==\s*projectId/);
  });

  test('init block assigns initializedRef.current = projectId (prevents re-init)', () => {
    expect(layoutSrc).toMatch(/initializedRef\.current\s*=\s*projectId/);
  });

  test('clearAgents() is dispatched in the init block', () => {
    expect(layoutSrc).toMatch(/dispatch\s*\(\s*clearAgents\s*\(\s*\)\s*\)/);
  });
});

// ─── CARD-100: Behavioral — init fires on fresh mount ─────────────────────────

describe('CARD-100: ProjectLayout — ref-based init fires on fresh mount', () => {
  test('dispatches fetchProject exactly once per fresh mount (ref guard prevents duplicate)', async () => {
    renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    await waitFor(() => expect(api.getOrCreateProject).toHaveBeenCalledTimes(1));
    // Wait to confirm the ref guard prevents any second call
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(api.getOrCreateProject).toHaveBeenCalledTimes(1);
  });

  test('clearAgents empties agents list when init fires', async () => {
    const { store } = renderAtPath('/projA111', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: null,
        loading: false,
        error: null,
      },
      agents: {
        agents: [{ name: 'agent-x', sortOrder: 0 }],
        allAgents: [],
        loading: false,
        error: null,
      },
    });
    // clearAgents is dispatched synchronously during init — agents should clear immediately
    await waitFor(() =>
      expect(store.getState().agents.agents).toHaveLength(0)
    );
  });

  test('setActiveProject updates Redux activeProject when init fires', async () => {
    const { store } = renderAtPath('/projB222', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    await waitFor(() =>
      expect(store.getState().projects.activeProject?.objectId).toBe('projB222')
    );
  });
});
