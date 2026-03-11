import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
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
import { createStatus, updateStatus, deleteStatus } from "../store/projectSlice";

const EMPTY_FORM = { name: "", description: "", instructions: "", agentName: "" };

export default function StatusManagerDialog({ open, onClose, projectId }) {
  const dispatch = useAppDispatch();
  const statuses = useAppSelector((s) => s.project.statuses);
  const agents = useAppSelector((s) => s.agents.agents);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const sorted = [...(statuses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const formValid =
    form.name.trim() &&
    form.description.trim() &&
    form.description.length <= 500 &&
    form.instructions.trim() &&
    form.agentName;

  const handleCreate = async () => {
    if (!formValid || !projectId) return;
    await dispatch(
      createStatus({
        projectId,
        name: form.name.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        agentName: form.agentName,
        order: statuses.length,
      })
    );
    setForm(EMPTY_FORM);
  };

  const handleEditSave = async (status) => {
    const changes = {};
    if (editForm.name.trim() && editForm.name.trim() !== status.name) changes.name = editForm.name.trim();
    if (editForm.description.trim() !== status.description) changes.description = editForm.description.trim();
    if (editForm.instructions.trim() !== status.instructions) changes.instructions = editForm.instructions.trim();
    if (editForm.agentName !== status.agentName) changes.agentName = editForm.agentName || null;

    if (Object.keys(changes).length > 0) {
      await dispatch(updateStatus({ projectId, statusId: status.objectId, ...changes }));
    }
    setEditingId(null);
  };

  const handleReorder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[targetIndex];
    await dispatch(updateStatus({ projectId, statusId: a.objectId, order: b.order ?? targetIndex }));
    await dispatch(updateStatus({ projectId, statusId: b.objectId, order: a.order ?? index }));
  };

  const handleDelete = async (status) => {
    if (!window.confirm(`Delete status "${status.name}"?`)) return;
    await dispatch(deleteStatus({ projectId, statusId: status.objectId }));
  };

  const startEdit = (status) => {
    setEditingId(status.objectId);
    setEditForm({
      name: status.name,
      description: status.description || "",
      instructions: status.instructions || "",
      agentName: status.agentName || "",
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-testid="status-manager-dialog">
      <DialogTitle>Manage Statuses</DialogTitle>
      <DialogContent>
        {/* Create form */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            size="small"
            fullWidth
            data-testid="status-new-name"
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            size="small"
            fullWidth
            inputProps={{ maxLength: 500 }}
            helperText={`${form.description.length}/500`}
            data-testid="status-new-description"
          />
          <TextField
            label="Instructions"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            size="small"
            fullWidth
            multiline
            rows={3}
            data-testid="status-new-instructions"
          />
          <TextField
            label="Agent"
            value={form.agentName}
            onChange={(e) => setForm({ ...form, agentName: e.target.value })}
            select
            size="small"
            fullWidth
            data-testid="status-new-agent"
          >
            <MenuItem value="">None</MenuItem>
            {agents.map((a) => (
              <MenuItem key={a.name} value={a.name}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!formValid}
            data-testid="status-add-button"
          >
            Add
          </Button>
        </Box>

        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No statuses yet. Create one above.
          </Typography>
        ) : (
          <List dense>
            {sorted.map((status, index) => (
              <ListItem
                key={status.objectId}
                data-testid="status-list-item"
                alignItems="flex-start"
                secondaryAction={
                  editingId !== status.objectId ? (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleReorder(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                        data-testid="status-move-up"
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleReorder(index, 1)}
                        disabled={index === sorted.length - 1}
                        title="Move down"
                        data-testid="status-move-down"
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(status)}
                        title="Delete status"
                        data-testid="status-delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : null
                }
              >
                {editingId === status.objectId ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", pr: 1 }}>
                    <TextField
                      label="Name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      size="small"
                      fullWidth
                      data-testid="status-edit-name"
                    />
                    <TextField
                      label="Description"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      size="small"
                      fullWidth
                      inputProps={{ maxLength: 500 }}
                      helperText={`${editForm.description.length}/500`}
                      data-testid="status-edit-description"
                    />
                    <TextField
                      label="Instructions"
                      value={editForm.instructions}
                      onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                      size="small"
                      fullWidth
                      multiline
                      rows={3}
                      data-testid="status-edit-instructions"
                    />
                    <TextField
                      label="Agent"
                      value={editForm.agentName}
                      onChange={(e) => setEditForm({ ...editForm, agentName: e.target.value })}
                      select
                      size="small"
                      fullWidth
                      data-testid="status-edit-agent"
                    >
                      <MenuItem value="">None</MenuItem>
                      {agents.map((a) => (
                        <MenuItem key={a.name} value={a.name}>
                          {a.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="contained" onClick={() => handleEditSave(status)}>
                        Save
                      </Button>
                      <Button size="small" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {status.name}
                        {status.agentName && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            [{status.agentName}]
                          </Typography>
                        )}
                      </Typography>
                    }
                    secondary={
                      (status.description || "").length > 60
                        ? status.description.slice(0, 60) + "…"
                        : status.description
                    }
                    onClick={() => startEdit(status)}
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
