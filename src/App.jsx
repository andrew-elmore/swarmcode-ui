import { useState, useEffect } from "react";
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
import MenuIcon from "@mui/icons-material/Menu";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchBoard } from "./store/boardSlice";
import { setMobileDrawerOpen } from "./store/messagesSlice";
import AgentsView from "./components/AgentsView";
import BoardView from "./components/BoardView";
import MessagesView from "./components/MessagesView";
import ProjectsView from "./components/ProjectsView";
import ProjectSelector from "./components/ProjectSelector";
import StreamView from "./components/StreamView";

export default function App() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dispatch = useAppDispatch();
  const activeProject = useAppSelector((s) => s.projects.activeProject);
  const selectedAgent = useAppSelector((s) => s.messages.selectedAgent);
  const agents = useAppSelector((s) => s.agents.agents);

  // Build label lookup from dynamic agents list
  const agentLabels = { all: "All Agents" };
  agents.forEach((a) => { agentLabels[a.name] = a.description || a.name; });

  const isMessagesTab = tab === 0;

  // Load board on startup so projectHash is available for all tabs (including Messages)
  useEffect(() => {
    if (activeProject) {
      dispatch(fetchBoard(activeProject.path));
    }
  }, [dispatch, activeProject]);

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
                <Tab key="messages" icon={<MailIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="board" icon={<DashboardIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="agents" icon={<SmartToyIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="stream" icon={<HeadphonesIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
                <Tab key="projects" icon={<FolderIcon />} sx={{ minWidth: 48, minHeight: 40, px: 1 }} />,
              ]
            ) : (
              [
                <Tab key="messages" icon={<MailIcon />} iconPosition="start" label="Messages" />,
                <Tab key="board" icon={<DashboardIcon />} iconPosition="start" label="Board" />,
                <Tab key="agents" icon={<SmartToyIcon />} iconPosition="start" label="Agents" />,
                <Tab key="stream" icon={<HeadphonesIcon />} iconPosition="start" label="Stream" />,
                <Tab key="projects" icon={<FolderIcon />} iconPosition="start" label="Projects" />,
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
      </Box>
    </Box>
  );
}
