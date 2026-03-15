/**
 * CARD-089 Unit Tests — src/components/ProjectSelector.jsx
 * CARD-091 Unit Tests — sub-route preservation on project switch
 *
 * Tests navigate() behavior introduced by the URL router:
 *   - Selecting a project calls navigate(`/${project.objectId}`)
 *   - Adding a new project calls navigate(`/${newProject.objectId}`) after fetch
 *
 * CARD-091 tests verify that both handleSelect and handleAddProject preserve the
 * current sub-route when switching projects:
 *   - /projA/board → /projB/board
 *   - /projA/messages → /projB/messages
 *   - /projA/agents → /projB/agents
 *   - /projA/commands → /projB/commands
 *   - /projA/articles → /projB/articles
 *   - /projA (Stream index) → /projB (no sub-path appended)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

/** Captures and exposes the current location for assertions. */
function LocationDisplay() {
  const { pathname } = useLocation();
  return <span data-testid="location-display">{pathname}</span>;
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

function renderSelector(preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/']}>
          <LocationDisplay />
          <ProjectSelector />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
  return { store };
}

beforeEach(() => {
  api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });
  api.addRecentProject.mockResolvedValue({});
});

afterEach(() => jest.clearAllMocks());

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ProjectSelector — rendering', () => {
  test('renders project dropdown with data-testid', () => {
    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    expect(screen.getByTestId('project-selector')).toBeInTheDocument();
  });

  test('renders add-project button', () => {
    renderSelector({
      projects: {
        projects: [],
        activeProject: null,
        loading: false,
        error: null,
      },
    });
    expect(screen.getByTestId('add-project-button')).toBeInTheDocument();
  });

  test('shows project names as menu items', async () => {
    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });
    // Open the select
    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project A' }));
    expect(screen.getByRole('option', { name: 'Project B' })).toBeInTheDocument();
  });
});

// ─── handleSelect — navigate on project select ────────────────────────────────

describe('ProjectSelector — handleSelect navigates to /:objectId', () => {
  test('selecting Project B navigates to /projB222', async () => {
    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    // Confirm starting location
    expect(screen.getByTestId('location-display')).toHaveTextContent('/');

    // Open the select and pick Project B
    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222')
    );
  });

  test('selecting Project A navigates to /projA111', async () => {
    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_B,
        loading: false,
        error: null,
      },
    });

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project A' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111')
    );
  });
});

// ─── handleAddProject — navigate after add ────────────────────────────────────

describe('ProjectSelector — handleAddProject navigates to new project', () => {
  test('adding a project navigates to /:newProject.objectId', async () => {
    const NEW_PROJECT = { objectId: 'newProj999', path: '/path/new', name: 'new' };
    api.getRecentProjects.mockResolvedValue({
      projects: [PROJECT_A, PROJECT_B, NEW_PROJECT],
    });

    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    // Open Add Project dialog
    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));

    // Type the new path
    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/path/new' },
    });

    // Click Add
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/newProj999')
    );
  });

  test('does not navigate if fetched projects list does not include new path', async () => {
    // getRecentProjects returns only the existing projects (new one not found)
    api.getRecentProjects.mockResolvedValue({ projects: [PROJECT_A, PROJECT_B] });

    renderSelector({
      projects: {
        projects: [PROJECT_A, PROJECT_B],
        activeProject: PROJECT_A,
        loading: false,
        error: null,
      },
    });

    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));
    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/some/nonexistent/path' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    // Should still be at '/' since new project not found in response
    await waitFor(() => expect(api.getRecentProjects).toHaveBeenCalled());
    expect(screen.getByTestId('location-display')).toHaveTextContent('/');
  });
});

// ─── CARD-091 helpers ──────────────────────────────────────────────────────────

/** Render ProjectSelector starting at a specific URL path. */
function renderSelectorAt(initialPath, preloadedState = {}) {
  const store = makeStore(preloadedState);
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationDisplay />
          <ProjectSelector />
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

// ─── CARD-091: handleSelect preserves sub-route ────────────────────────────────

describe('CARD-091: handleSelect preserves current sub-route when switching projects', () => {
  const SUB_ROUTES = ['board', 'messages', 'agents', 'commands', 'articles'];

  SUB_ROUTES.forEach((subRoute) => {
    test(`switching from /projA111/${subRoute} to Project B navigates to /projB222/${subRoute}`, async () => {
      renderSelectorAt(`/projA111/${subRoute}`, TWO_PROJECT_STATE);

      expect(screen.getByTestId('location-display')).toHaveTextContent(`/projA111/${subRoute}`);

      fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
      await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
      fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

      await waitFor(() =>
        expect(screen.getByTestId('location-display')).toHaveTextContent(`/projB222/${subRoute}`)
      );
    });
  });

  test('switching from /:projectId (Stream index) navigates to /:newId without sub-path', async () => {
    renderSelectorAt('/projA111', TWO_PROJECT_STATE);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111');

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display').textContent).toBe('/projB222')
    );
  });

  test('switching from / (Projects page) navigates to /:newId without sub-path', async () => {
    renderSelectorAt('/', TWO_PROJECT_STATE);

    fireEvent.mouseDown(screen.getByTestId('project-selector').querySelector('[role="combobox"]'));
    await waitFor(() => screen.getByRole('option', { name: 'Project B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project B' }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display').textContent).toBe('/projB222')
    );
  });
});

// ─── CARD-091: handleAddProject preserves sub-route ───────────────────────────

describe('CARD-091: handleAddProject preserves current sub-route when adding a project', () => {
  const NEW_PROJECT = { objectId: 'newProj999', path: '/path/new', name: 'new' };

  beforeEach(() => {
    api.getRecentProjects.mockResolvedValue({
      projects: [PROJECT_A, PROJECT_B, NEW_PROJECT],
    });
  });

  test('adding a project from /projA111/board navigates to /:newId/board', async () => {
    renderSelectorAt('/projA111/board', TWO_PROJECT_STATE);

    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));
    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/path/new' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/newProj999/board')
    );
  });

  test('adding a project from /projA111 (Stream index) navigates to /:newId without sub-path', async () => {
    renderSelectorAt('/projA111', TWO_PROJECT_STATE);

    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));
    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/path/new' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display').textContent).toBe('/newProj999')
    );
  });
});
