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
import { useAppDispatch } from "../store";
import { createCard } from "../store/boardSlice";

const STATUSES = ["backlog", "todo", "in_progress", "review", "qa", "done"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const AGENTS = ["pm-1", "senior-dev-1", "developer-1", "qa-1", "devops-1"];

export default function CreateCardDialog({ open, onClose, projectHash }) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("backlog");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");

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
        author: "human",
      })
    );
    setTitle("");
    setDescription("");
    setStatus("backlog");
    setPriority("medium");
    setAssignee("");
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
          {AGENTS.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
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
