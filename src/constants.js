export const STATUSES = ["create", "scope", "implement", "code_review", "test", "test_review", "ship", "done"];

export const PRIORITIES = ["low", "medium", "high", "critical"];

export const PRIORITY_COLORS = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "default",
};

// Resolve the display name from a card's sprint field.
// The API may return sprint as a string (legacy), an object { name }, or null.
export function getSprintDisplayName(card) {
  return card.sprintName || (typeof card.sprint === "string" ? card.sprint : card.sprint?.name) || null;
}

// Build a label lookup from the agents list for display purposes.
export function buildAgentLabels(agents) {
  const labels = { all: "All Agents" };
  agents.forEach((a) => { labels[a.name] = a.description || a.name; });
  return labels;
}

// Derive a project name from a file path (last segment).
export function projectNameFromPath(filePath) {
  return filePath.split(/[/\\]/).filter(Boolean).pop() || filePath;
}
