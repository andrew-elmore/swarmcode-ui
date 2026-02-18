import { useEffect, useState } from "react";
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
import { fetchBoard, setSprintFilter } from "../store/boardSlice";
import { PRIORITY_COLORS, getSprintDisplayName } from "../constants";
import CreateCardDialog from "./CreateCardDialog";
import CardDetailDialog from "./CardDetailDialog";
import SprintManagerDialog from "./SprintManagerDialog";

const COLUMNS = [
  { key: "create", label: "Create" },
  { key: "scope", label: "Scope" },
  { key: "implement", label: "Implement" },
  { key: "code_review", label: "Code Review" },
  { key: "test", label: "Test" },
  { key: "test_review", label: "Test Review" },
  { key: "ship", label: "Ship" },
  { key: "done", label: "Done" },
];

export default function BoardView() {
  const dispatch = useAppDispatch();
  const { board, cards, sprints, sprintFilter, loading, error } = useAppSelector((s) => s.board);
  const { activeProject } = useAppSelector((s) => s.projects);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState("create");
  const [sprintManagerOpen, setSprintManagerOpen] = useState(false);

  useEffect(() => {
    if (activeProject) {
      dispatch(fetchBoard(activeProject.path));
    }
  }, [dispatch, activeProject]);

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

  // For mobile: filter to the selected column only
  const visibleColumns = isMobile
    ? COLUMNS.filter((col) => col.key === selectedColumn)
    : COLUMNS;

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
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          label="Column"
        >
          {COLUMNS.map((col) => {
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
        projectHash={board?.projectHash}
      />

      <CardDetailDialog
        open={!!selectedCard}
        onClose={() => setSelectedCardId(null)}
        card={selectedCard}
        projectHash={board?.projectHash}
      />

      <SprintManagerDialog
        open={sprintManagerOpen}
        onClose={() => setSprintManagerOpen(false)}
        projectHash={board?.projectHash}
      />
    </Box>
  );
}
