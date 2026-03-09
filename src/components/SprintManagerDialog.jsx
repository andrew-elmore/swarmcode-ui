import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAppDispatch, useAppSelector } from "../store";
import { createSprint, updateSprint, deleteSprint } from "../store/projectSlice";

export default function SprintManagerDialog({ open, onClose, projectId }) {
  const dispatch = useAppDispatch();
  const { sprints } = useAppSelector((s) => s.project);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const sorted = [...sprints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleCreate = async () => {
    if (!newName.trim() || !projectId) return;
    await dispatch(
      createSprint({ projectId, name: newName.trim(), order: sprints.length })
    );
    setNewName("");
  };

  const handleRename = async (sprint) => {
    if (!editName.trim() || editName.trim() === sprint.name) {
      setEditingId(null);
      return;
    }
    await dispatch(
      updateSprint({ projectId, sprintId: sprint.objectId, name: editName.trim() })
    );
    setEditingId(null);
  };

  const handleReorder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[targetIndex];
    await dispatch(
      updateSprint({ projectId, sprintId: a.objectId, order: b.order ?? targetIndex })
    );
    await dispatch(
      updateSprint({ projectId, sprintId: b.objectId, order: a.order ?? index })
    );
  };

  const handleDelete = async (sprint) => {
    if (!window.confirm(`Delete sprint "${sprint.name}"?`)) return;
    await dispatch(deleteSprint({ projectId, sprintId: sprint.objectId }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-testid="sprint-manager-dialog">
      <DialogTitle>Manage Sprints</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 1, mb: 2, mt: 1 }}>
          <TextField
            label="New sprint name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            size="small"
            fullWidth
            data-testid="sprint-new-name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim()}
            data-testid="sprint-add-button"
          >
            Add
          </Button>
        </Box>

        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No sprints yet. Create one above.
          </Typography>
        ) : (
          <List dense>
            {sorted.map((sprint, index) => (
              <ListItem
                key={sprint.objectId}
                data-testid="sprint-list-item"
                secondaryAction={
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleReorder(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                      data-testid="sprint-move-up"
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleReorder(index, 1)}
                      disabled={index === sorted.length - 1}
                      title="Move down"
                      data-testid="sprint-move-down"
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(sprint)}
                      title="Delete sprint"
                      data-testid="sprint-delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                {editingId === sprint.objectId ? (
                  <TextField
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    size="small"
                    autoFocus
                    data-testid="sprint-edit-name"
                    onBlur={() => handleRename(sprint)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRename(sprint);
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    sx={{ mr: 2 }}
                  />
                ) : (
                  <ListItemText
                    primary={sprint.name}
                    onClick={() => {
                      setEditingId(sprint.objectId);
                      setEditName(sprint.name);
                    }}
                    sx={{ cursor: "pointer" }}
                  />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
