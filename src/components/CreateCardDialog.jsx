import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { createCard } from "../store/projectSlice";
import { PRIORITIES } from "../constants";

export default function CreateCardDialog({ open, onClose, projectId }) {
  const dispatch = useAppDispatch();
  const { sprints, statuses } = useAppSelector((s) => s.project);
  const agents = useAppSelector((s) => s.agents.agents);
  const sortedStatuses = [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(sortedStatuses[0]?.name || "");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !projectId) return;
    await dispatch(
      createCard({
        projectId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignee: assignee || null,
        sprint: sprint || null,
        author: "human",
      })
    );
    setTitle("");
    setDescription("");
    setStatus(sortedStatuses[0]?.name || "");
    setPriority("medium");
    setAssignee("");
    setSprint("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>Create Card</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          fullWidth
          margin="dense"
          data-testid="card-title-input"
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />
        <TextField
          label="Status"
          value={status || sortedStatuses[0]?.name || ""}
          onChange={(e) => setStatus(e.target.value)}
          select
          fullWidth
          data-testid="card-status-select"
        >
          {sortedStatuses.map((s) => (
            <MenuItem key={s.name} value={s.name}>
              {s.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          select
          fullWidth
          data-testid="card-priority-select"
        >
          {PRIORITIES.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Assignee"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          select
          fullWidth
        >
          <MenuItem value="">Unassigned</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.name} value={a.name}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Sprint"
          value={sprint}
          onChange={(e) => setSprint(e.target.value)}
          select
          fullWidth
        >
          <MenuItem value="">No Sprint</MenuItem>
          {sprints.map((s) => (
            <MenuItem key={s.objectId} value={s.name}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
