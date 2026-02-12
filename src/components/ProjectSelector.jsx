import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import { useAppDispatch, useAppSelector } from "../store";
import { fetchRecentProjects, addRecentProject, setActiveProject } from "../store/projectsSlice";
import { projectNameFromPath } from "../constants";

export default function ProjectSelector() {
  const dispatch = useAppDispatch();
  const { projects, activeProject } = useAppSelector((s) => s.projects);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [addOpen, setAddOpen] = useState(false);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    dispatch(fetchRecentProjects());
  }, [dispatch]);

  // Auto-select first project if none active
  useEffect(() => {
    if (!activeProject && projects.length > 0) {
      dispatch(setActiveProject(projects[0]));
    }
  }, [dispatch, activeProject, projects]);

  const handleSelect = (e) => {
    const path = e.target.value;
    const project = projects.find((p) => p.path === path);
    if (project) {
      dispatch(setActiveProject(project));
      dispatch(addRecentProject({ path: project.path, name: project.name }));
    }
  };

  const handleAddProject = async () => {
    if (!newPath.trim()) return;
    const path = newPath.trim();
    const name = projectNameFromPath(path);
    await dispatch(addRecentProject({ path, name }));
    dispatch(setActiveProject({ path, name }));
    setNewPath("");
    setAddOpen(false);
    dispatch(fetchRecentProjects());
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: isMobile ? 1 : undefined }}>
      <TextField
        select
        size="small"
        value={activeProject?.path || ""}
        onChange={handleSelect}
        sx={{
          minWidth: isMobile ? 0 : 200,
          flex: isMobile ? 1 : undefined,
          "& .MuiInputBase-root": { color: "inherit", bgcolor: "rgba(255,255,255,0.15)" },
          "& .MuiSvgIcon-root": { color: "inherit" },
        }}
        SelectProps={{ displayEmpty: true }}
      >
        {projects.length === 0 && (
          <MenuItem value="" disabled>
            No projects
          </MenuItem>
        )}
        {projects.map((p) => (
          <MenuItem key={p.path} value={p.path}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      <IconButton color="inherit" size="small" onClick={() => setAddOpen(true)} title="Add project">
        <AddIcon />
      </IconButton>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm" fullScreen={isMobile}>
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
