import { useEffect } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Badge from "@mui/material/Badge";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import { fetchAgents } from "../store/agentsSlice";

export default function AgentSidebar({ selectedAgent, onSelectAgent, unreadCounts }) {
  const dispatch = useAppDispatch();
  const agents = useAppSelector((s) => s.agents.agents);
  const projectHash = useAppSelector((s) => s.board.board?.projectHash);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Load agents from DB when projectHash is available
  useEffect(() => {
    if (projectHash && agents.length === 0) {
      dispatch(fetchAgents(projectHash));
    }
  }, [dispatch, projectHash, agents.length]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <List disablePadding sx={{ flex: 1, overflow: "auto" }}>
        {/* Broadcast / All Agents */}
        <ListItemButton
          selected={selectedAgent === "all"}
          onClick={() => onSelectAgent("all")}
          sx={{ py: isMobile ? 0.75 : 1.25, px: 2 }}
          data-testid="agent-sidebar-item-all"
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Badge badgeContent={unreadCounts?.all || 0} color="error" max={99}>
              <GroupsIcon color={selectedAgent === "all" ? "primary" : "action"} fontSize={isMobile ? "small" : "medium"} />
            </Badge>
          </ListItemIcon>
          <ListItemText
            primary="All Agents"
            primaryTypographyProps={{ variant: "body2", fontWeight: selectedAgent === "all" ? 600 : 400 }}
          />
        </ListItemButton>

        <Divider sx={{ my: 0.5 }} />

        {/* Individual agents — loaded dynamically from DB */}
        {agents.filter((a) => a.isActive).map((agent) => (
          <ListItemButton
            key={agent.name}
            selected={selectedAgent === agent.name}
            onClick={() => onSelectAgent(agent.name)}
            sx={{ py: isMobile ? 0.75 : 1.25, px: 2 }}
            data-testid={`agent-sidebar-item-${agent.name}`}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Badge badgeContent={unreadCounts?.[agent.name] || 0} color="error" max={99}>
                <PersonIcon color={selectedAgent === agent.name ? "primary" : "action"} fontSize={isMobile ? "small" : "medium"} />
              </Badge>
            </ListItemIcon>
            <ListItemText
              primary={isMobile ? agent.name : (agent.description || agent.name)}
              secondary={isMobile ? undefined : agent.name}
              primaryTypographyProps={{ variant: "body2", fontWeight: selectedAgent === agent.name ? 600 : 400, noWrap: isMobile }}
              secondaryTypographyProps={{ variant: "caption", sx: { fontSize: "0.65rem" } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
