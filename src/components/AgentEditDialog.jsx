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
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const ALL_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep"];

/**
 * Group browser voices by language for easier selection.
 * Returns Map<langCode, SpeechSynthesisVoice[]>
 */
function groupVoicesByLang(voices) {
  const groups = new Map();
  for (const v of voices) {
    const lang = v.lang || "unknown";
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang).push(v);
  }
  // Sort groups: English first, then alphabetical
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => {
      const aEn = a.startsWith("en");
      const bEn = b.startsWith("en");
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;
      return a.localeCompare(b);
    })
  );
  return sorted;
}

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
  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const browserVoices = window.speechSynthesis.getVoices();
      if (browserVoices.length > 0) {
        setVoices(browserVoices);
      }
    };

    // Voices may already be loaded
    loadVoices();

    // Chrome loads voices asynchronously — listen for the event
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [open]);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setOpeningInstructions(agent.openingInstructions || "");
      setPermanentMemory(agent.permanentMemory || "");
      setAllowedTools(agent.permissions?.allowedTools || [...ALL_TOOLS]);
      setSortOrder(agent.sortOrder || 0);
      setVoice(agent.voice || "");
    } else {
      setName("");
      setDescription("");
      setOpeningInstructions("");
      setPermanentMemory("");
      setAllowedTools([...ALL_TOOLS]);
      setSortOrder(0);
      setVoice("");
    }
  }, [agent, open]);

  const handleToolToggle = (tool) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handlePreviewVoice = () => {
    if (!voice || previewing) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    setPreviewing(true);

    // Cancel any in-progress speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      `Hello, I am ${description || name || "this voice"}.`
    );

    // Find the matching voice object
    const matchedVoice = voices.find((v) => v.name === voice);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setPreviewing(false);
    utterance.onerror = () => setPreviewing(false);

    window.speechSynthesis.speak(utterance);
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
        voice: voice || null,
      });
      onClose();
    } catch {
      // Error handled by Redux slice
    } finally {
      setSaving(false);
    }
  };

  // Build grouped menu items for the voice dropdown
  const groupedVoices = groupVoicesByLang(voices);
  const voiceMenuItems = [];
  for (const [lang, langVoices] of groupedVoices) {
    voiceMenuItems.push(
      <ListSubheader key={`header-${lang}`}>{lang}</ListSubheader>
    );
    for (const v of langVoices) {
      voiceMenuItems.push(
        <MenuItem key={v.name} value={v.name}>
          {v.name}{v.localService ? "" : " (remote)"}
        </MenuItem>
      );
    }
  }

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

        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", mt: 1 }}>
          <TextField
            label="Voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            select
            fullWidth
            margin="dense"
            helperText={voices.length === 0 ? "No browser voices available" : undefined}
          >
            <MenuItem value="">
              <em>Default</em>
            </MenuItem>
            {voiceMenuItems}
          </TextField>
          <IconButton
            onClick={handlePreviewVoice}
            disabled={!voice || previewing}
            title="Preview voice"
            sx={{ mb: 0.5 }}
          >
            {previewing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
          </IconButton>
        </Box>

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
