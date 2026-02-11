import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { selectAgent, setMobileDrawerOpen } from "../store/messagesSlice";
/* CARD-090: Commented out — server-side TTS replaced by browser speechSynthesis
import { setError as setTtsError } from "../store/ttsSlice";
import { synthesizeSpeech } from "../services/api";
import { getStreamManager } from "./StreamView";
*/
// CARD-092: LiveQuery subscription moved to App.jsx so it stays active across all tabs.
import AgentSidebar from "./AgentSidebar";
import ChatView from "./ChatView";

const SIDEBAR_WIDTH = 240;

export default function MessagesView() {
  const dispatch = useAppDispatch();
  const { selectedAgent, unreadCounts, mobileDrawerOpen } = useAppSelector((s) => s.messages);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
