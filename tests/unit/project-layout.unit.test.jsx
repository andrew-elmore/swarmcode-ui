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
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
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

  test('does NOT dispatch fetchProject when activeProject already matches URL projectId', async () => {
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(api.getOrCreateProject).not.toHaveBeenCalled();
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
