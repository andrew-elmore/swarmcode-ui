/**
 * CARD-089 Unit Tests — src/components/ProjectsView.jsx
 *
 * Tests navigate() behavior introduced by the URL router:
 *   - Clicking a project list item calls navigate(`/${project.objectId}`)
 *   - Adding a new project calls navigate(`/${newProject.objectId}`) after fetch
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import projectsReducer from '../../src/store/projectsSlice';
import ttsReducer from '../../src/store/ttsSlice';
import ProjectsView from '../../src/components/ProjectsView';

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

function renderView(projectsState = {}) {
  const store = makeStore({
    projects: {
      projects: [],
      activeProject: null,
      loading: false,
      error: null,
      ...projectsState,
    },
  });
  render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/']}>
          <LocationDisplay />
          <ProjectsView />
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

describe('ProjectsView — rendering', () => {
  test('shows "No projects yet" when projects list is empty', () => {
    renderView({ projects: [] });
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  test('renders each project as a list item', () => {
    renderView({ projects: [PROJECT_A, PROJECT_B] });
    expect(screen.getByTestId('project-list-item-Project A')).toBeInTheDocument();
    expect(screen.getByTestId('project-list-item-Project B')).toBeInTheDocument();
  });

  test('renders Projects heading', () => {
    renderView({ projects: [] });
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  test('renders Add Project button', () => {
    renderView({ projects: [] });
    expect(screen.getByTestId('add-project-button')).toBeInTheDocument();
  });
});

// ─── handleSelectProject — navigate on click ──────────────────────────────────

describe('ProjectsView — handleSelectProject navigates to /:objectId', () => {
  test('clicking Project A navigates to /projA111', async () => {
    renderView({ projects: [PROJECT_A, PROJECT_B] });

    expect(screen.getByTestId('location-display')).toHaveTextContent('/');

    fireEvent.click(screen.getByText('Project A'));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projA111')
    );
  });

  test('clicking Project B navigates to /projB222', async () => {
    renderView({ projects: [PROJECT_A, PROJECT_B] });

    fireEvent.click(screen.getByText('Project B'));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projB222')
    );
  });
});

// ─── handleAddProject — navigate after add ────────────────────────────────────

describe('ProjectsView — handleAddProject navigates to new project', () => {
  test('adding a project navigates to /:newProject.objectId', async () => {
    const NEW_PROJECT = { objectId: 'newProj888', path: '/path/new', name: 'new' };
    api.getRecentProjects.mockResolvedValue({
      projects: [PROJECT_A, PROJECT_B, NEW_PROJECT],
    });

    renderView({ projects: [PROJECT_A, PROJECT_B] });

    // Open Add Project dialog
    fireEvent.click(screen.getByTestId('add-project-button'));
    await waitFor(() => screen.getByLabelText(/project path/i));

    fireEvent.change(screen.getByLabelText(/project path/i), {
      target: { value: '/path/new' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/newProj888')
    );
  });
});

// ─── Error display ────────────────────────────────────────────────────────────

describe('ProjectsView — error display', () => {
  test('shows error alert when error is set in store', () => {
    renderView({ projects: [], error: 'Failed to load projects' });
    expect(screen.getByTestId('error-alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
  });
});
