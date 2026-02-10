import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAgent, appendMessage, setMobileDrawerOpen } from "../store/messagesSlice";
import { setError as setTtsError } from "../store/ttsSlice";
import { subscribeToMessages } from "../services/api";
import TtsEngine from "../utils/ttsEngine";
import AgentSidebar from "./AgentSidebar";
import ChatView from "./ChatView";

const SIDEBAR_WIDTH = 240;

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { selectedAgent, unreadCounts, mobileDrawerOpen } = useAppSelector((s) => s.messages);
  const tts = useAppSelector((s) => s.tts);
  const agents = useAppSelector((s) => s.agents.agents);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const ttsEngineRef = useRef(new TtsEngine());
  const ttsRef = useRef(tts);
  const agentsRef = useRef(agents);

  // Keep refs in sync so the LiveQuery callback always sees latest state
  useEffect(() => { ttsRef.current = tts; }, [tts]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Sync Redux TTS state to the engine
  useEffect(() => {
    const engine = ttsEngineRef.current;
    engine.setEnabled(tts.enabled);
    engine.setRate(tts.rate);
    engine.setVolume(tts.volume);
    engine.setOnError((msg) => dispatch(setTtsError(msg)));
  }, [tts.enabled, tts.rate, tts.volume, dispatch]);

  // Subscribe to LiveQuery for real-time incoming messages
  useEffect(() => {
    const engine = ttsEngineRef.current;
    let unsubscribe = null;

    subscribeToMessages((msg) => {
      dispatch(appendMessage(msg));
      // Queue incoming messages for TTS (skip owner's own messages)
      if (msg.from !== "owner" && engine.enabled) {
        const currentTts = ttsRef.current;

        // Set per-agent voice if configured
        const voiceName = currentTts.perAgentVoice[msg.from];
        if (voiceName) {
          const voice = engine.getVoices().find((v) => v.name === voiceName);
          if (voice) engine.setVoice(voice);
        }

        // Optionally prepend agent name
        let text = msg.message;
        if (currentTts.speakAgentName) {
          const agent = agentsRef.current.find((a) => a.name === msg.from);
          const label = agent?.description || msg.from;
          text = `${label} says: ${text}`;
        }

        engine.speak(text);
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
