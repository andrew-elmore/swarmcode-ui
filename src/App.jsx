import { useState, useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MailIcon from "@mui/icons-material/Mail";
import FolderIcon from "@mui/icons-material/Folder";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import TerminalIcon from "@mui/icons-material/Terminal";
import MenuIcon from "@mui/icons-material/Menu";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchBoard } from "./store/boardSlice";
import { appendMessage, setMobileDrawerOpen } from "./store/messagesSlice";
import { enqueueMessage } from "./store/ttsSlice";
import { updateCommand, setPing } from "./store/commandsSlice";
import { subscribeToMessages, subscribeToCommands, subscribeToPings } from "./services/api";
import AgentsView from "./components/AgentsView";
import BoardView from "./components/BoardView";
import CommandsView from "./components/CommandsView";
import MessagesView from "./components/MessagesView";
import ProjectsView from "./components/ProjectsView";
import ProjectSelector from "./components/ProjectSelector";
import StreamView from "./components/StreamView";
import { buildAgentLabels } from "./constants";

export default function App() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dispatch = useAppDispatch();
  const activeProject = useAppSelector((s) => s.projects.activeProject);
  const selectedAgent = useAppSelector((s) => s.messages.selectedAgent);
  const agents = useAppSelector((s) => s.agents.agents);
  const projectHash = useAppSelector((s) => s.board.board?.projectHash);
  const tts = useAppSelector((s) => s.tts);
  const ttsRef = useRef(tts);

  // Keep ref in sync so the LiveQuery callback always sees latest TTS state
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  // Build agent objectId -> name lookup map for LiveQuery Pointer resolution
  const agentIdMapRef = useRef({});
  useEffect(() => {
    const map = {};
    agents.forEach((a) => { if (a.objectId) map[a.objectId] = a.name; });
    agentIdMapRef.current = map;
  }, [agents]);

  const agentLabels = buildAgentLabels(agents);

  const isMessagesTab = tab === 0;

  // Load board on startup so projectHash is available for all tabs (including Messages)
  useEffect(() => {
    if (activeProject) {
      dispatch(fetchBoard(activeProject.path));
    }
  }, [dispatch, activeProject]);

  // LiveQuery subscription lives in App so it stays active across all tabs.
  useEffect(() => {
    let unsubscribe = null;

    subscribeToMessages((msg) => {
      // Resolve Pointer objectIds to agent names via agentIdMap.
      const idMap = agentIdMapRef.current;
      const resolvedFrom = (msg.fromId && idMap[msg.fromId]) || msg.from;
      const resolvedTo = (msg.toId && idMap[msg.toId]) || msg.to;

      if (msg.fromId && !idMap[msg.fromId] && msg.from === msg.fromId) {
        console.warn("Could not resolve agent name for fromId:", msg.fromId);
      }

      const resolvedMsg = { ...msg, from: resolvedFrom, to: resolvedTo };
      dispatch(appendMessage(resolvedMsg));

      // Enqueue incoming agent messages for browser speechSynthesis
      const currentTts = ttsRef.current;
      if (resolvedMsg.from !== "owner" && currentTts.enabled) {
        dispatch(enqueueMessage({ from: resolvedMsg.from, message: resolvedMsg.message }));
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dispatch]);

  // LiveQuery subscriptions for Command and Ping classes
  useEffect(() => {
    if (!projectHash) return;
    let unsubCmd = null;
    let unsubPing = null;

    subscribeToCommands(projectHash, (event) => {
      dispatch(updateCommand(event.command));
    }).then((unsub) => { unsubCmd = unsub; });

    subscribeToPings(projectHash, (ping) => {
      dispatch(setPing(ping));
    }).then((unsub) => { unsubPing = unsub; });

    return () => {
      if (unsubCmd) unsubCmd();
      if (unsubPing) unsubPing();
    };
  }, [dispatch, projectHash]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static">
        <Toolbar
          sx={{
            flexWrap: isMobile ? "wrap" : "nowrap",
            minHeight: isMobile ? "auto" : undefined,
            py: isMobile ? 0.5 : 0,
          }}
        >
          {/* Mobile hamburger for Messages drawer */}
          {isMobile && isMessagesTab && (
            <IconButton
              color="inherit"
              onClick={() => dispatch(setMobileDrawerOpen(true))}
              size="small"
              sx={{ mr: 0.5 }}
              data-testid="mobile-drawer-toggle"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component="div"
            sx={{ mr: isMobile ? 1 : 4, fontSize: isMobile ? "1rem" : undefined }}
          >
            SwarmCode
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ minHeight: isMobile ? 40 : undefined }}
          >
            {isMobile ? (
              [
                <Tab key="messages" data-testid="tab-messages" icon={<MailIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="board" data-testid="tab-board" icon={<DashboardIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="agents" data-testid="tab-agents" icon={<SmartToyIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="stream" data-testid="tab-stream" icon={<HeadphonesIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="projects" data-testid="tab-projects" icon={<FolderIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="commands" data-testid="tab-commands" icon={<TerminalIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
              ]
            ) : (
              [
                <Tab key="messages" data-testid="tab-messages" icon={<MailIcon />} iconPosition="start" label="Messages" />,
                <Tab key="board" data-testid="tab-board" icon={<DashboardIcon />} iconPosition="start" label="Board" />,
                <Tab key="agents" data-testid="tab-agents" icon={<SmartToyIcon />} iconPosition="start" label="Agents" />,
                <Tab key="stream" data-testid="tab-stream" icon={<HeadphonesIcon />} iconPosition="start" label="Stream" />,
                <Tab key="projects" data-testid="tab-projects" icon={<FolderIcon />} iconPosition="start" label="Projects" />,
                <Tab key="commands" data-testid="tab-commands" icon={<TerminalIcon />} iconPosition="start" label="Commands" />,
              ]
            )}
          </Tabs>
          {!isMobile && <Box sx={{ flex: 1 }} />}
          {/* Desktop: show selected agent name in AppBar when on Messages tab */}
          {!isMobile && isMessagesTab && selectedAgent && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
              {agentLabels[selectedAgent] || selectedAgent}
            </Typography>
          )}
          {!isMobile && <ProjectSelector />}
        </Toolbar>
        {isMobile && (
          <Toolbar
            variant="dense"
            sx={{
              minHeight: 40,
              px: 1.5,
              bgcolor: "primary.dark",
            }}
          >
            {/* Mobile: show selected agent name in secondary toolbar when on Messages tab */}
            {isMessagesTab && selectedAgent && (
              <Typography variant="body2" color="inherit" sx={{ mr: 1, fontWeight: 600 }} noWrap>
                {agentLabels[selectedAgent] || selectedAgent}
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <ProjectSelector />
          </Toolbar>
        )}
      </AppBar>

      <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {tab === 0 && <MessagesView />}
        {tab === 1 && <BoardView />}
        {tab === 2 && <AgentsView />}
        {tab === 3 && <StreamView />}
        {tab === 4 && <ProjectsView />}
        {tab === 5 && <CommandsView />}
      </Box>
    </Box>
  );
}
