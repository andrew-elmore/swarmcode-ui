/**
 * CARD-089 Integration Tests — URL Router (App.jsx + Routes)
 *
 * Tests the full route tree rendered by App.jsx:
 *   - "/" renders ProjectsView (no tab bar)
 *   - "/:projectId" renders StreamView with Stream tab selected
 *   - "/:projectId/messages|board|agents|commands|articles" renders the
 *     correct view and highlights the correct tab
 *   - Clicking a tab navigates to the correct URL path segment
 *
 * Child views are stubbed to plain divs so this test focuses on App routing
 * logic without pulling in each view's full dependency tree.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import agentsReducer from '../../src/store/agentsSlice';
import articlesReducer from '../../src/store/articlesSlice';
import authReducer from '../../src/store/authSlice';
import projectReducer from '../../src/store/projectSlice';
import commandsReducer from '../../src/store/commandsSlice';
import messagesReducer from '../../src/store/messagesSlice';
import projectsReducer from '../../src/store/projectsSlice';
import ttsReducer from '../../src/store/ttsSlice';

// ─── Stub heavy child views to avoid cascade dependencies ─────────────────────
jest.mock('../../src/components/ProjectsView', () => () => (
  <div data-testid="projects-view">Projects</div>
));
jest.mock('../../src/components/StreamView', () => () => (
  <div data-testid="stream-view">Stream</div>
));
jest.mock('../../src/components/MessagesView', () => () => (
  <div data-testid="messages-view">Messages</div>
));
jest.mock('../../src/components/BoardView', () => () => (
  <div data-testid="board-view">Board</div>
));
jest.mock('../../src/components/AgentsView', () => () => (
  <div data-testid="agents-view">Agents</div>
));
jest.mock('../../src/components/CommandsView', () => () => (
  <div data-testid="commands-view">Commands</div>
));
jest.mock('../../src/components/ArticlesView', () => () => (
  <div data-testid="articles-view">Articles</div>
));
jest.mock('../../src/components/LoginDialog', () => () => null);
// ProjectSelector — stub to avoid its own fetchRecentProjects effect
jest.mock('../../src/components/ProjectSelector', () => () => (
  <div data-testid="project-selector-stub" />
));
// ProjectLayout — pass through to Outlet without URL-sync side effects
// (ProjectLayout logic is covered by project-layout.unit.test.jsx)
jest.mock('../../src/components/ProjectLayout', () => {
  const { Outlet } = require('react-router-dom');
  return function ProjectLayoutStub() {
    return <Outlet />;
  };
});

jest.mock('../../src/services/api', () => ({
  getRecentProjects: jest.fn(),
  getOrCreateProject: jest.fn(),
  addRecentProject: jest.fn(),
  deleteProject: jest.fn(),
  getAgents: jest.fn(),
  getAllAgents: jest.fn(),
  getArticles: jest.fn(),
  getConversation: jest.fn(),
  sendMessage: jest.fn(),
  subscribeToMessages: jest.fn(() => () => {}), // sync unsubscribe (CARD-099)
  subscribeToCommands: jest.fn(() => () => {}),
  subscribeToPings: jest.fn(() => () => {}),
  subscribeToCards: jest.fn(() => () => {}),
}));

import App from '../../src/App';

const theme = createTheme({
  palette: { primary: { main: '#f44336' }, secondary: { main: '#9c27b0' } },
});

const PROJECT_A = { objectId: 'projA111', path: '/path/a', name: 'Project A' };

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

/** LocationDisplay helper for verifying URL after navigation */
function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="location-display">{pathname}</span>;
}

function renderApp(initialPath, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationDisplay />
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

afterEach(() => jest.clearAllMocks());

// ─── Route "/" — Projects page ─────────────────────────────────────────────────

describe('App routing — "/" renders ProjectsView', () => {
  test('renders projects-view stub at "/"', () => {
    renderApp('/');
    expect(screen.getByTestId('projects-view')).toBeInTheDocument();
  });

  test('tab bar is NOT rendered at "/"', () => {
    renderApp('/');
    expect(screen.queryByTestId('tab-stream')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-board')).not.toBeInTheDocument();
  });
});

// ─── Route "/:projectId" — Stream page ───────────────────────────────────────

describe('App routing — "/:projectId" renders Stream', () => {
  test('renders stream-view stub at "/:projectId"', () => {
    renderApp('/projA111');
    expect(screen.getByTestId('stream-view')).toBeInTheDocument();
  });

  test('tab bar IS rendered at "/:projectId"', () => {
    renderApp('/projA111');
    expect(screen.getByTestId('tab-stream')).toBeInTheDocument();
  });

  test('Stream tab has aria-selected="true" at "/:projectId"', () => {
    renderApp('/projA111');
    expect(screen.getByTestId('tab-stream')).toHaveAttribute('aria-selected', 'true');
  });

  test('Board tab is NOT selected at "/:projectId"', () => {
    renderApp('/projA111');
    expect(screen.getByTestId('tab-board')).toHaveAttribute('aria-selected', 'false');
  });
});

// ─── Route "/:projectId/board" ─────────────────────────────────────────────────

describe('App routing — "/:projectId/board"', () => {
  test('renders board-view at "/:projectId/board"', () => {
    renderApp('/projA111/board');
    expect(screen.getByTestId('board-view')).toBeInTheDocument();
  });

  test('Board tab has aria-selected="true"', () => {
    renderApp('/projA111/board');
    expect(screen.getByTestId('tab-board')).toHaveAttribute('aria-selected', 'true');
  });

  test('Stream tab is NOT selected', () => {
    renderApp('/projA111/board');
    expect(screen.getByTestId('tab-stream')).toHaveAttribute('aria-selected', 'false');
  });
});

// ─── Route "/:projectId/messages" ─────────────────────────────────────────────

describe('App routing — "/:projectId/messages"', () => {
  test('renders messages-view at "/:projectId/messages"', () => {
    renderApp('/projA111/messages');
    expect(screen.getByTestId('messages-view')).toBeInTheDocument();
  });

  test('Messages tab has aria-selected="true"', () => {
    renderApp('/projA111/messages');
    expect(screen.getByTestId('tab-messages')).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Route "/:projectId/agents" ────────────────────────────────────────────────

describe('App routing — "/:projectId/agents"', () => {
  test('renders agents-view at "/:projectId/agents"', () => {
    renderApp('/projA111/agents');
    expect(screen.getByTestId('agents-view')).toBeInTheDocument();
  });

  test('Agents tab has aria-selected="true"', () => {
    renderApp('/projA111/agents');
    expect(screen.getByTestId('tab-agents')).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Route "/:projectId/commands" ─────────────────────────────────────────────

describe('App routing — "/:projectId/commands"', () => {
  test('renders commands-view at "/:projectId/commands"', () => {
    renderApp('/projA111/commands');
    expect(screen.getByTestId('commands-view')).toBeInTheDocument();
  });

  test('Commands tab has aria-selected="true"', () => {
    renderApp('/projA111/commands');
    expect(screen.getByTestId('tab-commands')).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Route "/:projectId/articles" ─────────────────────────────────────────────

describe('App routing — "/:projectId/articles"', () => {
  test('renders articles-view at "/:projectId/articles"', () => {
    renderApp('/projA111/articles');
    expect(screen.getByTestId('articles-view')).toBeInTheDocument();
  });

  test('Articles tab has aria-selected="true"', () => {
    renderApp('/projA111/articles');
    expect(screen.getByTestId('tab-articles')).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Tab click updates URL ─────────────────────────────────────────────────────

describe('App routing — tab clicks navigate to correct URL', () => {
  test('clicking Board tab navigates to /projA111/board', async () => {
    renderApp('/projA111');

    expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111');

    fireEvent.click(screen.getByTestId('tab-board'));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/board')
    );
  });

  test('clicking Messages tab navigates to /projA111/messages', async () => {
    renderApp('/projA111');
    fireEvent.click(screen.getByTestId('tab-messages'));
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/messages')
    );
  });

  test('clicking Agents tab navigates to /projA111/agents', async () => {
    renderApp('/projA111');
    fireEvent.click(screen.getByTestId('tab-agents'));
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/agents')
    );
  });

  test('clicking Commands tab navigates to /projA111/commands', async () => {
    renderApp('/projA111');
    fireEvent.click(screen.getByTestId('tab-commands'));
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/commands')
    );
  });

  test('clicking Articles tab navigates to /projA111/articles', async () => {
    renderApp('/projA111');
    fireEvent.click(screen.getByTestId('tab-articles'));
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/articles')
    );
  });

  test('clicking Stream tab from /board navigates back to /projA111 (index)', async () => {
    renderApp('/projA111/board');

    fireEvent.click(screen.getByTestId('tab-stream'));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111')
    );
    // Exact match: no trailing segment
    expect(screen.getByTestId('location-display').textContent).toBe('/projA111');
  });
});

// ─── Tab bar visibility ────────────────────────────────────────────────────────

describe('App routing — tab bar visibility', () => {
  test('all 6 tabs visible when on /:projectId', () => {
    renderApp('/projA111');
    expect(screen.getByTestId('tab-stream')).toBeInTheDocument();
    expect(screen.getByTestId('tab-messages')).toBeInTheDocument();
    expect(screen.getByTestId('tab-board')).toBeInTheDocument();
    expect(screen.getByTestId('tab-agents')).toBeInTheDocument();
    expect(screen.getByTestId('tab-commands')).toBeInTheDocument();
    expect(screen.getByTestId('tab-articles')).toBeInTheDocument();
  });

  test('tab bar absent when on "/" (Projects page)', () => {
    renderApp('/');
    ['tab-stream', 'tab-messages', 'tab-board', 'tab-agents', 'tab-commands', 'tab-articles']
      .forEach((id) => expect(screen.queryByTestId(id)).not.toBeInTheDocument());
  });
});
