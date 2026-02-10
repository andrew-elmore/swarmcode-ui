import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import StopIcon from "@mui/icons-material/Stop";

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
];

export default function TtsControls({ engine }) {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");

  // Load available voices
  useEffect(() => {
    if (!engine) return;
    const loadVoices = () => {
      const v = engine.getVoices();
      setVoices(v);
      if (engine.voice && !selectedVoice) {
        setSelectedVoice(engine.voice.name);
      }
    };
    loadVoices();
    // Some browsers fire voiceschanged async
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [engine, selectedVoice]);

  const handleToggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    engine?.setEnabled(next);
  }, [enabled, engine]);

  const handleStop = useCallback(() => {
    engine?.stop();
  }, [engine]);

  const handleRateChange = useCallback((e) => {
    const val = e.target.value;
    setRate(val);
    engine?.setRate(val);
  }, [engine]);

  const handleVolumeChange = useCallback((_, val) => {
    setVolume(val);
    engine?.setVolume(val);
  }, [engine]);

  const handleVoiceChange = useCallback((e) => {
    const name = e.target.value;
    setSelectedVoice(name);
    const voice = voices.find((v) => v.name === name);
    if (voice) engine?.setVoice(voice);
  }, [engine, voices]);

  if (!engine) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Tooltip title={enabled ? "Disable TTS" : "Enable TTS"}>
        <IconButton size="small" onClick={handleToggle} color={enabled ? "primary" : "default"}>
          {enabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      {enabled && (
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
            value={volume}
            onChange={handleVolumeChange}
            sx={{ width: 60 }}
            aria-label="Volume"
          />

          <Select
            size="small"
            value={rate}
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
  );
}
