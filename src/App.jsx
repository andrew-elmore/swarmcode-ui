import { useState, useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import DescriptionIcon from "@mui/icons-material/Description";
import MenuIcon from "@mui/icons-material/Menu";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchProject } from "./store/projectSlice";
import { appendMessage, setMobileDrawerOpen, resetConversations } from "./store/messagesSlice";
import { enqueueMessage } from "./store/ttsSlice";
import { updateCommand, setPing } from "./store/commandsSlice";
import { logoutUser, restoreSession } from "./store/authSlice";
import { subscribeToMessages, subscribeToCommands, subscribeToPings } from "./services/api";
import AgentsView from "./components/AgentsView";
import ArticlesView from "./components/ArticlesView";
import BoardView from "./components/BoardView";
import CommandsView from "./components/CommandsView";
import LoginDialog from "./components/LoginDialog";
import MessagesView from "./components/MessagesView";
import ProjectsView from "./components/ProjectsView";
import ProjectSelector from "./components/ProjectSelector";
import StreamView from "./components/StreamView";
import { buildAgentLabels } from "./constants";

export default function App() {
  const [tab, setTab] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dispatch = useAppDispatch();
  const activeProject = useAppSelector((s) => s.projects.activeProject);
  const selectedAgent = useAppSelector((s) => s.messages.selectedAgent);
  const agents = useAppSelector((s) => s.agents.agents);
  const projectId = useAppSelector((s) => s.project.project?.objectId);
  const liveQueryRefreshFlag = useAppSelector((s) => s.messages.liveQueryRefreshFlag);
  const tts = useAppSelector((s) => s.tts);
  const ttsRef = useRef(tts);
  const authUser = useAppSelector((s) => s.auth.user);

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

  // Restore Parse session from localStorage on mount so AppBar reflects login state
  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);

  // Load project on startup so projectId is available for all tabs (including Messages)
  useEffect(() => {
    if (activeProject) {
      dispatch(resetConversations());
      dispatch(fetchProject(activeProject.path));
    }
  }, [dispatch, activeProject]);

  // LiveQuery subscription lives in App so it stays active across all tabs.
  // Re-subscribes when projectId or liveQueryRefreshFlag changes.
  useEffect(() => {
    if (!projectId) return;

    let unsubscribe = null;

    subscribeToMessages(projectId, (msg) => {
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
  }, [dispatch, projectId, liveQueryRefreshFlag]);

  // LiveQuery subscriptions for Command and Ping classes
  useEffect(() => {
    if (!projectId) return;
    let unsubCmd = null;
    let unsubPing = null;

    subscribeToCommands(projectId, (event) => {
      dispatch(updateCommand(event.command));
    }).then((unsub) => { unsubCmd = unsub; });

    subscribeToPings(projectId, (ping) => {
      dispatch(setPing(ping));
    }).then((unsub) => { unsubPing = unsub; });

    return () => {
      if (unsubCmd) unsubCmd();
      if (unsubPing) unsubPing();
    };
  }, [dispatch, projectId, liveQueryRefreshFlag]);

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
                <Tab key="articles" data-testid="tab-articles" icon={<DescriptionIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
              ]
            ) : (
              [
                <Tab key="messages" data-testid="tab-messages" icon={<MailIcon />} iconPosition="start" label="Messages" />,
                <Tab key="board" data-testid="tab-board" icon={<DashboardIcon />} iconPosition="start" label="Board" />,
                <Tab key="agents" data-testid="tab-agents" icon={<SmartToyIcon />} iconPosition="start" label="Agents" />,
                <Tab key="stream" data-testid="tab-stream" icon={<HeadphonesIcon />} iconPosition="start" label="Stream" />,
                <Tab key="projects" data-testid="tab-projects" icon={<FolderIcon />} iconPosition="start" label="Projects" />,
                <Tab key="commands" data-testid="tab-commands" icon={<TerminalIcon />} iconPosition="start" label="Commands" />,
                <Tab key="articles" data-testid="tab-articles" icon={<DescriptionIcon />} iconPosition="start" label="Articles" />,
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
          {!isMobile && (
            authUser ? (
              <Button
                color="inherit"
                size="small"
                sx={{ ml: 1, whiteSpace: "nowrap" }}
                onClick={() => dispatch(logoutUser())}
              >
                Sign Out
              </Button>
            ) : (
              <Button
                color="inherit"
                size="small"
                sx={{ ml: 1, whiteSpace: "nowrap" }}
                onClick={() => setLoginOpen(true)}
              >
                Sign In
              </Button>
            )
          )}
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
            {authUser ? (
              <Button
                color="inherit"
                size="small"
                sx={{ ml: 1 }}
                onClick={() => dispatch(logoutUser())}
              >
                Sign Out
              </Button>
            ) : (
              <Button
                color="inherit"
                size="small"
                sx={{ ml: 1 }}
                onClick={() => setLoginOpen(true)}
              >
                Sign In
              </Button>
            )}
          </Toolbar>
        )}
      </AppBar>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />

      <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Box sx={{ display: tab === 0 ? 'flex' : 'none', height: '100%' }}><MessagesView /></Box>
        <Box sx={{ display: tab === 1 ? 'block' : 'none', height: '100%' }}><BoardView /></Box>
        <Box sx={{ display: tab === 2 ? 'block' : 'none', height: '100%' }}><AgentsView /></Box>
        <Box sx={{ display: tab === 3 ? 'block' : 'none', height: '100%' }}><StreamView /></Box>
        <Box sx={{ display: tab === 4 ? 'block' : 'none', height: '100%' }}><ProjectsView /></Box>
        <Box sx={{ display: tab === 5 ? 'block' : 'none', height: '100%' }}><CommandsView /></Box>
        <Box sx={{ display: tab === 6 ? 'block' : 'none', height: '100%' }}><ArticlesView /></Box>
      </Box>
    </Box>
  );
}
