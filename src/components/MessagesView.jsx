import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAgent, appendMessage, setMobileDrawerOpen } from "../store/messagesSlice";
import { enqueueMessage } from "../store/ttsSlice";
import { subscribeToMessages } from "../services/api";
/* CARD-090: Commented out — server-side TTS replaced by browser speechSynthesis
import { setError as setTtsError } from "../store/ttsSlice";
import { synthesizeSpeech } from "../services/api";
import { getStreamManager } from "./StreamView";
*/
import AgentSidebar from "./AgentSidebar";
import ChatView from "./ChatView";

const SIDEBAR_WIDTH = 240;

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { selectedAgent, unreadCounts, mobileDrawerOpen } = useAppSelector((s) => s.messages);
  const tts = useAppSelector((s) => s.tts);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const ttsRef = useRef(tts);

  // Keep ref in sync so the LiveQuery callback always sees latest state
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  // Subscribe to LiveQuery for real-time incoming messages
  useEffect(() => {
    let unsubscribe = null;

    subscribeToMessages((msg) => {
      dispatch(appendMessage(msg));

      // CARD-090: Enqueue incoming agent messages for browser speechSynthesis
      const currentTts = ttsRef.current;
      if (msg.from !== "owner" && currentTts.enabled) {
        dispatch(enqueueMessage({ from: msg.from, message: msg.message }));
      }

      /* CARD-090: Commented out — server-side TTS via AudioStreamManager
      const currentTts = ttsRef.current;
      if (msg.from !== "owner" && currentTts.enabled) {
        const mgr = getStreamManager();
        if (!mgr.active) return;
        const agent = agentsRef.current.find((a) => a.name === msg.from);
        const voice = agent?.voice || DEFAULT_VOICE;
        synthesizeSpeech({ text: msg.message, voice, speed: currentTts.rate })
          .then((audioData) => mgr.queueSpeech(audioData))
          .catch(() => dispatch(setTtsError("TTS synthesis failed")));
      }
      */
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
