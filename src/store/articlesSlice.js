import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

export const fetchArticles = createAsyncThunk(
  "articles/fetchArticles",
  async (projectHash) => {
    return api.listArticles(projectHash);
  }
);

export const createArticle = createAsyncThunk(
  "articles/createArticle",
  async ({ projectHash, title, text, keywords }) => {
    return api.createArticle({ projectHash, title, text, keywords });
  }
);

export const updateArticle = createAsyncThunk(
  "articles/updateArticle",
  async ({ projectHash, title, text, keywords, newTitle }) => {
    return api.updateArticle({ projectHash, title, text, keywords, newTitle });
  }
);

export const deleteArticle = createAsyncThunk(
  "articles/deleteArticle",
  async ({ projectHash, title }) => {
    await api.deleteArticle(projectHash, title);
    return { title };
  }
);

export const searchArticles = createAsyncThunk(
  "articles/searchArticles",
  async ({ projectHash, query, keywords }) => {
    return api.searchArticles(projectHash, { query, keywords });
  }
);

export const getArticle = createAsyncThunk(
  "articles/getArticle",
  async ({ projectHash, title }) => {
    return api.getArticle(projectHash, title);
  }
);

const articlesSlice = createSlice({
  name: "articles",
  initialState: {
    articles: [],
    selectedArticle: null,
    searchResults: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setSelectedArticle(state, action) {
      state.selectedArticle = action.payload;
    },
    clearSearch(state) {
      state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    // fetchArticles
    builder.addCase(fetchArticles.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchArticles.fulfilled, (state, action) => {
      state.loading = false;
      state.articles = action.payload.articles;
    });
    builder.addCase(fetchArticles.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // createArticle
    builder.addCase(createArticle.fulfilled, (state, action) => {
      state.articles.push(action.payload.article);
      state.articles.sort((a, b) => a.title.localeCompare(b.title));
    });
    builder.addCase(createArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // updateArticle
    builder.addCase(updateArticle.fulfilled, (state, action) => {
      const updated = action.payload.article;
      const idx = state.articles.findIndex((a) => a.objectId === updated.objectId);
      if (idx !== -1) {
        state.articles[idx] = updated;
      }
      state.articles.sort((a, b) => a.title.localeCompare(b.title));
      if (state.selectedArticle?.objectId === updated.objectId) {
        state.selectedArticle = updated;
      }
    });
    builder.addCase(updateArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // deleteArticle
    builder.addCase(deleteArticle.fulfilled, (state, action) => {
      state.articles = state.articles.filter((a) => a.title !== action.payload.title);
      if (state.selectedArticle?.title === action.payload.title) {
        state.selectedArticle = null;
      }
    });
    builder.addCase(deleteArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // searchArticles
    builder.addCase(searchArticles.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchArticles.fulfilled, (state, action) => {
      state.loading = false;
      state.searchResults = action.payload.articles;
    });
    builder.addCase(searchArticles.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    // getArticle
    builder.addCase(getArticle.fulfilled, (state, action) => {
      state.selectedArticle = action.payload.article;
    });
    builder.addCase(getArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError, setSelectedArticle, clearSearch } = articlesSlice.actions;
export default articlesSlice.reducer;
