import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MailIcon from "@mui/icons-material/Mail";
import BoardView from "./components/BoardView";
import MessagesView from "./components/MessagesView";
import ProjectSelector from "./components/ProjectSelector";

export default function App() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar
          sx={{
            flexWrap: isMobile ? "wrap" : "nowrap",
            minHeight: isMobile ? "auto" : undefined,
            py: isMobile ? 0.5 : 0,
          }}
        >
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
              ]
            ) : (
              [
                <Tab key="messages" icon={<MailIcon />} iconPosition="start" label="Messages" />,
                <Tab key="board" icon={<DashboardIcon />} iconPosition="start" label="Board" />,
              ]
            )}
          </Tabs>
          {!isMobile && <Box sx={{ flex: 1 }} />}
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
            <ProjectSelector />
          </Toolbar>
        )}
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        {tab === 0 && <MessagesView />}
        {tab === 1 && <BoardView />}
      </Box>
    </Box>
  );
}
