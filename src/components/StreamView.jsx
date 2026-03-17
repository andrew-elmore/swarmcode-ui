import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import MicIcon from "@mui/icons-material/Mic";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  fetchStreamMessages,
} from "../store/ttsSlice";
import { sendMessage } from "../store/messagesSlice";
import { ttsPreprocess } from "../utils/ttsPreprocess";

// Resolved at call time (not module level) so test mocks on window are picked up
function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

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
  const { projectId: projectIdParam } = useParams();
  const tts = useAppSelector((s) => s.tts);
  const streamLoading = useAppSelector((s) => s.tts.streamLoading);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const utteranceRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const queueListRef = useRef(null);
  const speakingIndexRef = useRef(-1); // track which index we're already speaking

  // Push-to-talk state
  const [listeningAgent, setListeningAgent] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [sttStatus, setSttStatus] = useState("");
  const recognitionRef = useRef(null);
  const lastAgentRef = useRef(null); // captures agent name at recording start for dispatch after onend

  // Resolve a browser SpeechSynthesisVoice by name
  const resolveVoice = useCallback((agentName) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Per-agent voice lookup
    const agent = agents.find((a) => a.name === agentName);
    const voiceName = agent?.voice || tts.voice;

    if (voiceName) {
      const match = voices.find((v) => v.name === voiceName);
      if (match) return match;
    }
    // Fallback: first English voice or system default
    return voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
  }, [agents, tts.voice]);

  // Stop Chrome pause/resume workaround
  const stopChromeWorkaround = useCallback(() => {
    if (chromeTimerRef.current) {
      clearInterval(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
  }, []);

  // Start Chrome pause/resume workaround
  const startChromeWorkaround = useCallback(() => {
    stopChromeWorkaround();
    chromeTimerRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, CHROME_PAUSE_INTERVAL_MS);
  }, [stopChromeWorkaround]);

  // Speak the current message when currentIndex advances to a new item.
  // IMPORTANT: tts.queue is NOT in the dependency array — new messages appending
  // to the queue must not interrupt the currently speaking utterance.  We only
  // react to currentIndex changes (which the slice sets when a message starts or
  // advanceQueue is dispatched).  The queue is read from the store via the tts
  // selector at render time, so the value is always fresh.
  useEffect(() => {
    const { queue, currentIndex, enabled } = tts;
    if (!enabled || currentIndex < 0 || currentIndex >= queue.length) return;

    const item = queue[currentIndex];
    if (item.status !== "speaking") return;

    // Guard — don't re-speak the same index if the effect re-fires
    // due to rate/volume/enabled changes while already speaking this index.
    if (speakingIndexRef.current === currentIndex) return;
    speakingIndexRef.current = currentIndex;

    // Cancel any in-progress speech (safe: only reached on a genuine index change)
    window.speechSynthesis.cancel();

    const processed = ttsPreprocess(item.message);
    if (!processed) {
      // Empty after preprocessing — skip to next
      speakingIndexRef.current = -1;
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
      speakingIndexRef.current = -1;
      dispatch(advanceQueue());
    };
    utterance.onerror = (e) => {
      stopChromeWorkaround();
      speakingIndexRef.current = -1;
      // 'canceled' is not a real error — happens on skip/stop
      if (e.error !== "canceled") {
        dispatch(setError(`Speech error: ${e.error}`));
      }
      dispatch(advanceQueue());
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    startChromeWorkaround();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tts.queue/rate/volume intentionally omitted; queue changes must not interrupt speech
  }, [tts.currentIndex, tts.enabled, dispatch, resolveVoice, startChromeWorkaround, stopChromeWorkaround]);

  // Auto-scroll queue list to current item
  useEffect(() => {
    if (tts.currentIndex >= 0 && queueListRef.current) {
      const items = queueListRef.current.querySelectorAll("[data-queue-item]");
      if (items[tts.currentIndex]) {
        items[tts.currentIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [tts.currentIndex]);

  // Auto-scroll to bottom on new messages (load + LiveQuery arrivals)
  useEffect(() => {
    if (queueListRef.current) {
      queueListRef.current.scrollTop = queueListRef.current.scrollHeight;
    }
  }, [tts.queue.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopChromeWorkaround();
      speakingIndexRef.current = -1;
    };
  }, [stopChromeWorkaround]);

  // Preload last 20 messages on mount
  useEffect(() => {
    if (projectIdParam) {
      dispatch(fetchStreamMessages(projectIdParam));
    }
  }, [dispatch, projectIdParam]);

  // Push-to-talk handlers
  const handleMicDown = useCallback((agentName) => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setSttStatus("Voice commands not supported in this browser");
      return;
    }

    setSttStatus("");
    setTranscript("");
    lastAgentRef.current = agentName;
    setListeningAgent(agentName);

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    recognition.onerror = (event) => {
      const errorMessages = {
        "not-allowed": "Microphone access denied",
        "no-speech": "No speech detected, try again",
        "network": "Speech recognition unavailable",
      };
      setSttStatus(errorMessages[event.error] || `Speech error: ${event.error}`);
      setListeningAgent(null);
    };

    recognition.onend = () => {
      setListeningAgent(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const handleMicUp = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Process transcript after recognition ends and transcript is finalized
  useEffect(() => {
    if (listeningAgent || !transcript) return;

    const target = lastAgentRef.current;
    if (!target) return;

    dispatch(sendMessage({ to: target, message: transcript }));
    setSttStatus(target === "all" ? "Sent to all agents" : `Sent to ${target}`);
    setTranscript("");
  }, [listeningAgent, transcript, dispatch]);

  const handleToggle = useCallback(() => {
    if (tts.enabled) {
      window.speechSynthesis.cancel();
      stopChromeWorkaround();
      speakingIndexRef.current = -1;
      dispatch(clearQueue());
      dispatch(setEnabled(false));
    } else {
      dispatch(setEnabled(true));
    }
  }, [tts.enabled, dispatch, stopChromeWorkaround]);

  const handleSkip = useCallback(
    (index) => {
      window.speechSynthesis.cancel();
      speakingIndexRef.current = -1;
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
      data-testid="stream-view"
      sx={{
        p: isMobile ? 2 : 3,
        maxWidth: 640,
        width: "100%",
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        mt: isMobile ? 2 : 4,
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6">Audio Stream</Typography>
        <IconButton
          size="small"
          onClick={() => dispatch(fetchStreamMessages(projectIdParam))}
          disabled={streamLoading}
          data-testid="stream-refresh"
          aria-label="Refresh stream"
        >
          {streamLoading ? <CircularProgress size={18} /> : <RefreshIcon />}
        </IconButton>
      </Box>

      {/* Compact control bar: play/stop + status + volume + speed */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
        }}
      >
        <IconButton
          onClick={handleToggle}
          size="small"
          color={tts.enabled ? "error" : "primary"}
          sx={{ width: 40, height: 40, border: 1.5, borderColor: tts.enabled ? "error.main" : "primary.main", flexShrink: 0 }}
          aria-label={tts.enabled ? "Stop stream" : "Start stream"}
          data-testid="stream-toggle"
        >
          {tts.enabled ? <StopIcon sx={{ fontSize: 22 }} /> : <PlayArrowIcon sx={{ fontSize: 22 }} />}
        </IconButton>

        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ minWidth: 64, flexShrink: 0 }}
          data-testid="stream-status"
        >
          {tts.enabled
            ? tts.currentIndex >= 0 ? "Speaking..." : "Listening"
            : "Paused"}
        </Typography>

        <Slider
          size="small"
          min={0}
          max={1}
          step={0.05}
          value={tts.volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
          data-testid="stream-volume"
          sx={{ flex: 1, mx: 0.5 }}
        />

        <Typography variant="caption" sx={{ minWidth: 30, textAlign: "right", flexShrink: 0 }}>
          {Math.round(tts.volume * 100)}%
        </Typography>

        <Select
          size="small"
          value={tts.rate}
          onChange={handleSpeedChange}
          sx={{ minWidth: 70, flexShrink: 0 }}
          data-testid="stream-speed"
        >
          {SPEED_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </Box>

      {/* Message queue */}
      <Box
        sx={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
        }}
        ref={queueListRef}
        data-testid="stream-queue"
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
                data-testid="stream-queue-item"
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
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                        {item.from}
                      </Typography>
                      {item.createdAt && (
                        <Typography variant="caption" color="text.secondary" component="span" data-testid="queue-item-timestamp">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      )}
                    </Box>
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

      {/* Per-agent hold-to-talk buttons */}
      <Divider sx={{ width: "100%", maxWidth: 300, my: 1 }} />
      <Typography variant="subtitle2" color="text.secondary">
        Voice Commands
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 1, width: "100%", pb: 0.5 }}>
        {agents.map((agent) => (
          <Box key={agent.name} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            <IconButton
              onPointerDown={() => handleMicDown(agent.name)}
              onPointerUp={handleMicUp}
              onPointerLeave={listeningAgent === agent.name ? handleMicUp : undefined}
              color={listeningAgent === agent.name ? "error" : "default"}
              sx={{
                width: 40,
                height: 40,
                border: 2,
                borderColor: listeningAgent === agent.name ? "error.main" : "grey.400",
                ...(listeningAgent === agent.name && {
                  animation: "pulse 1s ease-in-out infinite",
                  "@keyframes pulse": {
                    "0%": { boxShadow: "0 0 0 0 rgba(211,47,47,0.4)" },
                    "70%": { boxShadow: "0 0 0 12px rgba(211,47,47,0)" },
                    "100%": { boxShadow: "0 0 0 0 rgba(211,47,47,0)" },
                  },
                }),
              }}
              aria-label={`Hold to send to ${agent.name}`}
              data-testid={`stt-button-${agent.name}`}
            >
              <MicIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Typography variant="caption">{agent.name}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <IconButton
            onPointerDown={() => handleMicDown("all")}
            onPointerUp={handleMicUp}
            onPointerLeave={listeningAgent === "all" ? handleMicUp : undefined}
            color={listeningAgent === "all" ? "error" : "default"}
            sx={{
              width: 40,
              height: 40,
              border: 2,
              borderColor: listeningAgent === "all" ? "error.main" : "grey.400",
              ...(listeningAgent === "all" && {
                animation: "pulse 1s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%": { boxShadow: "0 0 0 0 rgba(211,47,47,0.4)" },
                  "70%": { boxShadow: "0 0 0 12px rgba(211,47,47,0)" },
                  "100%": { boxShadow: "0 0 0 0 rgba(211,47,47,0)" },
                },
              }),
            }}
            aria-label="Hold to send to all agents"
            data-testid="stt-button-all"
          >
            <MicIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="caption">All Agents</Typography>
        </Box>
      </Box>

      {/* STT status */}
      <Typography
        variant="body2"
        color={sttStatus && sttStatus.startsWith("Sent") ? "success.main" : sttStatus ? "error" : "text.secondary"}
        sx={{ minHeight: 24, textAlign: "center", maxWidth: 340 }}
        data-testid="mic-status"
      >
        {sttStatus || (listeningAgent ? `Listening for ${listeningAgent}...` : "Hold a button to speak")}
      </Typography>

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
