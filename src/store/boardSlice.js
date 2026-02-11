import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

// --- Async Thunks ---

export const fetchBoard = createAsyncThunk(
  "board/fetchBoard",
  async (projectPath) => {
    return api.getOrCreateBoard(projectPath);
  }
);

export const createCard = createAsyncThunk(
  "board/createCard",
  async (cardData) => {
    return api.createCard(cardData);
  }
);

export const updateCard = createAsyncThunk(
  "board/updateCard",
  async (cardData) => {
    return api.updateCard(cardData);
  }
);

export const addComment = createAsyncThunk(
  "board/addComment",
  async (commentData) => {
    return api.addComment(commentData);
  }
);

export const fetchCards = createAsyncThunk(
  "board/fetchCards",
  async ({ projectHash, status }) => {
    return api.listCards(projectHash, status);
  }
);

export const fetchCard = createAsyncThunk(
  "board/fetchCard",
  async ({ projectHash, cardId }) => {
    return api.showCard(projectHash, cardId);
  }
);

export const pollBoard = createAsyncThunk(
  "board/pollBoard",
  async ({ projectHash, since }) => {
    return api.pollBoard(projectHash, since);
  }
);

export const createSprint = createAsyncThunk(
  "board/createSprint",
  async (sprintData) => {
    return api.createSprint(sprintData);
  }
);

export const updateSprint = createAsyncThunk(
  "board/updateSprint",
  async (sprintData) => {
    return api.updateSprint(sprintData);
  }
);

export const deleteSprint = createAsyncThunk(
  "board/deleteSprint",
  async ({ projectHash, sprintId }) => {
    return api.deleteSprint(projectHash, sprintId);
  }
);

// --- Slice ---

const boardSlice = createSlice({
  name: "board",
  initialState: {
    board: null,
    cards: [],
    sprints: [],
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
    // fetchBoard
    builder.addCase(fetchBoard.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchBoard.fulfilled, (state, action) => {
      state.loading = false;
      state.board = action.payload.board;
      state.cards = action.payload.cards;
      state.sprints = action.payload.sprints || [];
      state.lastPoll = new Date().toISOString();
    });
    builder.addCase(fetchBoard.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // createCard
    builder.addCase(createCard.fulfilled, (state, action) => {
      state.cards.push(action.payload.card);
    });
    builder.addCase(createCard.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateCard
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

    // addComment
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

    // fetchCards
    builder.addCase(fetchCards.fulfilled, (state, action) => {
      state.cards = action.payload.cards;
    });

    // fetchCard
    builder.addCase(fetchCard.fulfilled, (state, action) => {
      state.selectedCard = action.payload.card;
    });

    // pollBoard
    builder.addCase(pollBoard.fulfilled, (state, action) => {
      if (action.payload.changed) {
        state.cards = action.payload.cards;
      }
      state.lastPoll = new Date().toISOString();
    });

    // createSprint
    builder.addCase(createSprint.fulfilled, (state, action) => {
      state.sprints.push(action.payload);
    });
    builder.addCase(createSprint.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateSprint
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

    // deleteSprint
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

export const { clearError, clearSelectedCard, setSprintFilter } = boardSlice.actions;
export default boardSlice.reducer;
