/**
 * CARD-089 Unit Tests — src/components/AgentsView.jsx (project dropdown)
 *
 * Tests the project dropdown navigate() behavior introduced by CARD-089:
 *   - onChange navigates to /:newObjectId/agents (does NOT dispatch fetchProject)
 *   - Dropdown value reflects current URL projectId from useParams()
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

const PROJECT_A = { objectId: 'projA111', path: '/path/a', name: 'Project A' };
const PROJECT_B = { objectId: 'projB222', path: '/path/b', name: 'Project B' };

function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="location-display">{pathname}</span>;
}

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

function renderAgentsView(initialPath, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationDisplay />
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
  api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });
  api.getAgents.mockResolvedValue({ agents: [] });
  api.getAllAgents.mockResolvedValue({ agents: [] });
  api.getOrCreateProject.mockResolvedValue({
    project: { objectId: 'projA111', name: 'Project A' },
    cards: [],
    sprints: [],
    statuses: [],
  });
});

afterEach(() => jest.clearAllMocks());

// ─── Project dropdown — navigate behavior ─────────────────────────────────────

describe('AgentsView — project dropdown navigates (does not fetchProject)', () => {
  test('changing dropdown from Project A to Project B navigates to /projB222/agents', async () => {
    renderAgentsView('/projA111/agents', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    // Wait for the project dropdown to appear
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument()
    );

    expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/agents');

    // Open and select Project B
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /project/i }));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222/agents')
    );
  });

  test('dropdown onChange does NOT call getOrCreateProject directly', async () => {
    renderAgentsView('/projA111/agents', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument()
    );

    // Clear calls from initial mount
    api.getOrCreateProject.mockClear();

    // Change dropdown
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /project/i }));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    // navigate() fires, ProjectLayout (not present here) would handle the fetch.
    // The dropdown itself must NOT call getOrCreateProject.
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222/agents')
    );
    expect(api.getOrCreateProject).not.toHaveBeenCalled();
  });
});

// ─── Dropdown value reflects URL ──────────────────────────────────────────────

describe('AgentsView — dropdown value reflects URL projectId', () => {
  test('dropdown shows Project A when URL is /projA111/agents', async () => {
    renderAgentsView('/projA111/agents', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument()
    );

    // The combobox value should reflect Project A
    expect(screen.getByRole('combobox', { name: /project/i })).toHaveTextContent('Project A');
  });

  test('dropdown shows Project B when URL is /projB222/agents', async () => {
    renderAgentsView('/projB222/agents', {
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_B,
        loading: false,
        error: null,
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument()
    );

    expect(screen.getByRole('combobox', { name: /project/i })).toHaveTextContent('Project B');
  });
});
