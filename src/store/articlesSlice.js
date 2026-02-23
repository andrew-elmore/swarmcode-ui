import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";

export const fetchArticles = createAsyncThunk(
  "articles/fetchArticles",
  async (boardId) => {
    return api.listArticles(boardId);
  }
);

export const createArticle = createAsyncThunk(
  "articles/createArticle",
  async ({ boardId, title, text, keywords }) => {
    return api.createArticle({ boardId, title, text, keywords });
  }
);

export const updateArticle = createAsyncThunk(
  "articles/updateArticle",
  async ({ boardId, title, text, keywords, newTitle }) => {
    return api.updateArticle({ boardId, title, text, keywords, newTitle });
  }
);

export const deleteArticle = createAsyncThunk(
  "articles/deleteArticle",
  async ({ boardId, title }) => {
    await api.deleteArticle(boardId, title);
    return { title };
  }
);

export const searchArticles = createAsyncThunk(
  "articles/searchArticles",
  async ({ boardId, query, keywords }) => {
    return api.searchArticles(boardId, { query, keywords });
  }
);

export const getArticle = createAsyncThunk(
  "articles/getArticle",
  async ({ boardId, title }) => {
    return api.getArticle(boardId, title);
  }
);

export const fetchLinkedArticles = createAsyncThunk(
  "articles/fetchLinkedArticles",
  async (boardId) => {
    return api.getProjectArticles(boardId);
  }
);

export const linkArticle = createAsyncThunk(
  "articles/linkArticle",
  async ({ boardId, articleTitle }) => {
    return api.linkArticleToProject({ boardId, articleTitle });
  }
);

export const unlinkArticle = createAsyncThunk(
  "articles/unlinkArticle",
  async ({ boardId, articleTitle }) => {
    await api.unlinkArticleFromProject({ boardId, articleTitle });
    return { articleTitle };
  }
);

const articlesSlice = createSlice({
  name: "articles",
  initialState: {
    articles: [],
    linkedArticleTitles: [],
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

    // fetchLinkedArticles
    builder.addCase(fetchLinkedArticles.fulfilled, (state, action) => {
      state.linkedArticleTitles = action.payload.articles.map((a) => a.title);
    });

    // linkArticle
    builder.addCase(linkArticle.fulfilled, (state, action) => {
      const title = action.payload.article.title;
      if (!state.linkedArticleTitles.includes(title)) {
        state.linkedArticleTitles.push(title);
      }
    });
    builder.addCase(linkArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });

    // unlinkArticle
    builder.addCase(unlinkArticle.fulfilled, (state, action) => {
      state.linkedArticleTitles = state.linkedArticleTitles.filter(
        (t) => t !== action.payload.articleTitle
      );
    });
    builder.addCase(unlinkArticle.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError, setSelectedArticle, clearSearch } = articlesSlice.actions;
export default articlesSlice.reducer;
