import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch } from "../store";
import { createArticle, updateArticle, fetchArticles } from "../store/articlesSlice";

export default function ArticleEditDialog({ open, onClose, article, boardId }) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isNew = !article;

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title || "");
      setText(article.text || "");
      setKeywords((article.keywords || []).join(", "));
    } else {
      setTitle("");
      setText("");
      setKeywords("");
    }
  }, [article, open]);

  const handleSubmit = async () => {
    if (!title.trim() || !boardId) return;
    setSaving(true);
    try {
      const kw = keywords.trim()
        ? keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [];
      if (isNew) {
        await dispatch(createArticle({ boardId, title: title.trim(), text, keywords: kw })).unwrap();
      } else {
        const params = { boardId, title: article.title };
        if (title.trim() !== article.title) params.newTitle = title.trim();
        params.text = text;
        params.keywords = kw;
        await dispatch(updateArticle(params)).unwrap();
      }
      dispatch(fetchArticles(boardId));
      onClose();
    } catch {
      // Error handled by Redux slice
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} data-testid="article-edit-dialog">
      <DialogTitle>{isNew ? "New Article" : `Edit: ${article?.title}`}</DialogTitle>
      <DialogContent>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          autoFocus
          margin="dense"
          data-testid="article-edit-title"
        />
        <TextField
          label="Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          margin="dense"
          multiline
          minRows={6}
          maxRows={16}
          inputProps={{ style: { fontFamily: "monospace" } }}
          data-testid="article-edit-text"
        />
        <TextField
          label="Keywords (comma-separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          fullWidth
          margin="dense"
          placeholder="api, auth, setup"
          data-testid="article-edit-keywords"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !title.trim()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          data-testid="article-edit-save"
        >
          {saving ? "Saving..." : isNew ? "Create" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
