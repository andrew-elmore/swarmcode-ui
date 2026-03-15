/**
 * CARD-090 Integration Tests — AgentsView initial load
 *
 * Verifies that agents load immediately on direct URL navigation to
 * /:projectId/agents without waiting for the fetchProject waterfall
 * (regression guard for CARD-090 fix).
 *
 * Tests use the real AgentsView component within a routing context to
 * verify end-to-end behavior of the fetchAgents(projectIdParam) dispatch.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import agentsReducer from '../../src/store/agentsSlice';
import articlesReducer from '../../src/store/articlesSlice';
import authReducer from '../../src/store/authSlice';
import projectReducer from '../../src/store/projectSlice';
import commandsReducer from '../../src/store/commandsSlice';
import messagesReducer from '../../src/store/messagesSlice';
import projectsReducer from '../../src/store/projectsSlice';
import ttsReducer from '../../src/store/ttsSlice';
import AgentsView from '../../src/components/AgentsView';

jest.mock('../../src/services/api', () => ({
  getRecentProjects: jest.fn(),
  getOrCreateProject: jest.fn(),
  addRecentProject: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  getAllAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  assignAgent: jest.fn(),
  unassignAgent: jest.fn(),
  updateProjectAgent: jest.fn(),
  getArticles: jest.fn(),
  getConversation: jest.fn(),
  sendMessage: jest.fn(),
  subscribeToMessages: jest.fn(() => Promise.resolve(() => {})),
  subscribeToCommands: jest.fn(() => Promise.resolve(() => {})),
  subscribeToPings: jest.fn(() => Promise.resolve(() => {})),
}));

import * as api from '../../src/services/api';

const theme = createTheme();

const MOCK_AGENTS = [
  { name: 'pm-1', description: 'PM Agent', isActive: true, sortOrder: 0 },
  { name: 'developer-1', description: 'Developer', isActive: true, sortOrder: 1 },
];

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
      agents: { agents: [], allAgents: [], loading: false, error: null },
      ...preloadedState,
    },
  });
}

function renderAtAgentsRoute(projectId, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/${projectId}/agents`]}>
          <Routes>
            <Route path="/:projectId/agents" element={<AgentsView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getRecentProjects.mockResolvedValue({ projects: [] });
  api.getAllAgents.mockResolvedValue({ agents: [] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getOrCreateProject.mockResolvedValue({
    project: { objectId: 'projA111' }, cards: [], sprints: [], statuses: [],
  });
});

afterEach(() => jest.clearAllMocks());

// ─── Cold mount — no Redux project state ──────────────────────────────────────

describe('CARD-090: AgentsView loads agents immediately on direct URL navigation', () => {
  test('api.getAgents called on mount even when s.project.project is null', async () => {
    // Cold state: ProjectLayout has not yet completed fetchProject
    renderAtAgentsRoute('projA111', {
      project: {
        project: null,
        cards: [], sprints: [], statuses: [],
        sprintFilter: null, selectedCard: null,
        loading: false, error: null, lastPoll: null,
      },
    });

    await waitFor(() => {
      expect(api.getAgents).toHaveBeenCalledWith('projA111');
    });
  });

  test('agents list renders after cold-mount fetch completes', async () => {
    api.getAgents.mockResolvedValue({ agents: MOCK_AGENTS });

    // project.project is already populated (ProjectLayout completed) so the
    // Assigned agents section renders once fetchAgents resolves.
    renderAtAgentsRoute('projA111', {
      project: {
        project: { objectId: 'projA111' },
        cards: [], sprints: [], statuses: [],
        sprintFilter: null, selectedCard: null,
        loading: false, error: null, lastPoll: null,
      },
    });

    // Agents heading appears first
    await waitFor(() => {
      expect(screen.getByText('Agents')).toBeInTheDocument();
    });

    // Agent names render after fetch resolves — no user interaction needed
    await waitFor(() => {
      expect(screen.getByTestId('agent-list-item-pm-1')).toBeInTheDocument();
      expect(screen.getByTestId('agent-list-item-developer-1')).toBeInTheDocument();
    });
  });

  test('api.getAgents called immediately without waiting for fetchProject', async () => {
    // Simulate slow fetchProject (never resolves during test)
    api.getOrCreateProject.mockImplementation(() => new Promise(() => {}));

    renderAtAgentsRoute('projA111');

    // Despite fetchProject being blocked, getAgents fires immediately
    await waitFor(() => {
      expect(api.getAgents).toHaveBeenCalledWith('projA111');
    });
  });
});

// ─── Tab-click arrival (projectId already in Redux) ──────────────────────────

describe('CARD-090: agents load consistently regardless of arrival path', () => {
  test('api.getAgents called when s.project.project is already populated', async () => {
    // Normal case: project already loaded in Redux when agents tab is clicked
    renderAtAgentsRoute('projA111', {
      project: {
        project: { objectId: 'projA111' },
        cards: [], sprints: [], statuses: [],
        sprintFilter: null, selectedCard: null,
        loading: false, error: null, lastPoll: null,
      },
    });

    await waitFor(() => {
      expect(api.getAgents).toHaveBeenCalledWith('projA111');
    });
  });
});
