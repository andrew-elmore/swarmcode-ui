import { useRef, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { useAppDispatch, useAppSelector } from "../store";
import {
  setEnabled,
  setVolume,
  setRate,
  setError,
  clearError,
  advanceQueue,
  skipToMessage,
  clearQueue,
} from "../store/ttsSlice";
import { ttsPreprocess } from "../utils/ttsPreprocess";

/* CARD-090: Commented out — replaced by browser speechSynthesis
import AudioStreamManager from "../utils/audioStreamManager";

// Singleton stream manager — shared across components
let _streamManager = null;
export function getStreamManager() {
  if (!_streamManager) _streamManager = new AudioStreamManager();
  return _streamManager;
}
*/

const SPEED_OPTIONS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
];

// Chrome has a bug where speechSynthesis pauses after ~15 seconds.
// Workaround: periodically pause/resume while speaking.
const CHROME_PAUSE_INTERVAL_MS = 14000;

export default function StreamView() {
  const dispatch = useAppDispatch();
  const tts = useAppSelector((s) => s.tts);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const utteranceRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const queueListRef = useRef(null);

  // Resolve a browser SpeechSynthesisVoice by name
  const resolveVoice = useCallback((agentName) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // CARD-090 Phase 8: per-agent voice lookup
    const agent = agents.find((a) => a.name === agentName);
    const voiceName = agent?.voice || tts.voice;

    if (voiceName) {
      const match = voices.find((v) => v.name === voiceName);
      if (match) return match;
    }
    // Fallback: first English voice or system default
    return voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
  }, [agents, tts.voice]);

  // Start Chrome pause/resume workaround
  const startChromeWorkaround = useCallback(() => {
    stopChromeWorkaround();
    chromeTimerRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, CHROME_PAUSE_INTERVAL_MS);
  }, []);

  const stopChromeWorkaround = useCallback(() => {
    if (chromeTimerRef.current) {
      clearInterval(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
  }, []);

  // Speak the current message when currentIndex changes to a 'speaking' item
  useEffect(() => {
    const { queue, currentIndex, enabled } = tts;
    if (!enabled || currentIndex < 0 || currentIndex >= queue.length) return;

    const item = queue[currentIndex];
    if (item.status !== "speaking") return;

    // Cancel any in-progress speech
    window.speechSynthesis.cancel();

    const processed = ttsPreprocess(item.message);
    if (!processed) {
      // Empty after preprocessing — skip to next
      dispatch(advanceQueue());
      return;
    }

    const utterance = new SpeechSynthesisUtterance(processed);
    utterance.rate = tts.rate;
    utterance.volume = tts.volume;

    const voice = resolveVoice(item.from);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      stopChromeWorkaround();
      dispatch(advanceQueue());
    };
    utterance.onerror = (e) => {
      stopChromeWorkaround();
      // 'canceled' is not a real error — happens on skip/stop
      if (e.error !== "canceled") {
        dispatch(setError(`Speech error: ${e.error}`));
      }
      dispatch(advanceQueue());
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    startChromeWorkaround();
  }, [tts.currentIndex, tts.queue, tts.enabled, tts.rate, tts.volume, dispatch, resolveVoice, startChromeWorkaround, stopChromeWorkaround]);

  // Auto-scroll queue list to current item
  useEffect(() => {
    if (tts.currentIndex >= 0 && queueListRef.current) {
      const items = queueListRef.current.querySelectorAll("[data-queue-item]");
      if (items[tts.currentIndex]) {
        items[tts.currentIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [tts.currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopChromeWorkaround();
    };
  }, [stopChromeWorkaround]);

  const handleToggle = useCallback(() => {
    if (tts.enabled) {
      window.speechSynthesis.cancel();
      stopChromeWorkaround();
      dispatch(clearQueue());
      dispatch(setEnabled(false));
    } else {
      dispatch(setEnabled(true));
    }
  }, [tts.enabled, dispatch, stopChromeWorkaround]);

  const handleSkip = useCallback(
    (index) => {
      window.speechSynthesis.cancel();
      dispatch(skipToMessage(index));
    },
    [dispatch]
  );

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
        gap: 2,
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
        {tts.enabled
          ? tts.currentIndex >= 0
            ? "Speaking..."
            : "Listening for messages"
          : "Press play to start"}
      </Typography>

      {/* CARD-090: Visible message queue (replaces waveform canvas) */}
      <Box
        sx={{
          width: "100%",
          maxWidth: isMobile ? 300 : 400,
          maxHeight: 240,
          overflow: "auto",
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
        }}
        ref={queueListRef}
      >
        {tts.queue.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ p: 2, textAlign: "center" }}
          >
            {tts.enabled ? "No messages yet" : "Queue empty"}
          </Typography>
        ) : (
          <List dense disablePadding>
            {tts.queue.map((item, index) => (
              <ListItemButton
                key={item.id}
                data-queue-item
                selected={index === tts.currentIndex}
                onClick={() => handleSkip(index)}
                disabled={item.status === "done"}
                sx={{
                  opacity: item.status === "done" ? 0.5 : 1,
                  bgcolor:
                    index === tts.currentIndex
                      ? `${theme.palette.primary.main}14`
                      : "transparent",
                  borderLeft:
                    index === tts.currentIndex
                      ? `3px solid ${theme.palette.primary.main}`
                      : "3px solid transparent",
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ fontWeight: 600 }}
                    >
                      {item.from}
                    </Typography>
                  }
                  secondary={
                    item.message.length > 80
                      ? item.message.slice(0, 80) + "..."
                      : item.message
                  }
                  secondaryTypographyProps={{
                    variant: "caption",
                    noWrap: false,
                    sx: {
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

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
