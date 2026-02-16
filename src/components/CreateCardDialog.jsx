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
import { createCard } from "../store/boardSlice";
import { STATUSES, PRIORITIES } from "../constants";

export default function CreateCardDialog({ open, onClose, projectHash }) {
  const dispatch = useAppDispatch();
  const { sprints } = useAppSelector((s) => s.board);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("create");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !projectHash) return;
    await dispatch(
      createCard({
        projectHash,
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
    setStatus("create");
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          select
          fullWidth
          data-testid="card-status-select"
        >
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {s.replace("_", " ")}
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
