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
import { fetchBoard } from "../store/boardSlice";
import CreateCardDialog from "./CreateCardDialog";
import CardDetailDialog from "./CardDetailDialog";

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "qa", label: "QA" },
  { key: "done", label: "Done" },
];

const PRIORITY_COLORS = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "default",
};

export default function BoardView() {
  const dispatch = useAppDispatch();
  const { board, cards, loading, error } = useAppSelector((s) => s.board);
  const { activeProject } = useAppSelector((s) => s.projects);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState("backlog");

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
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const selectedCard = selectedCardId
    ? cards.find((c) => c.cardId === selectedCardId) || null
    : null;

  // For mobile: filter to the selected column only
  const visibleColumns = isMobile
    ? COLUMNS.filter((col) => col.key === selectedColumn)
    : COLUMNS;

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontSize: isMobile ? "1.2rem" : undefined }}>
          Board
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          size={isMobile ? "small" : "medium"}
        >
          New Card
        </Button>
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
            const count = cards.filter((c) => c.status === col.key).length;
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
          minHeight: isMobile ? "auto" : "calc(100vh - 180px)",
        }}
      >
        {visibleColumns.map((col) => {
          const colCards = cards.filter((c) => c.status === col.key);
          return (
            <Paper
              key={col.key}
              sx={{
                minWidth: isMobile ? "100%" : 240,
                maxWidth: isMobile ? "100%" : 280,
                flex: isMobile ? "1 1 100%" : "1 0 240px",
                bgcolor: "grey.100",
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
                  <Card key={card.cardId} sx={{ mb: 1 }} variant="outlined">
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
    </Box>
  );
}
