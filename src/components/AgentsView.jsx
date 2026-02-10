import { useState, useEffect } from "react";
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
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  clearError,
} from "../store/agentsSlice";
import { fetchBoard } from "../store/boardSlice";
import AgentEditDialog from "./AgentEditDialog";

export default function AgentsView() {
  const dispatch = useAppDispatch();
  const { agents, loading, error } = useAppSelector((s) => s.agents);
  const { activeProject } = useAppSelector((s) => s.projects);
  const { board } = useAppSelector((s) => s.board);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [editOpen, setEditOpen] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const projectHash = board?.projectHash;

  // Ensure board is loaded so we have projectHash (handles visiting Agents tab first)
  useEffect(() => {
    if (activeProject && !board) {
      dispatch(fetchBoard(activeProject.path));
    }
  }, [dispatch, activeProject, board]);

  useEffect(() => {
    if (projectHash) {
      dispatch(fetchAgents(projectHash));
    }
  }, [dispatch, projectHash]);

  const handleCreate = () => {
    setEditAgent(null);
    setEditOpen(true);
  };

  const handleEdit = (agent) => {
    setEditAgent(agent);
    setEditOpen(true);
  };

  const handleSave = async (data) => {
    if (!projectHash) return;
    if (editAgent) {
      await dispatch(updateAgent({ projectHash, ...data })).unwrap();
    } else {
      await dispatch(createAgent({ projectHash, ...data })).unwrap();
    }
  };

  const handleToggleActive = (agent) => {
    if (!projectHash) return;
    dispatch(updateAgent({
      projectHash,
      name: agent.name,
      isActive: !agent.isActive,
    }));
  };

  const handleDeleteClick = (agent) => {
    setDeleteTarget(agent);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !projectHash || deleting) return;
    setDeleting(true);
    const result = await dispatch(deleteAgent({ projectHash, name: deleteTarget.name }));
    setDeleting(false);
    if (!result.error) {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  if (!activeProject) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Select a project to manage agents.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 2, maxWidth: 900, mx: "auto" }}>
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Agents</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleCreate}>
          Add Agent
        </Button>
      </Box>

      {agents.length === 0 ? (
        <Typography color="text.secondary">
          No agents configured. Default agents will be created automatically.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
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
            This action cannot be undone.
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
