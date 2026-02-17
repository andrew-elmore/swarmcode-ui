import { useState, useRef, useEffect, useCallback } from "react";
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
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import MicIcon from "@mui/icons-material/Mic";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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
import { sendMessage } from "../store/messagesSlice";
import { ttsPreprocess } from "../utils/ttsPreprocess";
import { parseVoiceCommand } from "../utils/voiceCommandParser";

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
  const tts = useAppSelector((s) => s.tts);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const utteranceRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const queueListRef = useRef(null);
  const speakingIndexRef = useRef(-1); // track which index we're already speaking

  // Push-to-talk state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micError, setMicError] = useState("");
  const [sentConfirmation, setSentConfirmation] = useState("");
  const recognitionRef = useRef(null);
  const sentTimerRef = useRef(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopChromeWorkaround();
      speakingIndexRef.current = -1;
    };
  }, [stopChromeWorkaround]);

  // Push-to-talk handlers
  const handleMicDown = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setMicError("Voice commands not supported in this browser");
      return;
    }

    setMicError("");
    setTranscript("");
    setSentConfirmation("");

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
      setMicError(errorMessages[event.error] || `Speech error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const handleMicUp = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Process transcript after recognition ends and transcript is finalized
  // setState is gated by isListening flag set in onend callback; this reacts to finalized speech input
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isListening || !transcript) return;

    const parsed = parseVoiceCommand(transcript);
    if (!parsed) {
      setMicError("Couldn't identify agent. Try: \"pm one, create a login page\"");
      return;
    }
    if (!parsed.message) {
      setMicError("Please include a message after the agent name");
      return;
    }

    dispatch(sendMessage({ to: parsed.agent, message: parsed.message }));
    setSentConfirmation(
      parsed.agent === "all" ? "Sent to all agents" : `Sent to ${parsed.agent}`
    );

    setTranscript("");

    // Clear confirmation after 2 seconds
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    sentTimerRef.current = setTimeout(() => setSentConfirmation(""), 2000);
  }, [isListening, transcript, dispatch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cleanup sent timer on unmount
  useEffect(() => {
    return () => {
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    };
  }, []);

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
        data-testid="stream-toggle"
      >
        {tts.enabled ? (
          <StopIcon sx={{ fontSize: 40 }} />
        ) : (
          <PlayArrowIcon sx={{ fontSize: 40 }} />
        )}
      </IconButton>

      <Typography variant="body2" color="text.secondary" data-testid="stream-status">
        {tts.enabled
          ? tts.currentIndex >= 0
            ? "Speaking..."
            : "Listening for messages"
          : "Press play to start"}
      </Typography>

      {/* Message queue */}
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
      <Box sx={{ width: "100%", maxWidth: 300 }} data-testid="stream-volume">
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
          data-testid="stream-speed"
        >
          {SPEED_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Push-to-talk mic button */}
      <Divider sx={{ width: "100%", maxWidth: 300, my: 1 }} />
      <Typography variant="subtitle2" color="text.secondary">
        Voice Command
      </Typography>
      <IconButton
        onPointerDown={handleMicDown}
        onPointerUp={handleMicUp}
        onPointerLeave={isListening ? handleMicUp : undefined}
        color={isListening ? "error" : "default"}
        sx={{
          width: 64,
          height: 64,
          border: 2,
          borderColor: isListening ? "error.main" : "grey.400",
          ...(isListening && {
            animation: "pulse 1s ease-in-out infinite",
            "@keyframes pulse": {
              "0%": { boxShadow: "0 0 0 0 rgba(211,47,47,0.4)" },
              "70%": { boxShadow: "0 0 0 12px rgba(211,47,47,0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(211,47,47,0)" },
            },
          }),
        }}
        aria-label={isListening ? "Listening..." : "Hold to speak"}
        data-testid="mic-button"
      >
        {sentConfirmation ? (
          <CheckCircleIcon sx={{ fontSize: 32, color: "success.main" }} />
        ) : (
          <MicIcon sx={{ fontSize: 32 }} />
        )}
      </IconButton>

      {/* Live transcript / status */}
      <Typography
        variant="body2"
        color={micError ? "error" : sentConfirmation ? "success.main" : "text.secondary"}
        sx={{ minHeight: 24, textAlign: "center", maxWidth: 340 }}
        data-testid="mic-status"
      >
        {micError
          || sentConfirmation
          || (isListening
            ? (transcript || "Listening...")
            : "Hold mic to speak a command")}
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
