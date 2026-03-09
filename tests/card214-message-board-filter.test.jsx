/**
 * CARD-214: Feature — Filter all message queries by projectId (UI + Agent)
 * UI QA Tests — qa-1
 *
 * Covers the three UI-side changes:
 *   1. api.js subscribeToMessages — projectId param, board filter, no-op guard
 *   2. App.jsx — projectId in dep array, guard, resetConversations before fetchProject
 *   3. messagesSlice.js — resetConversations reducer (conversations, unreadCounts, selectedAgent)
 *
 * Also covers the board-switch E2E flow via Redux store simulation:
 *   - Loading conversations, switching boards (resetConversations), verifying blank state,
 *     then re-loading to confirm new projectId is used.
 *
 * Test types:
 *   Unit        — source-level assertions + resetConversations reducer unit tests
 *   Integration — Redux store tests for board-switch behavior
 *   E2E         — Full Redux board-switch flow: load → reset → verify blank → reload
 */

import fs from 'fs';
import path from 'path';
import { configureStore } from '@reduxjs/toolkit';
import * as api from '../src/services/api';
import projectReducer from '../src/store/projectSlice';
import messagesReducer, {
  loadConversation,
  resetConversations,
  selectAgent,
  appendMessage,
} from '../src/store/messagesSlice';

// Read source files for unit (source-level) tests
const apiSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'services', 'api.js'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'App.jsx'),
  'utf8'
);

// ─── Mock API ─────────────────────────────────────────────────────────────────

jest.mock('../src/services/api', () => ({
  getOrCreateProject: jest.fn(),
  createCard: jest.fn(),
  updateCard: jest.fn(),
  addComment: jest.fn(),
  listCards: jest.fn(),
  showCard: jest.fn(),
  sendMessage: jest.fn(),
  getConversation: jest.fn(),
  addRecentProject: jest.fn(),
  getRecentProjects: jest.fn(),
  deleteProject: jest.fn(),
}));

// ─── Test Store Helpers ───────────────────────────────────────────────────────

const BOARD_A_ID = 'board-a-object-id';
const BOARD_B_ID = 'board-b-object-id';

function createTestStore(projectId = BOARD_A_ID, messagesPreload = {}) {
  const projectState = {
    project: { objectId: projectId },
    cards: [],
    selectedCard: null,
    loading: false,
    error: null,
    lastPoll: null,
  };
  return configureStore({
    reducer: { project: projectReducer, messages: messagesReducer },
    preloadedState: {
      project: projectState,
      messages: { ...messagesReducer(undefined, { type: '@@INIT' }), ...messagesPreload },
    },
  });
}

afterEach(() => jest.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS — source-level assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('CARD-214 Unit: api.js subscribeToMessages source', () => {

  test('subscribeToMessages accepts projectId as first parameter', () => {
    expect(apiSrc).toMatch(
      /async function subscribeToMessages\(\s*projectId\s*,\s*onMessage\s*\)/
    );
  });

  test('subscribeToMessages returns no-op () => {} when projectId is falsy', () => {
    expect(apiSrc).toMatch(/if\s*\(!projectId\)\s*return\s*\(\s*\)\s*=>\s*\{\s*\}/);
  });

  test('subscribeToMessages filters LiveQuery by Project Pointer using createWithoutData', () => {
    // Extract the subscribeToMessages function body
    const fnBlock =
      apiSrc.match(/async function subscribeToMessages[\s\S]*?^export async function/m)?.[0] ?? '';
    expect(fnBlock).toContain('Project.createWithoutData(projectId)');
    expect(fnBlock).toContain('query.equalTo("project"');
  });

  test('subscribeToMessages pattern matches subscribeToCommands and subscribeToPings', () => {
    // All three subscriptions should use the same Project.createWithoutData pattern
    expect(apiSrc).toMatch(/subscribeToCommands[\s\S]*?Project\.createWithoutData\(projectId\)/);
    expect(apiSrc).toMatch(/subscribeToPings[\s\S]*?Project\.createWithoutData\(projectId\)/);
    expect(apiSrc).toMatch(/subscribeToMessages[\s\S]*?Project\.createWithoutData\(projectId\)/);
  });

});

describe('CARD-214 Unit: App.jsx subscribeToMessages effect source', () => {

  test('projectId is in the subscribeToMessages useEffect dependency array', () => {
    // Look for the effect that calls subscribeToMessages and check its dep array
    const effectBlock =
      appSrc.match(/subscribeToMessages\(projectId[\s\S]*?\}, \[dispatch,\s*projectId[\s\S]*?\]\)/)?.[0] ?? '';
    expect(effectBlock).not.toBe('');
    expect(effectBlock).toContain('projectId');
    expect(effectBlock).toContain('liveQueryRefreshFlag');
  });

  test('subscribeToMessages useEffect has if (!projectId) return guard', () => {
    const effectBlock =
      appSrc.match(/\/\/ LiveQuery subscription[\s\S]*?}, \[dispatch, projectId, liveQueryRefreshFlag\]\)/)?.[0] ?? '';
    expect(effectBlock).toContain('if (!projectId) return');
  });

  test('resetConversations is dispatched before fetchProject in activeProject effect', () => {
    // Extract the activeProject effect block
    const effectBlock =
      appSrc.match(/if \(activeProject\)\s*\{[\s\S]*?dispatch\(fetchProject\(/)?.[0] ?? '';
    expect(effectBlock).not.toBe('');

    const resetIdx = effectBlock.indexOf('dispatch(resetConversations())');
    const fetchProjectIdx = effectBlock.indexOf('dispatch(fetchProject(');

    expect(resetIdx).toBeGreaterThan(-1);
    expect(fetchProjectIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeLessThan(fetchProjectIdx);
  });

  test('resetConversations is imported from messagesSlice in App.jsx', () => {
    expect(appSrc).toMatch(
      /import\s*\{[^}]*resetConversations[^}]*\}\s*from\s*["']\.\/store\/messagesSlice["']/
    );
  });

});

describe('CARD-214 Unit: messagesSlice resetConversations reducer', () => {

  test('resetConversations resets conversations to { all: emptyConvo }', () => {
    const store = createTestStore();

    // Pre-populate with agent conversations
    store.dispatch(appendMessage({
      from: 'developer-1', to: 'owner', message: 'hi', createdAt: '2026-02-23T10:00:00Z',
    }));
    expect(store.getState().messages.conversations['developer-1']).toBeDefined();

    store.dispatch(resetConversations());

    const conversations = store.getState().messages.conversations;
    expect(Object.keys(conversations)).toEqual(['all']);
    expect(conversations.all.messages).toEqual([]);
    expect(conversations.all.loaded).toBe(false);
    expect(conversations.all.hasMore).toBe(false);
  });

  test('resetConversations resets unreadCounts to { all: 0 }', () => {
    const store = createTestStore();

    // Trigger an unread count by appending a message for a non-selected agent
    store.dispatch(appendMessage({
      from: 'pm-1', to: 'owner', message: 'hello', createdAt: '2026-02-23T10:00:00Z',
    }));
    expect(store.getState().messages.unreadCounts['pm-1']).toBeGreaterThan(0);

    store.dispatch(resetConversations());

    const unreadCounts = store.getState().messages.unreadCounts;
    expect(unreadCounts).toEqual({ all: 0 });
  });

  test('resetConversations sets selectedAgent to null', () => {
    const store = createTestStore();

    store.dispatch(selectAgent('developer-1'));
    expect(store.getState().messages.selectedAgent).toBe('developer-1');

    store.dispatch(resetConversations());

    expect(store.getState().messages.selectedAgent).toBeNull();
  });

  test('resetConversations preserves sending, error, and refreshing state', () => {
    const store = createTestStore(BOARD_A_ID, {
      sending: true,
      refreshing: true,
      error: 'network error',
      liveQueryRefreshFlag: true,
    });

    store.dispatch(resetConversations());

    const state = store.getState().messages;
    // These fields are NOT reset by resetConversations
    expect(state.sending).toBe(true);
    expect(state.refreshing).toBe(true);
    expect(state.error).toBe('network error');
    expect(state.liveQueryRefreshFlag).toBe(true);
  });

  test('resetConversations is exported in messagesSlice actions', () => {
    // Verify resetConversations is a callable action creator
    const action = resetConversations();
    expect(action.type).toBe('messages/resetConversations');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS — Redux store board-switch behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('CARD-214 Integration: board-switch via Redux store', () => {

  test('after resetConversations, selectedAgent is null (blank conversation pane)', () => {
    const store = createTestStore();

    store.dispatch(selectAgent('qa-1'));
    expect(store.getState().messages.selectedAgent).toBe('qa-1');

    // Simulate board switch
    store.dispatch(resetConversations());

    expect(store.getState().messages.selectedAgent).toBeNull();
  });

  test('after resetConversations, only "all" conversation channel remains', () => {
    const store = createTestStore();

    // Load two agent conversations
    store.dispatch(appendMessage({ from: 'pm-1', to: 'owner', message: 'msg1', createdAt: '2026-02-23T10:00:00Z' }));
    store.dispatch(appendMessage({ from: 'developer-1', to: 'owner', message: 'msg2', createdAt: '2026-02-23T10:01:00Z' }));

    expect(Object.keys(store.getState().messages.conversations)).toContain('pm-1');
    expect(Object.keys(store.getState().messages.conversations)).toContain('developer-1');

    store.dispatch(resetConversations());

    expect(Object.keys(store.getState().messages.conversations)).toEqual(['all']);
    expect(store.getState().messages.conversations.all.messages).toEqual([]);
  });

  test('loadConversation after board switch uses the new projectId', async () => {
    const msgs = [
      { from: 'senior-dev-1', to: 'owner', message: 'Board B msg', createdAt: '2026-02-23T12:00:00Z' },
    ];
    api.getConversation.mockResolvedValue({ messages: msgs, hasMore: false });

    // Start on boardA, then switch to boardB — createTestStore sets up boardA context
    createTestStore(BOARD_A_ID);

    // Simulate board switch: first update the store's projectId, then reset conversations
    // (In the real app, App.jsx dispatches resetConversations + fetchProject when activeProject changes)
    const boardBStore = configureStore({
      reducer: { project: projectReducer, messages: messagesReducer },
      preloadedState: {
        project: { project: { objectId: BOARD_B_ID }, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
        messages: messagesReducer(undefined, { type: '@@INIT' }),
      },
    });

    // Dispatch resetConversations to clear stale messages (happens before fetchProject)
    boardBStore.dispatch(resetConversations());
    expect(boardBStore.getState().messages.selectedAgent).toBeNull();
    expect(Object.keys(boardBStore.getState().messages.conversations)).toEqual(['all']);

    // Now load a conversation on the new board
    await boardBStore.dispatch(loadConversation('senior-dev-1'));

    expect(api.getConversation).toHaveBeenCalledWith(
      BOARD_B_ID, 'owner', 'senior-dev-1', { limit: 30 }
    );
    const convo = boardBStore.getState().messages.conversations['senior-dev-1'];
    expect(convo.messages).toEqual(msgs);
    expect(convo.loaded).toBe(true);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// E2E TESTS — Full Redux board-switch flow
// ─────────────────────────────────────────────────────────────────────────────

describe('CARD-214 E2E: full board-switch Redux flow (load → reset → reload)', () => {

  test('conversations from boardA are cleared on switch; boardB loads fresh messages', async () => {
    const boardAMsgs = [
      { from: 'developer-1', to: 'owner', message: 'BoardA message', createdAt: '2026-02-23T09:00:00Z' },
    ];
    const boardBMsgs = [
      { from: 'qa-1', to: 'owner', message: 'BoardB message', createdAt: '2026-02-23T10:00:00Z' },
    ];

    // Step 1: Start on boardA with loaded conversations
    api.getConversation.mockResolvedValueOnce({ messages: boardAMsgs, hasMore: false });
    const storeA = createTestStore(BOARD_A_ID);
    await storeA.dispatch(loadConversation('developer-1'));

    expect(storeA.getState().messages.conversations['developer-1'].messages).toEqual(boardAMsgs);
    expect(storeA.getState().messages.conversations['developer-1'].loaded).toBe(true);

    // Step 2: Simulate board switch — resetConversations fires BEFORE fetchProject
    storeA.dispatch(resetConversations());

    // Conversations are immediately blank
    expect(Object.keys(storeA.getState().messages.conversations)).toEqual(['all']);
    expect(storeA.getState().messages.selectedAgent).toBeNull();

    // Step 3: Now imagine projectId changed to BOARD_B_ID in the Redux store.
    // We simulate by creating a fresh store with BOARD_B_ID pre-loaded.
    api.getConversation.mockResolvedValueOnce({ messages: boardBMsgs, hasMore: false });
    const storeB = configureStore({
      reducer: { project: projectReducer, messages: messagesReducer },
      preloadedState: {
        project: { project: { objectId: BOARD_B_ID }, cards: [], selectedCard: null, loading: false, error: null, lastPoll: null },
        messages: messagesReducer(storeA.getState().messages, { type: '@@INIT' }),
      },
    });

    // Step 4: Load a conversation on the new board
    await storeB.dispatch(loadConversation('qa-1'));

    // Verify: the API was called with BOARD_B_ID (not BOARD_A_ID)
    expect(api.getConversation).toHaveBeenLastCalledWith(
      BOARD_B_ID, 'owner', 'qa-1', { limit: 30 }
    );

    // Verify: boardB's messages are loaded, boardA's messages are gone
    const convoQA = storeB.getState().messages.conversations['qa-1'];
    expect(convoQA.messages).toEqual(boardBMsgs);
    expect(convoQA.loaded).toBe(true);

    // No cross-contamination from boardA
    expect(storeB.getState().messages.conversations['developer-1']).toBeUndefined();
  });

  test('selectedAgent is null after board switch (blank conversation pane as noted by senior-dev-1)', () => {
    const store = createTestStore(BOARD_A_ID);

    // User was viewing developer-1 on boardA
    store.dispatch(selectAgent('developer-1'));
    expect(store.getState().messages.selectedAgent).toBe('developer-1');

    // Board switch fires resetConversations
    store.dispatch(resetConversations());

    // selectedAgent must be null — blank conversation pane
    expect(store.getState().messages.selectedAgent).toBeNull();

    // And no agent conversations exist
    expect(Object.keys(store.getState().messages.conversations)).toEqual(['all']);
  });

  test('unread counts reset on board switch so stale badges do not persist', () => {
    const store = createTestStore(BOARD_A_ID);

    // Several incoming messages from different agents while owner is on 'all' tab
    store.dispatch(appendMessage({ from: 'pm-1', to: 'owner', message: 'msg', createdAt: '2026-02-23T10:00:00Z' }));
    store.dispatch(appendMessage({ from: 'developer-1', to: 'owner', message: 'msg2', createdAt: '2026-02-23T10:01:00Z' }));

    expect(store.getState().messages.unreadCounts['pm-1']).toBeGreaterThan(0);
    expect(store.getState().messages.unreadCounts['developer-1']).toBeGreaterThan(0);

    // Board switch resets everything
    store.dispatch(resetConversations());

    expect(store.getState().messages.unreadCounts).toEqual({ all: 0 });
  });

});
