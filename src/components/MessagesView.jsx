import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useAppDispatch, useAppSelector } from "../store";
import { pollMessages, sendMessage } from "../store/messagesSlice";

const AGENTS = ["pm-1", "senior-dev-1", "developer-1", "qa-1", "devops-1"];

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { messages, sending, error, lastPoll } = useAppSelector((s) => s.messages);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [expandedIdx, setExpandedIdx] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    dispatch(pollMessages());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(pollMessages(lastPoll));
  };

  const handleSend = async () => {
    if (!from || !to || !subject.trim() || !message.trim()) return;
    await dispatch(sendMessage({ from, to, subject: subject.trim(), message: message.trim() }));
    setSubject("");
    setMessage("");
  };

  return (
    <Box sx={{ p: isMobile ? 1 : 2, display: "flex", gap: isMobile ? 2 : 3, flexWrap: "wrap" }}>
      {/* Inbox */}
      <Box sx={{ flex: "1 1 400px", minWidth: isMobile ? "100%" : 300 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h5" sx={{ fontSize: isMobile ? "1.2rem" : undefined }}>
            Inbox
          </Typography>
          <Button startIcon={<RefreshIcon />} onClick={handleRefresh} size="small">
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {messages.length === 0 ? (
          <Typography color="text.secondary">No messages.</Typography>
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {[...messages].reverse().map((msg, i) => {
                const idx = messages.length - 1 - i;
                const isExpanded = expandedIdx === idx;
                return (
                  <Box key={idx}>
                    {i > 0 && <Divider />}
                    <ListItemButton
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 0.75 : 1 }}
                    >
                      <ListItemText
                        primary={msg.subject}
                        secondary={
                          isMobile
                            ? `${msg.from} → ${msg.to}`
                            : `From: ${msg.from} → ${msg.to} — ${new Date(msg.createdAt).toLocaleString()}`
                        }
                        primaryTypographyProps={{
                          variant: isMobile ? "body2" : "body1",
                          noWrap: isMobile,
                        }}
                        secondaryTypographyProps={{
                          variant: "caption",
                          noWrap: isMobile,
                        }}
                      />
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    <Collapse in={isExpanded}>
                      <Box sx={{ px: isMobile ? 2 : 3, pb: 2 }}>
                        {isMobile && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {new Date(msg.createdAt).toLocaleString()}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {msg.message}
                        </Typography>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </Paper>
        )}
      </Box>

      {/* Send Form */}
      <Paper
        variant="outlined"
        sx={{
          flex: isMobile ? "1 1 100%" : "0 1 360px",
          p: isMobile ? 1.5 : 2,
          alignSelf: "flex-start",
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontSize: isMobile ? "1rem" : undefined }}>
          Send Message
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            select
            size="small"
            fullWidth
          >
            {AGENTS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            select
            size="small"
            fullWidth
          >
            {AGENTS.filter((a) => a !== from).map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={isMobile ? 3 : 4}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSend}
            disabled={sending || !from || !to || !subject.trim() || !message.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
