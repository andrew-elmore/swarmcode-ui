import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch } from "../store";
import { updateCard, addComment } from "../store/boardSlice";

const STATUSES = ["backlog", "todo", "in_progress", "review", "qa", "done"];
const PRIORITIES = ["low", "medium", "high", "critical"];

const PRIORITY_COLORS = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "default",
};

export default function CardDetailDialog({ open, onClose, card, projectHash }) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [newComment, setNewComment] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");

  if (!card) return null;

  const handleStatusChange = async (newStatus) => {
    setEditStatus(newStatus);
    await dispatch(
      updateCard({
        projectHash,
        cardId: card.cardId,
        status: newStatus,
        author: "human",
      })
    );
  };

  const handlePriorityChange = async (newPriority) => {
    setEditPriority(newPriority);
    await dispatch(
      updateCard({
        projectHash,
        cardId: card.cardId,
        priority: newPriority,
        author: "human",
      })
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await dispatch(
      addComment({
        projectHash,
        cardId: card.cardId,
        message: newComment.trim(),
        author: "human",
      })
    );
    setNewComment("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>
        <Typography variant="caption" color="text.secondary">
          {card.cardId}
        </Typography>
        <Typography variant="h6">{card.title}</Typography>
      </DialogTitle>
      <DialogContent>
        {card.description && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {card.description}
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <TextField
            label="Status"
            value={editStatus || card.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            select
            size="small"
            sx={{ minWidth: 140, flex: isMobile ? "1 1 100%" : undefined }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s.replace("_", " ")}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Priority"
            value={editPriority || card.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            select
            size="small"
            sx={{ minWidth: 120, flex: isMobile ? "1 1 100%" : undefined }}
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: "flex", gap: 0.5, mb: 2 }}>
          {card.assignee && (
            <Chip label={`Assignee: ${card.assignee}`} size="small" />
          )}
          <Chip
            label={card.priority}
            size="small"
            color={PRIORITY_COLORS[card.priority] || "default"}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Comments ({card.comments?.length || 0})
        </Typography>

        {card.comments && card.comments.length > 0 ? (
          <List dense disablePadding>
            {card.comments.map((c, i) => (
              <ListItem key={i} disablePadding sx={{ mb: 1 }}>
                <ListItemText
                  primary={c.message}
                  secondary={`${c.author} — ${new Date(c.createdAt).toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No comments yet.
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          <TextField
            label="Add a comment"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <Button
            variant="outlined"
            onClick={handleAddComment}
            disabled={!newComment.trim()}
          >
            Send
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
