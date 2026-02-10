import { useEffect, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import StopIcon from "@mui/icons-material/Stop";
import { useAppDispatch, useAppSelector } from "../store";
import { setEnabled, setVolume, setRate, clearError } from "../store/ttsSlice";

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
];

export default function TtsControls({ engineRef }) {
  const dispatch = useAppDispatch();
  const tts = useAppSelector((s) => s.tts);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");

  // Load available voices
  useEffect(() => {
    const engine = engineRef?.current;
    if (!engine) return;
    const loadVoices = () => {
      const v = engine.getVoices();
      setVoices(v);
      if (engine.voice && !selectedVoice) {
        setSelectedVoice(engine.voice.name);
      }
    };
    loadVoices();
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [engineRef, selectedVoice]);

  const handleToggle = useCallback(() => {
    dispatch(setEnabled(!tts.enabled));
  }, [tts.enabled, dispatch]);

  const handleStop = useCallback(() => {
    engineRef?.current?.stop();
  }, [engineRef]);

  const handleRateChange = useCallback((e) => {
    dispatch(setRate(e.target.value));
  }, [dispatch]);

  const handleVolumeChange = useCallback((_, val) => {
    dispatch(setVolume(val));
  }, [dispatch]);

  const handleVoiceChange = useCallback((e) => {
    const name = e.target.value;
    setSelectedVoice(name);
    const voice = voices.find((v) => v.name === name);
    if (voice) engineRef?.current?.setVoice(voice);
  }, [engineRef, voices]);

  const handleCloseError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  if (!engineRef) return null;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title={tts.enabled ? "Disable TTS" : "Enable TTS"}>
          <IconButton size="small" onClick={handleToggle} color={tts.enabled ? "primary" : "default"}>
            {tts.enabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {tts.enabled && (
          <>
            <Tooltip title="Stop speaking">
              <IconButton size="small" onClick={handleStop}>
                <StopIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Slider
              size="small"
              min={0}
              max={1}
              step={0.1}
              value={tts.volume}
              onChange={handleVolumeChange}
              sx={{ width: 60 }}
              aria-label="Volume"
            />

            <Select
              size="small"
              value={tts.rate}
              onChange={handleRateChange}
              variant="standard"
              sx={{ fontSize: "0.75rem", minWidth: 50 }}
            >
              {SPEED_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>

            {voices.length > 0 && (
              <Select
                size="small"
                value={selectedVoice}
                onChange={handleVoiceChange}
                variant="standard"
                sx={{ fontSize: "0.75rem", maxWidth: 120 }}
                displayEmpty
              >
                {voices.filter((v) => v.lang.startsWith("en")).map((v) => (
                  <MenuItem key={v.name} value={v.name}>{v.name.split(" ").slice(0, 3).join(" ")}</MenuItem>
                ))}
              </Select>
            )}
          </>
        )}
      </Box>

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
    </>
  );
}
