import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAgent, appendMessage, setMobileDrawerOpen } from "../store/messagesSlice";
import { setError as setTtsError } from "../store/ttsSlice";
import { subscribeToMessages, synthesizeSpeech } from "../services/api";
import { getStreamManager } from "./StreamView";
import AgentSidebar from "./AgentSidebar";
import ChatView from "./ChatView";

const SIDEBAR_WIDTH = 240;
const DEFAULT_VOICE = "en_US-amy-medium";

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { selectedAgent, unreadCounts, mobileDrawerOpen } = useAppSelector((s) => s.messages);
  const tts = useAppSelector((s) => s.tts);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const ttsRef = useRef(tts);
  const agentsRef = useRef(agents);

  // Keep refs in sync so the LiveQuery callback always sees latest state
  useEffect(() => { ttsRef.current = tts; }, [tts]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Subscribe to LiveQuery for real-time incoming messages
  useEffect(() => {
    let unsubscribe = null;

    subscribeToMessages((msg) => {
      dispatch(appendMessage(msg));

      // Queue incoming agent messages for server-side TTS via AudioStreamManager
      const currentTts = ttsRef.current;
      if (msg.from !== "owner" && currentTts.enabled) {
        const mgr = getStreamManager();
        if (!mgr.active) return;

        // Look up agent voice from DB (agents store)
        const agent = agentsRef.current.find((a) => a.name === msg.from);
        const voice = agent?.voice || DEFAULT_VOICE;

        synthesizeSpeech({ text: msg.message, voice, speed: currentTts.rate })
          .then((audioData) => mgr.queueSpeech(audioData))
          .catch(() => dispatch(setTtsError("TTS synthesis failed")));
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dispatch]);

  const handleSelectAgent = (agent) => {
    dispatch(selectAgent(agent));
    if (isMobile) dispatch(setMobileDrawerOpen(false));
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
            open={mobileDrawerOpen}
            onClose={() => dispatch(setMobileDrawerOpen(false))}
            sx={{
              "& .MuiDrawer-paper": {
                width: SIDEBAR_WIDTH,
                top: "auto",
              },
            }}
          >
            {sidebarContent}
          </Drawer>

          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ChatView />
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
              overflow: "hidden",
            }}
          >
            {sidebarContent}
          </Box>

          {/* Chat area */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ChatView />
          </Box>
        </>
      )}
    </Box>
  );
}
