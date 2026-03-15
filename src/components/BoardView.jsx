import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import { useAppDispatch, useAppSelector } from "../store";
import { setSprintFilter } from "../store/projectSlice";
import { STATUSES, PRIORITY_COLORS, getSprintDisplayName } from "../constants";
import CreateCardDialog from "./CreateCardDialog";
import CardDetailDialog from "./CardDetailDialog";
import SprintManagerDialog from "./SprintManagerDialog";
import StatusManagerDialog from "./StatusManagerDialog";

export default function BoardView() {
  const dispatch = useAppDispatch();
  const { project, cards, sprints, statuses, sprintFilter, loading, error } = useAppSelector((s) => s.project);
  const { activeProject } = useAppSelector((s) => s.projects);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [sprintManagerOpen, setSprintManagerOpen] = useState(false);
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);

  // Derive columns from statuses Redux state; fall back to STATUSES constant if not yet loaded or undefined
  const effectiveStatuses = statuses?.length
    ? [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : STATUSES.map((name, idx) => ({ name, order: idx }));
  const columns = effectiveStatuses.map((s) => ({
    key: s.name,
    label: s.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  if (!activeProject) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          Select a project to view its board.
        </Typography>
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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" data-testid="error-alert">{error}</Alert>
      </Box>
    );
  }

  const selectedCard = selectedCardId
    ? cards.find((c) => c.cardId === selectedCardId) || null
    : null;

  // Filter cards by selected sprint (use sprintName for backward compat with string filter)
  const filteredCards = sprintFilter
    ? cards.filter((c) => (c.sprintName || c.sprint) === sprintFilter)
    : cards;

  // For mobile: filter to the selected column only; default to first column
  const effectiveColumn = selectedColumn || columns[0]?.key || null;
  const visibleColumns = isMobile
    ? columns.filter((col) => col.key === effectiveColumn)
    : columns;

  return (
    <Box sx={{ p: isMobile ? 1 : 2, height: "100%", overflow: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontSize: isMobile ? "1.2rem" : undefined }}>
          Board
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {sprints.length > 0 && (
            <TextField
              select
              size="small"
              value={sprintFilter || ""}
              onChange={(e) => dispatch(setSprintFilter(e.target.value || null))}
              sx={{ minWidth: 160 }}
              label="Sprint"
              data-testid="sprint-filter"
            >
              <MenuItem value="">All Sprints</MenuItem>
              {sprints.map((s) => (
                <MenuItem key={s.objectId} value={s.name}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Button
            variant="outlined"
            onClick={() => setSprintManagerOpen(true)}
            size={isMobile ? "small" : "medium"}
            data-testid="manage-sprints-button"
          >
            Manage Sprints
          </Button>
          <Button
            variant="outlined"
            onClick={() => setStatusManagerOpen(true)}
            size={isMobile ? "small" : "medium"}
            data-testid="manage-statuses-button"
          >
            Manage Statuses
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size={isMobile ? "small" : "medium"}
            data-testid="new-card-button"
          >
            New Card
          </Button>
        </Box>
      </Box>

      {/* Mobile column selector */}
      {isMobile && (
        <TextField
          select
          size="small"
          value={effectiveColumn || ""}
          onChange={(e) => setSelectedColumn(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          label="Column"
        >
          {columns.map((col) => {
            const count = filteredCards.filter((c) => c.status === col.key).length;
            return (
              <MenuItem key={col.key} value={col.key}>
                {col.label} ({count})
              </MenuItem>
            );
          })}
        </TextField>
      )}

      <Box
        sx={{
          display: "flex",
          gap: isMobile ? 0 : 2,
          overflowX: isMobile ? "hidden" : "auto",
          pb: 2,
          flex: 1,
          minHeight: 0,
        }}
      >
        {visibleColumns.map((col) => {
          const colCards = filteredCards.filter((c) => c.status === col.key);
          return (
            <Paper
              key={col.key}
              data-testid={`board-column-${col.key}`}
              sx={{
                minWidth: isMobile ? "100%" : 240,
                maxWidth: isMobile ? "100%" : 280,
                flex: isMobile ? "1 1 100%" : "1 0 240px",
                bgcolor: "background.paper",
                p: 1,
                display: "flex",
                flexDirection: "column",
              }}
              elevation={0}
              variant="outlined"
            >
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, px: 1, fontWeight: 600 }}
              >
                {col.label}{" "}
                <Chip label={colCards.length} size="small" sx={{ ml: 0.5 }} />
              </Typography>
              <Box sx={{ flex: 1, overflowY: "auto" }}>
                {colCards.map((card) => (
                  <Card key={card.cardId} data-testid={`board-card-${card.cardId}`} sx={{ mb: 1 }} variant="outlined">
                    <CardActionArea onClick={() => setSelectedCardId(card.cardId)}>
                      <CardContent
                        sx={{
                          py: isMobile ? 1 : 1.5,
                          px: isMobile ? 1.5 : 2,
                          "&:last-child": { pb: isMobile ? 1 : 1.5 },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {card.title}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 0.5,
                            mt: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Chip
                            label={card.priority}
                            size="small"
                            color={PRIORITY_COLORS[card.priority] || "default"}
                            variant="outlined"
                          />
                          {card.assignee && (
                            <Chip
                              label={card.assignee}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {(card.sprintName || card.sprint) && (
                            <Chip
                              label={getSprintDisplayName(card)}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5, display: "block" }}
                        >
                          {card.cardId}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>

      <CreateCardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={project?.objectId}
      />

      <CardDetailDialog
        open={!!selectedCard}
        onClose={() => setSelectedCardId(null)}
        card={selectedCard}
        projectId={project?.objectId}
      />

      <SprintManagerDialog
        open={sprintManagerOpen}
        onClose={() => setSprintManagerOpen(false)}
        projectId={project?.objectId}
      />

      <StatusManagerDialog
        open={statusManagerOpen}
        onClose={() => setStatusManagerOpen(false)}
        projectId={project?.objectId}
      />
    </Box>
  );
}
