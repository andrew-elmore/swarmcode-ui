import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAgent, appendMessage } from "../store/messagesSlice";
import { subscribeToMessages } from "../services/api";
import TtsEngine from "../utils/ttsEngine";
import AgentSidebar from "./AgentSidebar";
import ChatView from "./ChatView";

const SIDEBAR_WIDTH = 240;

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { selectedAgent, unreadCounts } = useAppSelector((s) => s.messages);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const ttsEngineRef = useRef(new TtsEngine());

  // Subscribe to LiveQuery for real-time incoming messages
  useEffect(() => {
    const engine = ttsEngineRef.current;
    let unsubscribe = null;

    subscribeToMessages((msg) => {
      dispatch(appendMessage(msg));
      // Queue incoming messages for TTS (skip owner's own messages)
      if (msg.from !== "owner" && engine.enabled) {
        const label = msg.from || "agent";
        engine.speak(`${label} says: ${msg.message}`);
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
      engine.stop();
    };
  }, [dispatch]);

  const handleSelectAgent = (agent) => {
    dispatch(selectAgent(agent));
    if (isMobile) setDrawerOpen(false);
  };

  const sidebarContent = (
    <AgentSidebar selectedAgent={selectedAgent} onSelectAgent={handleSelectAgent} unreadCounts={unreadCounts} />
  );

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Mobile: Drawer sidebar */}
      {isMobile ? (
        <>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sx={{
              "& .MuiDrawer-paper": {
                width: SIDEBAR_WIDTH,
                top: "auto",
              },
            }}
          >
            {sidebarContent}
          </Drawer>

          {/* Mobile hamburger button - shown in chat header area */}
          <Box sx={{ display: "flex", flexDirection: "column", width: "100%", minHeight: 0 }}>
            <Box sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <IconButton onClick={() => setDrawerOpen(true)} size="small">
                <MenuIcon />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <ChatView ttsEngineRef={ttsEngineRef} />
            </Box>
          </Box>
        </>
      ) : (
        <>
          {/* Desktop: Fixed sidebar */}
          <Box
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              overflow: "auto",
            }}
          >
            {sidebarContent}
          </Box>

          {/* Chat area */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ChatView ttsEngineRef={ttsEngineRef} />
          </Box>
        </>
      )}
    </Box>
  );
}
