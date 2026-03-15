/**
 * CARD-091 Integration Tests — src/components/ProjectSelector.jsx
 *
 * Verifies that ProjectSelector preserves the current sub-route when switching
 * projects in a full routing context (ProjectSelector rendered alongside route
 * views). This is the regression guard for CARD-091.
 *
 * The integration test renders ProjectSelector within a multi-route context
 * so that URL changes affect actual rendered views (not just a LocationDisplay
 * spy), confirming the end-to-end navigation behavior.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import projectsReducer from '../../src/store/projectsSlice';
import ttsReducer from '../../src/store/ttsSlice';
import ProjectSelector from '../../src/components/ProjectSelector';

jest.mock('../../src/services/api', () => ({
  getRecentProjects: jest.fn(),
  addRecentProject: jest.fn(),
  deleteProject: jest.fn(),
}));

import * as api from '../../src/services/api';

const theme = createTheme();

const PROJECT_A = { objectId: 'projA111', path: '/path/a', name: 'Project A' };
const PROJECT_B = { objectId: 'projB222', path: '/path/b', name: 'Project B' };

function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="location-display">{pathname}</span>;
}

/** Stub route views: each renders a unique heading so tests can assert which view is active. */
function StubView({ label }) {
  return <div data-testid={`view-${label}`}>{label} view</div>;
}

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      projects: projectsReducer,
      tts: ttsReducer,
    },
    preloadedState: {
      tts: { enabled: false, volume: 1.0, rate: 1.0, error: null },
      ...preloadedState,
    },
  });
}

/**
 * Render ProjectSelector at a given initial URL within a full routing context.
 * The routing tree mirrors the real app's sub-route structure.
 */
function renderWithRoutes(initialPath, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationDisplay />
          <ProjectSelector />
          <Routes>
            <Route path="/" element={<StubView label="projects" />} />
            <Route path="/:projectId" element={<StubView label="stream" />} />
            <Route path="/:projectId/board" element={<StubView label="board" />} />
            <Route path="/:projectId/messages" element={<StubView label="messages" />} />
            <Route path="/:projectId/agents" element={<StubView label="agents" />} />
            <Route path="/:projectId/commands" element={<StubView label="commands" />} />
            <Route path="/:projectId/articles" element={<StubView label="articles" />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

const TWO_PROJECT_STATE = {
  projects: {
    projects: [PROJECT_A, PROJECT_B],
    activeProject: PROJECT_A,
    loading: false,
    error: null,
  },
};

beforeEach(() => {
  api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });
  api.addRecentProject.mockResolvedValue({});
});

afterEach(() => jest.clearAllMocks());

// ─── Sub-route preservation across project switch ─────────────────────────────

describe('CARD-091: ProjectSelector preserves sub-route in full routing context', () => {
  test('switching project from /projA111/board renders board view at /projB222/board', async () => {
    renderWithRoutes('/projA111/board', TWO_PROJECT_STATE);

    // Initial state: board view is rendered
    expect(screen.getByTestId('view-board')).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111/board');

    // Switch to Project B
    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    // URL updated to /projB222/board — board view still rendered
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222/board')
    );
    expect(screen.getByTestId('view-board')).toBeInTheDocument();
  });

  test('switching project from /projA111/agents renders agents view at /projB222/agents', async () => {
    renderWithRoutes('/projA111/agents', TWO_PROJECT_STATE);

    expect(screen.getByTestId('view-agents')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222/agents')
    );
    expect(screen.getByTestId('view-agents')).toBeInTheDocument();
  });

  test('switching project from /projA111/messages renders messages view at /projB222/messages', async () => {
    renderWithRoutes('/projA111/messages', TWO_PROJECT_STATE);

    expect(screen.getByTestId('view-messages')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222/messages')
    );
    expect(screen.getByTestId('view-messages')).toBeInTheDocument();
  });

  test('switching project from /:projectId (Stream) renders stream view at /:newId', async () => {
    renderWithRoutes('/projA111', TWO_PROJECT_STATE);

    expect(screen.getByTestId('view-stream')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display').textContent).toBe('/projB222')
    );
    // Stream view renders (not a sub-route view)
    expect(screen.getByTestId('view-stream')).toBeInTheDocument();
  });
});

// ─── handleAddProject sub-route preservation ──────────────────────────────────

describe('CARD-091: handleAddProject preserves sub-route in full routing context', () => {
  const NEW_PROJECT = { objectId: 'newProj999', path: '/path/new', name: 'new' };

  beforeEach(() => {
    api.getRecentProjects.mockResolvedValue({
      projects: [PROJECT_A, PROJECT_B, NEW_PROJECT],
    });
  });

  test('adding a project from /projA111/board navigates to /:newId/board', async () => {
    renderWithRoutes('/projA111/board', TWO_PROJECT_STATE);

    expect(screen.getByTestId('view-board')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));
    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/path/new' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/newProj999/board')
    );
    expect(screen.getByTestId('view-board')).toBeInTheDocument();
  });
});
