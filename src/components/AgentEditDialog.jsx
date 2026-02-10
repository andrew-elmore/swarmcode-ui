import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const ALL_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep"];

export default function AgentEditDialog({ open, onClose, agent, onSave }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isNew = !agent;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [openingInstructions, setOpeningInstructions] = useState("");
  const [permanentMemory, setPermanentMemory] = useState("");
  const [allowedTools, setAllowedTools] = useState([...ALL_TOOLS]);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setOpeningInstructions(agent.openingInstructions || "");
      setPermanentMemory(agent.permanentMemory || "");
      setAllowedTools(agent.permissions?.allowedTools || [...ALL_TOOLS]);
      setSortOrder(agent.sortOrder || 0);
    } else {
      setName("");
      setDescription("");
      setOpeningInstructions("");
      setPermanentMemory("");
      setAllowedTools([...ALL_TOOLS]);
      setSortOrder(0);
    }
  }, [agent, open]);

  const handleToolToggle = (tool) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description,
        openingInstructions,
        permanentMemory,
        permissions: { allowedTools },
        sortOrder: Number(sortOrder) || 0,
      });
      onClose();
    } catch {
      // Error handled by Redux slice
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>{isNew ? "Create Agent" : `Edit ${agent?.name}`}</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoFocus={isNew}
          margin="dense"
          disabled={!isNew}
          placeholder="my-agent-1"
          helperText={isNew ? "Lowercase letters, numbers, and hyphens (2-30 chars)" : undefined}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          margin="dense"
          placeholder="Brief role description"
        />
        <TextField
          label="Opening Instructions"
          value={openingInstructions}
          onChange={(e) => setOpeningInstructions(e.target.value)}
          fullWidth
          margin="dense"
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Prompt sent when agent starts"
        />
        <TextField
          label="Permanent Memory"
          value={permanentMemory}
          onChange={(e) => setPermanentMemory(e.target.value)}
          fullWidth
          margin="dense"
          multiline
          minRows={3}
          maxRows={8}
          placeholder="Role context re-injected after context compression"
        />
        <TextField
          label="Sort Order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          fullWidth
          margin="dense"
          type="number"
          inputProps={{ min: 0 }}
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Allowed Tools
          </Typography>
          <FormGroup row>
            {ALL_TOOLS.map((tool) => (
              <FormControlLabel
                key={tool}
                control={
                  <Checkbox
                    checked={allowedTools.includes(tool)}
                    onChange={() => handleToolToggle(tool)}
                    size="small"
                  />
                }
                label={tool}
              />
            ))}
          </FormGroup>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !name.trim()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? "Saving..." : isNew ? "Create" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
