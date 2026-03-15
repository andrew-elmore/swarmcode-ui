import { useEffect } from "react";
import { useParams, Outlet } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store";
import { fetchRecentProjects, setActiveProject } from "../store/projectsSlice";
import { fetchProject } from "../store/projectSlice";
import { resetConversations } from "../store/messagesSlice";

export default function ProjectLayout() {
  const { projectId } = useParams();
  const dispatch = useAppDispatch();
  const { projects, activeProject } = useAppSelector((s) => s.projects);

  // Fetch projects list if not yet loaded
  useEffect(() => {
    if (projects.length === 0) {
      dispatch(fetchRecentProjects());
    }
  }, [dispatch, projects.length]);

  // Sync URL projectId to Redux activeProject + load project data
  useEffect(() => {
    if (!projectId || projects.length === 0) return;
    const found = projects.find((p) => p.objectId === projectId);
    if (found && activeProject?.objectId !== projectId) {
      dispatch(setActiveProject(found));
      dispatch(resetConversations());
      dispatch(fetchProject(found.path));
    }
  }, [dispatch, projectId, projects, activeProject]);

  return <Outlet />;
}
