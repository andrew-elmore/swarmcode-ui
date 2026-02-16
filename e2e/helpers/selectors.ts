// Shared data-testid selectors for E2E tests
// Mirrors the selectors defined in arch_e2e_testing_165.txt Section 7

// Navigation
export const TAB_MESSAGES = '[data-testid="tab-messages"]';
export const TAB_BOARD = '[data-testid="tab-board"]';
export const TAB_AGENTS = '[data-testid="tab-agents"]';
export const TAB_STREAM = '[data-testid="tab-stream"]';
export const TAB_PROJECTS = '[data-testid="tab-projects"]';
export const TAB_COMMANDS = '[data-testid="tab-commands"]';
export const PROJECT_SELECTOR = '[data-testid="project-selector"]';

// Messages
export const agentSidebarItem = (name: string) =>
  `[data-testid="agent-sidebar-item-${name}"]`;
export const MESSAGE_INPUT = '[data-testid="message-input"]';
export const MESSAGE_SEND_BUTTON = '[data-testid="message-send-button"]';
export const MESSAGE_BUBBLE = '[data-testid="message-bubble"]';
export const LOAD_OLDER_BUTTON = '[data-testid="load-older-button"]';
export const CHAT_REFRESH_BUTTON = '[data-testid="chat-refresh-button"]';
export const MOBILE_DRAWER_TOGGLE = '[data-testid="mobile-drawer-toggle"]';

// Board
export const boardColumn = (status: string) =>
  `[data-testid="board-column-${status}"]`;
export const boardCard = (cardId: string) =>
  `[data-testid="board-card-${cardId}"]`;
export const NEW_CARD_BUTTON = '[data-testid="new-card-button"]';
export const CARD_DETAIL_DIALOG = '[data-testid="card-detail-dialog"]';
export const CARD_TITLE_INPUT = '[data-testid="card-title-input"]';
export const CARD_STATUS_SELECT = '[data-testid="card-status-select"]';
export const CARD_PRIORITY_SELECT = '[data-testid="card-priority-select"]';
export const CARD_COMMENT_INPUT = '[data-testid="card-comment-input"]';
export const SPRINT_FILTER = '[data-testid="sprint-filter"]';

// Agents
export const agentListItem = (name: string) =>
  `[data-testid="agent-list-item-${name}"]`;
export const ADD_AGENT_BUTTON = '[data-testid="add-agent-button"]';
export const AGENT_EDIT_DIALOG = '[data-testid="agent-edit-dialog"]';

// Projects
export const ADD_PROJECT_BUTTON = '[data-testid="add-project-button"]';
export const projectListItem = (name: string) =>
  `[data-testid="project-list-item-${name}"]`;
export const DELETE_PROJECT_BUTTON = '[data-testid="delete-project-button"]';

// Commands
export const ORCHESTRATOR_STATUS = '[data-testid="orchestrator-status"]';
export const commandButton = (action: string) =>
  `[data-testid="command-button-${action}"]`;
export const COMMAND_HISTORY_ITEM = '[data-testid="command-history-item"]';
