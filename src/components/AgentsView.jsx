import { useState, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchAgents,
  fetchAllAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  assignAgent,
  unassignAgent,
  updateProjectAgent,
  clearError,
} from "../store/agentsSlice";
import { fetchBoard } from "../store/boardSlice";
import { fetchRecentProjects } from "../store/projectsSlice";
import AgentEditDialog from "./AgentEditDialog";

export default function AgentsView() {
  const dispatch = useAppDispatch();
  const { agents, allAgents, loading, error } = useAppSelector((s) => s.agents);
  const { activeProject, projects } = useAppSelector((s) => s.projects);
  const { board } = useAppSelector((s) => s.board);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [editOpen, setEditOpen] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState(activeProject?.path || "");

  const boardId = board?.objectId;

  // Ensure board is loaded so we have boardId
  useEffect(() => {
    if (activeProject && !board) {
      dispatch(fetchBoard(activeProject.path));
    }
  }, [dispatch, activeProject, board]);

  // Load projects for dropdown
  useEffect(() => {
    if (projects.length === 0) {
      dispatch(fetchRecentProjects());
    }
  }, [dispatch, projects.length]);

  // When dropdown selection changes, fetch the board for that project
  // so boardId updates and triggers agent fetch
  useEffect(() => {
    if (selectedProjectPath && selectedProjectPath !== activeProject?.path) {
      dispatch(fetchBoard(selectedProjectPath));
    }
  }, [dispatch, selectedProjectPath, activeProject]);

  // Load global agents
  useEffect(() => {
    dispatch(fetchAllAgents());
  }, [dispatch]);

  // Load project-scoped agents when project selected
  useEffect(() => {
    if (boardId) {
      dispatch(fetchAgents(boardId));
    }
  }, [dispatch, boardId]);

  // Compute assigned vs unassigned agents
  const assignedNames = useMemo(() => new Set(agents.map((a) => a.name)), [agents]);
  const unassignedAgents = useMemo(
    () => allAgents.filter((a) => !assignedNames.has(a.name)),
    [allAgents, assignedNames]
  );

  const handleCreate = () => {
    setEditAgent(null);
    setEditOpen(true);
  };

  const handleEdit = (agent) => {
    setEditAgent(agent);
    setEditOpen(true);
  };

  const handleSave = async (data) => {
    if (editAgent) {
      await dispatch(updateAgent(data)).unwrap();
    } else {
      await dispatch(createAgent(data)).unwrap();
    }
    // Refresh global list after create/update
    dispatch(fetchAllAgents());
    // Refresh project list too (in case an assigned agent was edited)
    if (boardId) dispatch(fetchAgents(boardId));
  };

  const handleToggleActive = (agent) => {
    if (!boardId) return;
    dispatch(updateProjectAgent({
      boardId,
      agentName: agent.name,
      isActive: !agent.isActive,
    }));
  };

  const handleAssign = (agentName) => {
    if (!boardId) return;
    dispatch(assignAgent({ boardId, agentName }));
  };

  const handleUnassign = (agentName) => {
    if (!boardId) return;
    dispatch(unassignAgent({ boardId, agentName }));
  };

  const handleDeleteClick = (agent) => {
    setDeleteTarget(agent);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await dispatch(deleteAgent({ name: deleteTarget.name }));
    setDeleting(false);
    if (!result.error) {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  if (loading && allAgents.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 900, mx: "auto", height: "100%", overflow: "auto" }}>
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }} data-testid="error-alert">
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Agents</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleCreate} data-testid="add-agent-button">
          Add Agent
        </Button>
      </Box>

      {/* Project dropdown */}
      {projects.length > 0 && (
        <TextField
          select
          label="Project"
          value={selectedProjectPath}
          onChange={(e) => setSelectedProjectPath(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        >
          {projects.map((p) => (
            <MenuItem key={p.path} value={p.path}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      )}

      {/* Assigned agents section */}
      {boardId && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Assigned to this project ({agents.length})
          </Typography>
          {agents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No agents assigned. Click + on an agent below to assign it.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    {!isMobile && <TableCell>Tools</TableCell>}
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow
                      key={agent.name}
                      sx={{ opacity: agent.isActive ? 1 : 0.5 }}
                      data-testid={`agent-list-item-${agent.name}`}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {agent.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: isMobile ? 120 : 250 }}>
                          {agent.description}
                        </Typography>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                            {(agent.permissions?.allowedTools || []).map((tool) => (
                              <Chip key={tool} label={tool} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                      )}
                      <TableCell align="center">
                        <Switch
                          checked={agent.isActive}
                          onChange={() => handleToggleActive(agent)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <IconButton size="small" title="Unassign from project" onClick={() => handleUnassign(agent.name)}>
                          <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Edit" onClick={() => handleEdit(agent)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Delete" onClick={() => handleDeleteClick(agent)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Unassigned agents section */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Available ({unassignedAgents.length})
          </Typography>
          {unassignedAgents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              All agents are assigned to this project.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unassignedAgents.map((agent) => (
                    <TableRow key={agent.name} sx={{ opacity: 0.7 }} data-testid={`agent-list-item-${agent.name}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {agent.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: isMobile ? 120 : 250 }}>
                          {agent.description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <IconButton size="small" title="Assign to project" color="primary" onClick={() => handleAssign(agent.name)}>
                          <AddCircleOutlineIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Edit" onClick={() => handleEdit(agent)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Delete" onClick={() => handleDeleteClick(agent)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* No project selected — show all global agents */}
      {!boardId && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            All Agents ({allAgents.length})
          </Typography>
          {allAgents.length === 0 ? (
            <Typography color="text.secondary">
              No agents configured. Default agents will be created when a project is opened.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    {!isMobile && <TableCell>Tools</TableCell>}
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allAgents.map((agent) => (
                    <TableRow key={agent.name} data-testid={`agent-list-item-${agent.name}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {agent.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: isMobile ? 120 : 250 }}>
                          {agent.description}
                        </Typography>
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                            {(agent.permissions?.allowedTools || []).map((tool) => (
                              <Chip key={tool} label={tool} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <IconButton size="small" title="Edit" onClick={() => handleEdit(agent)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Delete" onClick={() => handleDeleteClick(agent)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <AgentEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        agent={editAgent}
        onSave={handleSave}
      />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Agent</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This will remove it from all projects. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
