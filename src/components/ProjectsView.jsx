import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchRecentProjects,
  addRecentProject,
  setActiveProject,
  deleteProject,
} from "../store/projectsSlice";

export default function ProjectsView() {
  const dispatch = useAppDispatch();
  const { projects, activeProject } = useAppSelector((s) => s.projects);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newPath, setNewPath] = useState("");

  const handleDeleteClick = (project) => {
    setDeleteTarget(project);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await dispatch(deleteProject({ path: deleteTarget.path }));
    setDeleteOpen(false);
    setDeleteTarget(null);
  };

  const handleAddProject = async () => {
    if (!newPath.trim()) return;
    const path = newPath.trim();
    const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
    await dispatch(addRecentProject({ path, name }));
    dispatch(setActiveProject({ path, name }));
    setNewPath("");
    setAddOpen(false);
    dispatch(fetchRecentProjects());
  };

  const handleSelectProject = (project) => {
    dispatch(setActiveProject(project));
    dispatch(addRecentProject({ path: project.path, name: project.name }));
  };

  return (
    <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Projects</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setAddOpen(true)}>
          Add Project
        </Button>
      </Box>

      {projects.length === 0 ? (
        <Typography color="text.secondary">No projects yet. Add one to get started.</Typography>
      ) : (
        <List disablePadding>
          {projects.map((p) => (
            <ListItem
              key={p.path}
              disablePadding
              secondaryAction={
                <IconButton edge="end" title="Delete project" onClick={() => handleDeleteClick(p)}>
                  <DeleteIcon />
                </IconButton>
              }
              sx={{
                bgcolor: activeProject?.path === p.path ? "action.selected" : undefined,
                borderRadius: 1,
                mb: 0.5,
              }}
            >
              <ListItemButton onClick={() => handleSelectProject(p)}>
                <ListItemText
                  primary={p.name}
                  secondary={p.path}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will
            also delete all board cards associated with this project. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Project</DialogTitle>
        <DialogContent>
          <TextField
            label="Project Path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            fullWidth
            autoFocus
            margin="dense"
            placeholder="C:\Users\...\MyProject"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddProject();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={handleAddProject} variant="contained" disabled={!newPath.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
