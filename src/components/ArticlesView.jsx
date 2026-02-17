import { useState, useEffect, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Markdown from "react-markdown";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchArticles,
  searchArticles,
  deleteArticle,
  getArticle,
  setSelectedArticle,
  clearError,
  clearSearch,
} from "../store/articlesSlice";
import ArticleEditDialog from "./ArticleEditDialog";

function formatDate(val) {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val instanceof Date ? val : new Date(val.iso || val);
  return isNaN(d) ? "" : d.toLocaleDateString();
}

// Preprocess article text: replace [[Title]] with markdown links using a
// custom scheme so we can intercept clicks. Titles are URI-encoded to handle
// spaces and special characters in the link target.
const REF_SCHEME = "article-ref:";
function preprocessReferences(text) {
  if (!text) return "";
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
    return `[${title}](${REF_SCHEME}${encodeURIComponent(title)})`;
  });
}

function ArticleContent({ text, knownTitles, onRefClick }) {
  const processed = useMemo(() => preprocessReferences(text), [text]);

  const components = useMemo(() => ({
    a({ href, children }) {
      if (href && href.startsWith(REF_SCHEME)) {
        const refTitle = decodeURIComponent(href.slice(REF_SCHEME.length));
        const exists = knownTitles.has(refTitle.toLowerCase());
        return (
          <Link
            component="button"
            onClick={(e) => { e.preventDefault(); onRefClick(refTitle); }}
            sx={{
              cursor: "pointer",
              fontStyle: exists ? "normal" : "italic",
              color: exists ? "primary.main" : "error.main",
              textDecoration: "underline",
            }}
            data-testid={`article-ref-${refTitle}`}
          >
            {children}
          </Link>
        );
      }
      return <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>;
    },
  }), [knownTitles, onRefClick]);

  return <Markdown components={components}>{processed}</Markdown>;
}

export default function ArticlesView() {
  const dispatch = useAppDispatch();
  const { articles, selectedArticle, searchResults, loading, error } = useAppSelector((s) => s.articles);
  const projectHash = useAppSelector((s) => s.board.board?.projectHash);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [editOpen, setEditOpen] = useState(false);
  const [editArticle, setEditArticle] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Build a lowercase set of known article titles for reference validation
  const knownTitles = useMemo(
    () => new Set(articles.map((a) => a.title.toLowerCase())),
    [articles]
  );

  const handleRefClick = useCallback((refTitle) => {
    if (!projectHash) return;
    // Check if article is already loaded in the list
    const found = articles.find((a) => a.title.toLowerCase() === refTitle.toLowerCase());
    if (found) {
      dispatch(setSelectedArticle(found));
    } else {
      // Fetch from API (may not exist — getArticle.rejected will set error)
      dispatch(getArticle({ projectHash, title: refTitle }));
    }
  }, [dispatch, projectHash, articles]);

  useEffect(() => {
    if (projectHash) {
      dispatch(fetchArticles(projectHash));
    }
  }, [dispatch, projectHash]);

  const handleSearch = () => {
    if (!projectHash) return;
    const query = searchQuery.trim() || undefined;
    const keywords = searchKeywords.trim()
      ? searchKeywords.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;
    if (!query && !keywords) {
      dispatch(clearSearch());
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    dispatch(searchArticles({ projectHash, query, keywords }));
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchKeywords("");
    setIsSearching(false);
    dispatch(clearSearch());
  };

  const handleRowClick = (article) => {
    dispatch(setSelectedArticle(article));
  };

  const handleBack = () => {
    dispatch(setSelectedArticle(null));
  };

  const handleCreate = () => {
    setEditArticle(null);
    setEditOpen(true);
  };

  const handleEdit = () => {
    setEditArticle(selectedArticle);
    setEditOpen(true);
  };

  const handleDeleteClick = () => {
    setDeleteTarget(selectedArticle);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting || !projectHash) return;
    setDeleting(true);
    const result = await dispatch(deleteArticle({ projectHash, title: deleteTarget.title }));
    setDeleting(false);
    if (!result.error) {
      setDeleteOpen(false);
      setDeleteTarget(null);
      dispatch(setSelectedArticle(null));
    }
  };

  const displayArticles = isSearching ? searchResults : articles;

  if (loading && articles.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Detail view
  if (selectedArticle) {
    return (
      <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 900, mx: "auto" }} data-testid="article-detail">
        {error && (
          <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <IconButton onClick={handleBack} data-testid="article-back-button">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {selectedArticle.title}
          </Typography>
          <Button startIcon={<EditIcon />} variant="outlined" size="small" onClick={handleEdit} data-testid="article-edit-button">
            Edit
          </Button>
          <Button startIcon={<DeleteIcon />} variant="outlined" size="small" color="error" onClick={handleDeleteClick} data-testid="article-delete-button">
            Delete
          </Button>
        </Box>

        {selectedArticle.keywords?.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
            {selectedArticle.keywords.map((kw) => (
              <Chip key={kw} label={kw} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Updated: {formatDate(selectedArticle.updatedAt)}
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, "& p": { mt: 0, mb: 1 }, "& pre": { overflow: "auto" }, "& code": { fontFamily: "monospace", fontSize: "0.875rem" } }}>
          {selectedArticle.text
            ? <ArticleContent text={selectedArticle.text} knownTitles={knownTitles} onRefClick={handleRefClick} />
            : <Typography color="text.secondary">(no content)</Typography>
          }
        </Paper>

        <ArticleEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          article={editArticle}
          projectHash={projectHash}
        />

        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Delete Article</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // List view
  return (
    <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 900, mx: "auto" }} data-testid="articles-view">
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Articles</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleCreate} data-testid="new-article-button">
          New Article
        </Button>
      </Box>

      {/* Search section */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <TextField
          size="small"
          label="Search title"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          sx={{ flex: 1, minWidth: 120 }}
          data-testid="article-search-title"
        />
        <TextField
          size="small"
          label="Keywords (comma-separated)"
          value={searchKeywords}
          onChange={(e) => setSearchKeywords(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          sx={{ flex: 1, minWidth: 120 }}
          data-testid="article-search-keywords"
        />
        <Button variant="outlined" size="small" onClick={handleSearch} startIcon={<SearchIcon />}>
          Search
        </Button>
        {isSearching && (
          <Button variant="text" size="small" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
      </Box>

      {isSearching && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
        </Typography>
      )}

      {displayArticles.length === 0 ? (
        <Typography color="text.secondary">
          {isSearching ? "No articles matched your search." : "No articles yet. Click 'New Article' to create one."}
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                {!isMobile && <TableCell>Keywords</TableCell>}
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayArticles.map((article) => (
                <TableRow
                  key={article.objectId}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleRowClick(article)}
                  data-testid={`article-row-${article.objectId}`}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {article.title}
                    </Typography>
                  </TableCell>
                  {!isMobile && (
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {(article.keywords || []).map((kw) => (
                          <Chip key={kw} label={kw} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(article.updatedAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ArticleEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        article={editArticle}
        projectHash={projectHash}
      />
    </Box>
  );
}
