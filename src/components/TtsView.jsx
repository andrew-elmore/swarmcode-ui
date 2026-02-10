import { useEffect, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import {
  setEnabled,
  setVolume,
  setRate,
  setAgentVoice,
  setSpeakAgentName,
  clearError,
} from "../store/ttsSlice";
import TtsEngine from "../utils/ttsEngine";

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
];

export default function TtsView() {
  const dispatch = useAppDispatch();
  const tts = useAppSelector((s) => s.tts);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const engineRef = useRef(null);
  const [voices, setVoices] = useState([]);

  // Create a local TtsEngine for previewing voices
  useEffect(() => {
    engineRef.current = new TtsEngine();
    return () => {
      if (engineRef.current) engineRef.current.stop();
    };
  }, []);

  // Sync Redux TTS state to the preview engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setEnabled(true); // always enabled for preview
    engine.setRate(tts.rate);
    engine.setVolume(tts.volume);
  }, [tts.rate, tts.volume]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const v = engine.getVoices();
      setVoices(v);
    };
    loadVoices();
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));

  const handleToggle = useCallback(() => {
    dispatch(setEnabled(!tts.enabled));
  }, [tts.enabled, dispatch]);

  const handleVolumeChange = useCallback((_, val) => {
    dispatch(setVolume(val));
  }, [dispatch]);

  const handleRateChange = useCallback((e) => {
    dispatch(setRate(e.target.value));
  }, [dispatch]);

  const handleSpeakAgentName = useCallback((e) => {
    dispatch(setSpeakAgentName(e.target.checked));
  }, [dispatch]);

  const handleAgentVoiceChange = useCallback((agentName, voiceName) => {
    dispatch(setAgentVoice({ agent: agentName, voiceName }));
  }, [dispatch]);

  const handlePreview = useCallback((agentName) => {
    const engine = engineRef.current;
    if (!engine) return;
    const voiceName = tts.perAgentVoice[agentName];
    if (voiceName) {
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) engine.setVoice(voice);
    }
    const label = agents.find((a) => a.name === agentName)?.description || agentName;
    engine.speak(`Hello, I am ${label}.`);
  }, [tts.perAgentVoice, voices, agents]);

  const handleStopPreview = useCallback(() => {
    if (engineRef.current) engineRef.current.stop();
  }, []);

  const handleCloseError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return (
    <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Text-to-Speech</Typography>

      {/* Global controls */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Enable/Disable */}
          <FormControlLabel
            control={<Switch checked={tts.enabled} onChange={handleToggle} />}
            label={tts.enabled ? "TTS Enabled" : "TTS Disabled"}
          />

          {/* Volume */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 60 }}>Volume</Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.1}
              value={tts.volume}
              onChange={handleVolumeChange}
              sx={{ maxWidth: 200 }}
              aria-label="Volume"
            />
            <Typography variant="body2" sx={{ minWidth: 40 }}>
              {Math.round(tts.volume * 100)}%
            </Typography>
          </Box>

          {/* Speed */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 60 }}>Speed</Typography>
            <Select
              size="small"
              value={tts.rate}
              onChange={handleRateChange}
              sx={{ minWidth: 80 }}
            >
              {SPEED_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Announce agent name toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={tts.speakAgentName}
                onChange={handleSpeakAgentName}
              />
            }
            label="Announce agent name before message"
          />
        </Box>
      </Paper>

      {/* Per-agent voice config */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Per-Agent Voice
      </Typography>

      {agents.length === 0 ? (
        <Typography color="text.secondary">
          No agents loaded. Open a project to configure agent voices.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Agent</TableCell>
                <TableCell>Voice</TableCell>
                <TableCell align="right">Preview</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.name}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {agent.description || agent.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {agent.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={tts.perAgentVoice[agent.name] || ""}
                      onChange={(e) => handleAgentVoiceChange(agent.name, e.target.value)}
                      displayEmpty
                      sx={{ minWidth: isMobile ? 100 : 180, fontSize: "0.8rem" }}
                    >
                      <MenuItem value="">
                        <em>Default</em>
                      </MenuItem>
                      {englishVoices.map((v) => (
                        <MenuItem key={v.name} value={v.name}>
                          {v.name.split(" ").slice(0, 3).join(" ")}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      title="Preview voice"
                      onClick={() => handlePreview(agent.name)}
                    >
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Stop preview"
                      onClick={handleStopPreview}
                    >
                      <StopIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Error snackbar */}
      <Snackbar
        open={!!tts.error}
        autoHideDuration={5000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseError} severity="warning" variant="filled" sx={{ width: "100%" }}>
          {tts.error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
