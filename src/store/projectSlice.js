import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";


export const fetchProject = createAsyncThunk(
  "project/fetchProject",
  async (projectPath) => {
    return api.getOrCreateProject(projectPath);
  }
);

export const createCard = createAsyncThunk(
  "project/createCard",
  async (cardData) => {
    return api.createCard(cardData);
  }
);

export const updateCard = createAsyncThunk(
  "project/updateCard",
  async (cardData) => {
    return api.updateCard(cardData);
  }
);

export const addComment = createAsyncThunk(
  "project/addComment",
  async (commentData) => {
    return api.addComment(commentData);
  }
);

export const fetchCards = createAsyncThunk(
  "project/fetchCards",
  async ({ projectId, status, sprint }) => {
    return api.listCards(projectId, status, sprint);
  }
);

export const fetchCard = createAsyncThunk(
  "project/fetchCard",
  async ({ projectId, cardId }) => {
    return api.showCard(projectId, cardId);
  }
);

export const createStatus = createAsyncThunk(
  "project/createStatus",
  async (statusData) => {
    return api.createStatus(statusData);
  }
);

export const updateStatus = createAsyncThunk(
  "project/updateStatus",
  async (statusData) => {
    return api.updateStatus(statusData);
  }
);

export const deleteStatus = createAsyncThunk(
  "project/deleteStatus",
  async ({ projectId, statusId }) => {
    return api.deleteStatus(projectId, statusId);
  }
);

export const createSprint = createAsyncThunk(
  "project/createSprint",
  async (sprintData) => {
    return api.createSprint(sprintData);
  }
);

export const updateSprint = createAsyncThunk(
  "project/updateSprint",
  async (sprintData) => {
    return api.updateSprint(sprintData);
  }
);

export const deleteSprint = createAsyncThunk(
  "project/deleteSprint",
  async ({ projectId, sprintId }) => {
    return api.deleteSprint(projectId, sprintId);
  }
);


const projectSlice = createSlice({
  name: "project",
  initialState: {
    project: null,
    cards: [],
    sprints: [],
    statuses: [],
    sprintFilter: null,
    selectedCard: null,
    loading: false,
    error: null,
    lastPoll: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearSelectedCard(state) {
      state.selectedCard = null;
    },
    setSprintFilter(state, action) {
      state.sprintFilter = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchProject.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchProject.fulfilled, (state, action) => {
      state.loading = false;
      state.project = action.payload.project;
      state.cards = action.payload.cards;
      state.sprints = action.payload.sprints || [];
      state.statuses = action.payload.statuses || [];
      state.lastPoll = new Date().toISOString();
    });
    builder.addCase(fetchProject.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    builder.addCase(createCard.fulfilled, (state, action) => {
      state.cards.push(action.payload.card);
    });
    builder.addCase(createCard.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(updateCard.fulfilled, (state, action) => {
      const updated = action.payload.card;
      const idx = state.cards.findIndex((c) => c.cardId === updated.cardId);
      if (idx !== -1) {
        state.cards[idx] = updated;
      }
      if (state.selectedCard?.cardId === updated.cardId) {
        state.selectedCard = updated;
      }
    });
    builder.addCase(updateCard.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(addComment.fulfilled, (state, action) => {
      if (state.selectedCard) {
        const comments = state.selectedCard.comments || [];
        comments.push(action.payload.comment);
        state.selectedCard = { ...state.selectedCard, comments };
      }
    });
    builder.addCase(addComment.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(fetchCards.fulfilled, (state, action) => {
      state.cards = action.payload.cards;
    });

    builder.addCase(fetchCard.fulfilled, (state, action) => {
      state.selectedCard = action.payload.card;
    });

    builder.addCase(createStatus.fulfilled, (state, action) => {
      state.statuses.push(action.payload.status);
      state.statuses.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    builder.addCase(createStatus.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(updateStatus.fulfilled, (state, action) => {
      const updated = action.payload.status;
      const idx = state.statuses.findIndex((s) => s.objectId === updated.objectId);
      if (idx !== -1) {
        state.statuses[idx] = updated;
        state.statuses.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
    });
    builder.addCase(updateStatus.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(deleteStatus.fulfilled, (state, action) => {
      const { statusId } = action.meta.arg;
      state.statuses = state.statuses.filter((s) => s.objectId !== statusId);
    });
    builder.addCase(deleteStatus.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(createSprint.fulfilled, (state, action) => {
      state.sprints.push(action.payload);
    });
    builder.addCase(createSprint.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(updateSprint.fulfilled, (state, action) => {
      const updated = action.payload;
      const idx = state.sprints.findIndex((s) => s.objectId === updated.objectId);
      if (idx !== -1) {
        state.sprints[idx] = updated;
      }
    });
    builder.addCase(updateSprint.rejected, (state, action) => {
      state.error = action.error.message;
    });

    builder.addCase(deleteSprint.fulfilled, (state, action) => {
      const { sprintId } = action.payload;
      const deleted = state.sprints.find((s) => s.objectId === sprintId);
      state.sprints = state.sprints.filter((s) => s.objectId !== sprintId);
      if (deleted && state.sprintFilter === deleted.name) {
        state.sprintFilter = null;
      }
    });
    builder.addCase(deleteSprint.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError, clearSelectedCard, setSprintFilter } = projectSlice.actions;
export default projectSlice.reducer;
