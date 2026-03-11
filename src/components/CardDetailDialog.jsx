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
import { useAppDispatch, useAppSelector } from "../store";
import { updateCard, addComment } from "../store/projectSlice";
import { PRIORITIES, PRIORITY_COLORS, getSprintDisplayName } from "../constants";

export default function CardDetailDialog({ open, onClose, card, projectId }) {
  const dispatch = useAppDispatch();
  const { sprints, statuses } = useAppSelector((s) => s.project);
  const { agents } = useAppSelector((s) => s.agents);
  const sortedStatuses = [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [newComment, setNewComment] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editSprint, setEditSprint] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");

  if (!card) return null;

  const handleStatusChange = async (newStatus) => {
    setEditStatus(newStatus);
    await dispatch(
      updateCard({
        projectId,
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
        projectId,
        cardId: card.cardId,
        priority: newPriority,
        author: "human",
      })
    );
  };

  const handleSprintChange = async (newSprint) => {
    setEditSprint(newSprint);
    await dispatch(
      updateCard({
        projectId,
        cardId: card.cardId,
        sprint: newSprint || null,
        author: "human",
      })
    );
  };

  const handleTitleSave = async () => {
    if (!editTitle.trim() || editTitle.trim() === card.title) {
      setEditingTitle(false);
      return;
    }
    await dispatch(
      updateCard({ projectId, cardId: card.cardId, title: editTitle.trim(), author: "human" })
    );
    setEditingTitle(false);
  };

  const handleDescriptionSave = async () => {
    if (editDescription.trim() === (card.description || "")) {
      setEditingDescription(false);
      return;
    }
    await dispatch(
      updateCard({ projectId, cardId: card.cardId, description: editDescription.trim(), author: "human" })
    );
    setEditingDescription(false);
  };

  const handleAssigneeChange = async (newAssignee) => {
    await dispatch(
      updateCard({ projectId, cardId: card.cardId, assignee: newAssignee || null, author: "human" })
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await dispatch(
      addComment({
        projectId,
        cardId: card.cardId,
        message: newComment.trim(),
        author: "human",
      })
    );
    setNewComment("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} data-testid="card-detail-dialog">
      <DialogTitle>
        <Typography variant="caption" color="text.secondary">
          {card.cardId}
        </Typography>
        {editingTitle ? (
          <TextField
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            data-testid="card-title-edit"
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTitleSave();
              }
              if (e.key === "Escape") {
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <Typography
            variant="h6"
            onClick={() => {
              setEditingTitle(true);
              setEditTitle(card.title);
            }}
            sx={{ cursor: "pointer" }}
            data-testid="card-title-display"
          >
            {card.title}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {editingDescription ? (
          <TextField
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            autoFocus
            data-testid="card-description-edit"
            sx={{ mb: 2 }}
            onBlur={handleDescriptionSave}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditingDescription(false);
              }
            }}
          />
        ) : (
          <Typography
            variant="body2"
            onClick={() => {
              setEditingDescription(true);
              setEditDescription(card.description || "");
            }}
            sx={{ mb: 2, cursor: "pointer", color: card.description ? "text.primary" : "text.secondary", fontStyle: card.description ? "normal" : "italic" }}
            data-testid="card-description-display"
          >
            {card.description || "(No description)"}
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <TextField
            label="Status"
            value={editStatus || card.status || ""}
            onChange={(e) => handleStatusChange(e.target.value)}
            select
            size="small"
            data-testid="card-status-select"
            sx={{ minWidth: 140, flex: isMobile ? "1 1 100%" : undefined }}
          >
            {sortedStatuses.map((s) => (
              <MenuItem key={s.name} value={s.name}>
                {s.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Priority"
            value={editPriority || card.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            select
            size="small"
            data-testid="card-priority-select"
            sx={{ minWidth: 120, flex: isMobile ? "1 1 100%" : undefined }}
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Sprint"
            value={editSprint || getSprintDisplayName(card) || ""}
            onChange={(e) => handleSprintChange(e.target.value)}
            select
            size="small"
            sx={{ minWidth: 140, flex: isMobile ? "1 1 100%" : undefined }}
          >
            <MenuItem value="">No Sprint</MenuItem>
            {sprints.map((s) => (
              <MenuItem key={s.objectId} value={s.name}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            label="Assignee"
            value={card.assignee || ""}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            select
            size="small"
            data-testid="card-assignee-select"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Unassigned</MenuItem>
            {agents.map((a) => (
              <MenuItem key={a.name} value={a.name}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <Chip
            label={card.priority}
            size="small"
            color={PRIORITY_COLORS[card.priority] || "default"}
          />
          {(card.sprintName || card.sprint) && (
            <Chip
              label={`Sprint: ${getSprintDisplayName(card)}`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}
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
            data-testid="card-comment-input"
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
