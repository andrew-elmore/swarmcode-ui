import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import SendIcon from "@mui/icons-material/Send";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { useAppDispatch, useAppSelector } from "../store";
import { sendMessage, loadConversation, loadMoreMessages } from "../store/messagesSlice";

export default function ChatView() {
  const dispatch = useAppDispatch();
  const { conversations, selectedAgent, sending } = useAppSelector((s) => s.messages);
  const agents = useAppSelector((s) => s.agents.agents);

  // Build label lookup from dynamic agents list
  const agentLabels = { all: "All Agents" };
  agents.forEach((a) => { agentLabels[a.name] = a.description || a.name; });
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const convo = selectedAgent ? conversations[selectedAgent] : null;
  const messages = convo ? convo.messages : [];
  const hasMore = convo?.hasMore ?? false;
  const loadingMore = convo?.loadingMore ?? false;
  const isLoadingMoreRef = useRef(false);

  // Load conversation when agent is selected
  useEffect(() => {
    if (selectedAgent && convo && !convo.loaded) {
      dispatch(loadConversation(selectedAgent));
    }
  }, [selectedAgent, convo, dispatch]);

  // Auto-scroll to bottom only for new messages (not when loading older ones)
  useEffect(() => {
    if (isLoadingMoreRef.current) {
      isLoadingMoreRef.current = false;
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleLoadMore = async () => {
    if (!selectedAgent || !hasMore || loadingMore) return;
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    isLoadingMoreRef.current = true;
    await dispatch(loadMoreMessages(selectedAgent));
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeight;
      }
    });
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !selectedAgent || sending) return;
    dispatch(sendMessage({ to: selectedAgent, message: trimmed }));
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Placeholder when no agent is selected
  if (!selectedAgent) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
          gap: 2,
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">
          Select an agent to start chatting
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: { xs: 0.75, md: 1.5 },
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {agentLabels[selectedAgent] || selectedAgent}
        </Typography>
        {selectedAgent !== "all" && (
          <Typography variant="caption" color="text.secondary">
            {selectedAgent}
          </Typography>
        )}
      </Box>

      {/* Messages area */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: "auto",
          px: 2,
          py: { xs: 1, md: 2 },
          display: "flex",
          flexDirection: "column",
          gap: 1,
          bgcolor: "grey.50",
        }}
      >
        {hasMore && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <Button size="small" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load older messages"}
            </Button>
          </Box>
        )}

        {messages.length === 0 && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No messages yet. Send a message to get started.
            </Typography>
          </Box>
        )}

        {messages.map((msg, i) => {
          const isOwner = msg.from === "owner";
          return (
            <Box
              key={msg.id || `msg-${i}`}
              sx={{
                display: "flex",
                justifyContent: isOwner ? "flex-end" : "flex-start",
                mb: 0.5,
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1,
                  maxWidth: "75%",
                  bgcolor: isOwner ? "primary.main" : "background.paper",
                  color: isOwner ? "primary.contrastText" : "text.primary",
                  borderRadius: 2,
                  border: isOwner ? "none" : 1,
                  borderColor: "divider",
                }}
              >
                {!isOwner && (
                  <Typography variant="caption" color={isOwner ? "inherit" : "text.secondary"} sx={{ display: "block", mb: 0.25, fontWeight: 600 }}>
                    {agentLabels[msg.from] || msg.from}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.message}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 0.5,
                    textAlign: "right",
                    opacity: 0.7,
                    fontSize: "0.6rem",
                  }}
                >
                  {msg.createdAt ? new Date(msg.createdAt.iso || msg.createdAt).toLocaleTimeString() : ""}
                </Typography>
              </Paper>
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box
        sx={{
          p: 1.5,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          gap: 1,
          alignItems: "flex-end",
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder={selectedAgent === "all" ? "Broadcast to all agents..." : `Message ${agentLabels[selectedAgent] || selectedAgent}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          sx={{
            bgcolor: "primary.main",
            color: "white",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
            borderRadius: 2,
            width: 40,
            height: 40,
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
