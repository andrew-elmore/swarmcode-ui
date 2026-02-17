// Shared data-testid selectors for E2E tests
// Mirrors the selectors defined in arch_e2e_testing_165.txt Section 7

// Navigation
export const TAB_MESSAGES = '[data-testid="tab-messages"]';
export const TAB_BOARD = '[data-testid="tab-board"]';
export const TAB_AGENTS = '[data-testid="tab-agents"]';
export const TAB_STREAM = '[data-testid="tab-stream"]';
export const TAB_PROJECTS = '[data-testid="tab-projects"]';
export const TAB_COMMANDS = '[data-testid="tab-commands"]';
export const TAB_ARTICLES = '[data-testid="tab-articles"]';
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

// Articles
export const ARTICLES_VIEW = '[data-testid="articles-view"]';
export const ARTICLE_DETAIL = '[data-testid="article-detail"]';
export const NEW_ARTICLE_BUTTON = '[data-testid="new-article-button"]';
export const ARTICLE_EDIT_DIALOG = '[data-testid="article-edit-dialog"]';
export const ARTICLE_EDIT_TITLE = '[data-testid="article-edit-title"]';
export const ARTICLE_EDIT_TEXT = '[data-testid="article-edit-text"]';
export const ARTICLE_EDIT_KEYWORDS = '[data-testid="article-edit-keywords"]';
export const ARTICLE_EDIT_SAVE = '[data-testid="article-edit-save"]';
export const ARTICLE_BACK_BUTTON = '[data-testid="article-back-button"]';
export const ARTICLE_EDIT_BUTTON = '[data-testid="article-edit-button"]';
export const ARTICLE_DELETE_BUTTON = '[data-testid="article-delete-button"]';
export const ARTICLE_SEARCH_TITLE = '[data-testid="article-search-title"]';
export const ARTICLE_SEARCH_KEYWORDS = '[data-testid="article-search-keywords"]';
export const articleRow = (id: string) =>
  `[data-testid="article-row-${id}"]`;
export const articleRef = (title: string) =>
  `[data-testid="article-ref-${title}"]`;

// Stream
export const STREAM_VIEW = '[data-testid="stream-view"]';
export const STREAM_TOGGLE = '[data-testid="stream-toggle"]';
export const STREAM_STATUS = '[data-testid="stream-status"]';
export const STREAM_QUEUE = '[data-testid="stream-queue"]';
export const STREAM_QUEUE_ITEM = '[data-testid="stream-queue-item"]';
export const STREAM_VOLUME = '[data-testid="stream-volume"]';
export const STREAM_SPEED = '[data-testid="stream-speed"]';
export const MIC_BUTTON = '[data-testid="mic-button"]';
export const MIC_STATUS = '[data-testid="mic-status"]';

// Sprint Manager
export const MANAGE_SPRINTS_BUTTON = '[data-testid="manage-sprints-button"]';
export const SPRINT_MANAGER_DIALOG = '[data-testid="sprint-manager-dialog"]';
export const SPRINT_NEW_NAME = '[data-testid="sprint-new-name"]';
export const SPRINT_ADD_BUTTON = '[data-testid="sprint-add-button"]';
export const SPRINT_LIST_ITEM = '[data-testid="sprint-list-item"]';
export const SPRINT_MOVE_UP = '[data-testid="sprint-move-up"]';
export const SPRINT_MOVE_DOWN = '[data-testid="sprint-move-down"]';
export const SPRINT_DELETE = '[data-testid="sprint-delete"]';
export const SPRINT_EDIT_NAME = '[data-testid="sprint-edit-name"]';

// Card Detail Editing
export const CARD_TITLE_DISPLAY = '[data-testid="card-title-display"]';
export const CARD_TITLE_EDIT = '[data-testid="card-title-edit"]';
export const CARD_DESCRIPTION_DISPLAY = '[data-testid="card-description-display"]';
export const CARD_DESCRIPTION_EDIT = '[data-testid="card-description-edit"]';
export const CARD_ASSIGNEE_SELECT = '[data-testid="card-assignee-select"]';

// Error States
export const ERROR_ALERT = '[data-testid="error-alert"]';
