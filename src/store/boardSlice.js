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

// --- Slice ---

const boardSlice = createSlice({
  name: "board",
  initialState: {
    board: null,
    cards: [],
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
  },
});

export const { clearError, clearSelectedCard } = boardSlice.actions;
export default boardSlice.reducer;
