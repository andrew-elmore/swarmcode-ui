import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

// --- Async Thunks ---

export const fetchRecentProjects = createAsyncThunk(
  "projects/fetchRecentProjects",
  async () => {
    return api.getRecentProjects();
  }
);

export const addRecentProject = createAsyncThunk(
  "projects/addRecentProject",
  async ({ path, name }) => {
    await api.addRecentProject(path, name);
    return { path, name };
  }
);

export const deleteProject = createAsyncThunk(
  "projects/deleteProject",
  async ({ path }) => {
    await api.deleteProject(path);
    return { path };
  }
);

// --- Slice ---

const projectsSlice = createSlice({
  name: "projects",
  initialState: {
    projects: [],
    activeProject: null,
    loading: false,
    error: null,
  },
  reducers: {
    setActiveProject(state, action) {
      state.activeProject = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchRecentProjects
    builder.addCase(fetchRecentProjects.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRecentProjects.fulfilled, (state, action) => {
      state.loading = false;
      state.projects = action.payload.projects;
    });
    builder.addCase(fetchRecentProjects.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // addRecentProject
    builder.addCase(addRecentProject.fulfilled, (state, action) => {
      const { path, name } = action.payload;
      const existing = state.projects.find((p) => p.path === path);
      if (existing) {
        existing.name = name;
        existing.lastOpened = new Date().toISOString();
      } else {
        state.projects.unshift({
          path,
          name,
          lastOpened: new Date().toISOString(),
        });
      }
    });
    builder.addCase(addRecentProject.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // deleteProject
    builder.addCase(deleteProject.fulfilled, (state, action) => {
      const { path } = action.payload;
      state.projects = state.projects.filter((p) => p.path !== path);
      if (state.activeProject?.path === path) {
        state.activeProject = state.projects.length > 0 ? state.projects[0] : null;
      }
    });
    builder.addCase(deleteProject.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { setActiveProject, clearError } = projectsSlice.actions;
export default projectsSlice.reducer;
