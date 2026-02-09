import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Badge from "@mui/material/Badge";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";

const AGENTS = [
  { id: "pm-1", label: "PM Agent" },
  { id: "senior-dev-1", label: "Senior Dev" },
  { id: "developer-1", label: "Developer" },
  { id: "qa-1", label: "QA Agent" },
  { id: "devops-1", label: "DevOps Agent" },
];

export default function AgentSidebar({ selectedAgent, onSelectAgent, unreadCounts }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
          Conversations
        </Typography>
      </Box>
      <List disablePadding sx={{ flex: 1, overflow: "auto" }}>
        {/* Broadcast / All Agents */}
        <ListItemButton
          selected={selectedAgent === "all"}
          onClick={() => onSelectAgent("all")}
          sx={{ py: 1.25, px: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Badge badgeContent={unreadCounts?.all || 0} color="error" max={99}>
              <GroupsIcon color={selectedAgent === "all" ? "primary" : "action"} />
            </Badge>
          </ListItemIcon>
          <ListItemText
            primary="All Agents"
            primaryTypographyProps={{ variant: "body2", fontWeight: selectedAgent === "all" ? 600 : 400 }}
          />
        </ListItemButton>

        <Divider sx={{ my: 0.5 }} />

        {/* Individual agents */}
        {AGENTS.map((agent) => (
          <ListItemButton
            key={agent.id}
            selected={selectedAgent === agent.id}
            onClick={() => onSelectAgent(agent.id)}
            sx={{ py: 1.25, px: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Badge badgeContent={unreadCounts?.[agent.id] || 0} color="error" max={99}>
                <PersonIcon color={selectedAgent === agent.id ? "primary" : "action"} />
              </Badge>
            </ListItemIcon>
            <ListItemText
              primary={agent.label}
              secondary={agent.id}
              primaryTypographyProps={{ variant: "body2", fontWeight: selectedAgent === agent.id ? 600 : 400 }}
              secondaryTypographyProps={{ variant: "caption", sx: { fontSize: "0.65rem" } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
