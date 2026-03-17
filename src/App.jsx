import { useState, useEffect, useRef } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
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
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import TerminalIcon from "@mui/icons-material/Terminal";
import DescriptionIcon from "@mui/icons-material/Description";
import MenuIcon from "@mui/icons-material/Menu";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import { useAppDispatch, useAppSelector } from "./store";
import { appendMessage, setMobileDrawerOpen } from "./store/messagesSlice";
import { enqueueMessage } from "./store/ttsSlice";
import { updateCommand, setPing } from "./store/commandsSlice";
import { logoutUser, restoreSession } from "./store/authSlice";
import { upsertCard, removeCard } from "./store/projectSlice";
import { subscribeToMessages, subscribeToCommands, subscribeToPings, subscribeToCards } from "./services/api";
import AgentsView from "./components/AgentsView";
import ArticlesView from "./components/ArticlesView";
import BoardView from "./components/BoardView";
import CommandsView from "./components/CommandsView";
import LoginDialog from "./components/LoginDialog";
import MessagesView from "./components/MessagesView";
import DevicesView from "./components/DevicesView";
import RegisterView from "./components/RegisterView";
import ProjectsView from "./components/ProjectsView";
import ProjectSelector from "./components/ProjectSelector";
import ProjectLayout from "./components/ProjectLayout";
import StreamView from "./components/StreamView";
import { buildAgentLabels } from "./constants";

// Tab index -> URL path segment mapping
// Tab 0: Stream (/:projectId index), Tab 1: Messages, Tab 2: Board,
// Tab 3: Agents, Tab 4: Commands, Tab 5: Articles
const TAB_PATHS = ['', 'messages', 'board', 'agents', 'commands', 'articles', 'devices'];

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dispatch = useAppDispatch();
  const selectedAgent = useAppSelector((s) => s.messages.selectedAgent);
  const agents = useAppSelector((s) => s.agents.agents);
  const statuses = useAppSelector((s) => s.project.statuses ?? []);
  const sprints = useAppSelector((s) => s.project.sprints ?? []);
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

  // Build status and sprint objectId -> name lookup maps for Card LiveQuery resolution
  const statusIdMapRef = useRef({});
  useEffect(() => {
    const map = {};
    statuses.forEach((s) => { if (s.objectId) map[s.objectId] = s.name; });
    statusIdMapRef.current = map;
  }, [statuses]);

  const sprintIdMapRef = useRef({});
  useEffect(() => {
    const map = {};
    sprints.forEach((s) => { if (s.objectId) map[s.objectId] = s.name; });
    sprintIdMapRef.current = map;
  }, [sprints]);

  const agentLabels = buildAgentLabels(agents);

  // Derive active tab from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const projectIdInUrl = pathParts[0];
  const pathSeg = pathParts[1] ?? '';
  const tabValue = projectIdInUrl ? TAB_PATHS.indexOf(pathSeg) : -1;

  const isMessagesTab = tabValue === 1;

  const handleTabChange = (_, v) => {
    if (!projectIdInUrl) return;
    const seg = TAB_PATHS[v];
    navigate(seg ? `/${projectIdInUrl}/${seg}` : `/${projectIdInUrl}`);
  };

  // Restore Parse session from localStorage on mount so AppBar reflects login state
  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);

  // LiveQuery subscription lives in App so it stays active across all tabs.
  // Re-subscribes when projectIdInUrl or liveQueryRefreshFlag changes.
  useEffect(() => {
    if (!projectIdInUrl) return;

    const unsubscribe = subscribeToMessages(projectIdInUrl, (msg) => {
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
        dispatch(enqueueMessage({ from: resolvedMsg.from, message: resolvedMsg.message, createdAt: resolvedMsg.createdAt || null }));
      }
    });

    return () => unsubscribe();
  }, [dispatch, projectIdInUrl, liveQueryRefreshFlag]);

  // LiveQuery subscriptions for Command and Ping classes
  useEffect(() => {
    if (!projectIdInUrl) return;
    const unsubCmd = subscribeToCommands(projectIdInUrl, (event) => {
      dispatch(updateCommand(event.command));
    });

    const unsubPing = subscribeToPings(projectIdInUrl, (ping) => {
      dispatch(setPing(ping));
    });

    return () => {
      unsubCmd();
      unsubPing();
    };
  }, [dispatch, projectIdInUrl, liveQueryRefreshFlag]);

  // LiveQuery subscription for Card class
  useEffect(() => {
    if (!projectIdInUrl) return;
    const unsubscribe = subscribeToCards(projectIdInUrl, (event) => {
      if (event.type === "delete") {
        dispatch(removeCard(event.objectId));
        return;
      }
      const { card } = event;
      const resolved = {
        ...card,
        status: (card.statusId && statusIdMapRef.current[card.statusId]) || card.statusId || null,
        assignee: (card.assigneeId && agentIdMapRef.current[card.assigneeId]) || card.assigneeId || null,
        sprintName: (card.sprintId && sprintIdMapRef.current[card.sprintId]) || card.sprintId || null,
        sprint: (card.sprintId && sprintIdMapRef.current[card.sprintId]) || card.sprintId || null,
      };
      dispatch(upsertCard(resolved));
    });
    return () => unsubscribe();
  }, [dispatch, projectIdInUrl]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
          {projectIdInUrl && (
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{ minHeight: isMobile ? 40 : undefined }}
            >
              {isMobile ? (
                [
                  <Tab key="stream" data-testid="tab-stream" icon={<HeadphonesIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="messages" data-testid="tab-messages" icon={<MailIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="board" data-testid="tab-board" icon={<DashboardIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="agents" data-testid="tab-agents" icon={<SmartToyIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="commands" data-testid="tab-commands" icon={<TerminalIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="articles" data-testid="tab-articles" icon={<DescriptionIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                  <Tab key="devices" data-testid="tab-devices" icon={<PhoneAndroidIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                ]
              ) : (
                [
                  <Tab key="stream" data-testid="tab-stream" icon={<HeadphonesIcon />} iconPosition="start" label="Stream" />,
                  <Tab key="messages" data-testid="tab-messages" icon={<MailIcon />} iconPosition="start" label="Messages" />,
                  <Tab key="board" data-testid="tab-board" icon={<DashboardIcon />} iconPosition="start" label="Board" />,
                  <Tab key="agents" data-testid="tab-agents" icon={<SmartToyIcon />} iconPosition="start" label="Agents" />,
                  <Tab key="commands" data-testid="tab-commands" icon={<TerminalIcon />} iconPosition="start" label="Commands" />,
                  <Tab key="articles" data-testid="tab-articles" icon={<DescriptionIcon />} iconPosition="start" label="Articles" />,
                  <Tab key="devices" data-testid="tab-devices" icon={<PhoneAndroidIcon />} iconPosition="start" label="Devices" />,
                ]
              )}
            </Tabs>
          )}
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
        <Routes>
          <Route path="/" element={<ProjectsView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route path="/:projectId" element={<ProjectLayout />}>
            <Route index element={<StreamView />} />
            <Route path="messages" element={<MessagesView />} />
            <Route path="board" element={<BoardView />} />
            <Route path="agents" element={<AgentsView />} />
            <Route path="commands" element={<CommandsView />} />
            <Route path="articles" element={<ArticlesView />} />
            <Route path="devices" element={<DevicesView />} />
          </Route>
        </Routes>
      </Box>
    </Box>
  );
}
