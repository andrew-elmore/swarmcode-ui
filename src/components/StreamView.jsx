import { useRef, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { useAppDispatch, useAppSelector } from "../store";
import { setEnabled, setVolume, setRate, setError, clearError } from "../store/ttsSlice";
import AudioStreamManager from "../utils/audioStreamManager";

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
];

// Singleton stream manager — shared across components
let _streamManager = null;
export function getStreamManager() {
  if (!_streamManager) _streamManager = new AudioStreamManager();
  return _streamManager;
}

export default function StreamView() {
  const dispatch = useAppDispatch();
  const tts = useAppSelector((s) => s.tts);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const managerRef = useRef(getStreamManager());

  // Wire error callback
  useEffect(() => {
    managerRef.current.setOnError((msg) => dispatch(setError(msg)));
  }, [dispatch]);

  // Sync volume/speed to manager
  useEffect(() => {
    managerRef.current.setVolume(tts.volume);
  }, [tts.volume]);

  useEffect(() => {
    managerRef.current.setSpeed(tts.rate);
  }, [tts.rate]);

  // Waveform animation loop
  useEffect(() => {
    if (!tts.enabled) {
      // Clear canvas when stopped
      const canvas = canvasRef.current;
      const ctx = canvas && canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = managerRef.current.getAnalyserNode();
      const ctx = canvas && canvas.getContext("2d");
      if (!ctx || !analyser) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = theme.palette.grey[100];
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.palette.primary.main;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [tts.enabled, theme]);

  const handleToggle = useCallback(() => {
    const mgr = managerRef.current;
    if (tts.enabled) {
      mgr.stop();
      dispatch(setEnabled(false));
    } else {
      mgr.start();
      dispatch(setEnabled(true));
    }
  }, [tts.enabled, dispatch]);

  const handleVolumeChange = useCallback(
    (_, val) => dispatch(setVolume(val)),
    [dispatch]
  );

  const handleSpeedChange = useCallback(
    (e) => dispatch(setRate(e.target.value)),
    [dispatch]
  );

  const handleCloseError = useCallback(
    () => dispatch(clearError()),
    [dispatch]
  );

  return (
    <Box
      sx={{
        p: isMobile ? 2 : 3,
        maxWidth: 480,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        mt: isMobile ? 2 : 4,
      }}
    >
      <Typography variant="h6">Audio Stream</Typography>

      {/* Play / Stop button */}
      <IconButton
        onClick={handleToggle}
        color={tts.enabled ? "error" : "primary"}
        sx={{
          width: 80,
          height: 80,
          border: 2,
          borderColor: tts.enabled ? "error.main" : "primary.main",
        }}
        aria-label={tts.enabled ? "Stop stream" : "Start stream"}
      >
        {tts.enabled ? (
          <StopIcon sx={{ fontSize: 40 }} />
        ) : (
          <PlayArrowIcon sx={{ fontSize: 40 }} />
        )}
      </IconButton>

      <Typography variant="body2" color="text.secondary">
        {tts.enabled ? "Stream active" : "Press play to start"}
      </Typography>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        width={isMobile ? 300 : 400}
        height={80}
        style={{
          width: "100%",
          maxWidth: isMobile ? 300 : 400,
          height: 80,
          borderRadius: 8,
          border: `1px solid ${theme.palette.divider}`,
        }}
      />

      {/* Volume */}
      <Box sx={{ width: "100%", maxWidth: 300 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" sx={{ minWidth: 60 }}>
            Volume
          </Typography>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={tts.volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
          />
          <Typography variant="body2" sx={{ minWidth: 40 }}>
            {Math.round(tts.volume * 100)}%
          </Typography>
        </Box>
      </Box>

      {/* Speed */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="body2">Speed</Typography>
        <Select
          size="small"
          value={tts.rate}
          onChange={handleSpeedChange}
          sx={{ minWidth: 80 }}
        >
          {SPEED_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Error snackbar */}
      <Snackbar
        open={!!tts.error}
        autoHideDuration={5000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseError}
          severity="warning"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {tts.error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
