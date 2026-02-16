// CommandsView.jsx — Remote agent command panel

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useAppDispatch, useAppSelector } from "../store";
import {
  createCommand,
  fetchRecentCommands,
  fetchLatestPing,
} from "../store/commandsSlice";

const STATUS_COLORS = {
  requested: "warning",
  fulfilled: "success",
  error: "error",
};

const ACTION_LABELS = {
  stop_all: "Stop All",
  start_all: "Start All",
  restart_all: "Restart All",
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return "never";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatTimestamp(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function CommandsView() {
  const dispatch = useAppDispatch();
  const projectHash = useAppSelector((s) => s.board.board?.projectHash);
  const { commands, latestPing, loading, sending, error } = useAppSelector((s) => s.commands);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Time-since-last-ping ticker (updates every second)
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data (skip if already populated from preloaded/LiveQuery state)
  useEffect(() => {
    if (projectHash) {
      if (commands.length === 0 && !error) dispatch(fetchRecentCommands(projectHash));
      if (!latestPing) dispatch(fetchLatestPing(projectHash));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectHash]);

  const handleCommand = useCallback(
    (action) => {
      if (projectHash) {
        dispatch(createCommand({ projectHash, action }));
      }
    },
    [dispatch, projectHash]
  );

  // Ping status
  const pingAge = latestPing?.updatedAt
    ? Math.floor((Date.now() - new Date(latestPing.updatedAt).getTime()) / 1000)
    : Infinity;
  const isOnline = pingAge < 60;

  return (
    <Box
      sx={{
        p: isMobile ? 2 : 3,
        maxWidth: 560,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        mt: isMobile ? 1 : 2,
      }}
    >
      <Typography variant="h6">Remote Agent Control</Typography>

      {/* Orchestrator status */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }} data-testid="orchestrator-status">
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: isOnline ? "success.main" : "error.main",
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Orchestrator:{" "}
          <strong>{isOnline ? "Online" : "Offline"}</strong>
          {" — "}
          last ping {formatTimeAgo(latestPing?.updatedAt)}
        </Typography>
      </Box>

      {/* Agent statuses from ping */}
      {latestPing?.agentStatus && Object.keys(latestPing.agentStatus).length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {Object.entries(latestPing.agentStatus).map(([name, status]) => (
            <Chip
              key={name}
              label={`${name}: ${status}`}
              size="small"
              color={status === "running" || status === "idle" ? "success" : "default"}
              variant="outlined"
            />
          ))}
        </Box>
      )}

      <Divider />

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="error"
          startIcon={<StopIcon />}
          onClick={() => handleCommand("stop_all")}
          disabled={sending}
          data-testid="command-button-stop_all"
        >
          Stop All
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<PlayArrowIcon />}
          onClick={() => handleCommand("start_all")}
          disabled={sending}
          data-testid="command-button-start_all"
        >
          Start All
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<RestartAltIcon />}
          onClick={() => handleCommand("restart_all")}
          disabled={sending}
          data-testid="command-button-restart_all"
        >
          Restart All
        </Button>
      </Box>

      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}

      <Divider />

      {/* Recent commands */}
      <Typography variant="subtitle2" color="text.secondary">
        Recent Commands
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : commands.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
          No commands yet
        </Typography>
      ) : (
        <List dense disablePadding>
          {commands.map((cmd) => (
            <ListItem
              key={cmd.objectId}
              data-testid="command-history-item"
              sx={{
                borderLeft: `3px solid`,
                borderColor: `${STATUS_COLORS[cmd.status] || "grey"}.main`,
                mb: 0.5,
                bgcolor: theme.palette.background.paper,
                borderRadius: 1,
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ACTION_LABELS[cmd.action] || cmd.action}
                    </Typography>
                    <Chip
                      label={cmd.status}
                      size="small"
                      color={STATUS_COLORS[cmd.status] || "default"}
                    />
                  </Box>
                }
                secondary={
                  <>
                    {formatTimestamp(cmd.createdAt)}
                    {cmd.error && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        {cmd.error}
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
