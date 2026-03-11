/**
 * CARD-001: CRUD for Board Statuses
 * Unit tests for the projectSlice status reducers.
 * Tests pure reducer logic for createStatus, updateStatus, deleteStatus.
 */

import projectReducer, {
  createStatus,
  updateStatus,
  deleteStatus,
} from "../../src/store/projectSlice";

const initialState = {
  project: null,
  cards: [],
  sprints: [],
  statuses: [],
  sprintFilter: null,
  selectedCard: null,
  loading: false,
  error: null,
  lastPoll: null,
};

const STATUS_A = { objectId: "st1", name: "create", agentName: "pm-1", order: 0 };
const STATUS_B = { objectId: "st2", name: "implement", agentName: "developer-1", order: 1 };
const STATUS_C = { objectId: "st3", name: "done", agentName: null, order: 2 };

const stateWithStatuses = {
  ...initialState,
  statuses: [STATUS_A, STATUS_B, STATUS_C],
};

describe("CARD-001: projectSlice — status reducers", () => {
  describe("createStatus.fulfilled", () => {
    test("appends a new status to the statuses array", () => {
      const newStatus = { objectId: "st4", name: "test", agentName: "qa-1", order: 3 };
      const action = {
        type: createStatus.fulfilled.type,
        payload: { status: newStatus },
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses).toHaveLength(4);
      expect(state.statuses.find((s) => s.objectId === "st4")).toBeDefined();
    });

    test("sorts statuses by order after appending", () => {
      const outOfOrder = { objectId: "st0", name: "planning", agentName: "pm-1", order: -1 };
      const action = {
        type: createStatus.fulfilled.type,
        payload: { status: outOfOrder },
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses[0].objectId).toBe("st0");
      expect(state.statuses[1].objectId).toBe("st1");
    });

    test("works correctly on an empty statuses array", () => {
      const newStatus = { objectId: "st1", name: "create", agentName: "pm-1", order: 0 };
      const action = {
        type: createStatus.fulfilled.type,
        payload: { status: newStatus },
      };
      const state = projectReducer(initialState, action);
      expect(state.statuses).toHaveLength(1);
      expect(state.statuses[0].objectId).toBe("st1");
    });
  });

  describe("updateStatus.fulfilled", () => {
    test("replaces the matching status in place", () => {
      const updated = { ...STATUS_B, name: "in review" };
      const action = {
        type: updateStatus.fulfilled.type,
        payload: { status: updated },
      };
      const state = projectReducer(stateWithStatuses, action);
      const found = state.statuses.find((s) => s.objectId === "st2");
      expect(found.name).toBe("in review");
      expect(state.statuses).toHaveLength(3);
    });

    test("re-sorts by order after update", () => {
      // Move STATUS_C (order 2) to order -1 so it becomes first
      const updated = { ...STATUS_C, order: -1 };
      const action = {
        type: updateStatus.fulfilled.type,
        payload: { status: updated },
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses[0].objectId).toBe("st3");
    });

    test("leaves list unchanged when statusId is not found", () => {
      const action = {
        type: updateStatus.fulfilled.type,
        payload: { status: { objectId: "unknown", name: "ghost", order: 0 } },
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses).toEqual(stateWithStatuses.statuses);
    });
  });

  describe("deleteStatus.fulfilled", () => {
    test("removes the status with the given statusId", () => {
      const action = {
        type: deleteStatus.fulfilled.type,
        meta: { arg: { statusId: "st2" } },
        payload: {},
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses).toHaveLength(2);
      expect(state.statuses.find((s) => s.objectId === "st2")).toBeUndefined();
    });

    test("preserves other statuses when one is deleted", () => {
      const action = {
        type: deleteStatus.fulfilled.type,
        meta: { arg: { statusId: "st2" } },
        payload: {},
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses.find((s) => s.objectId === "st1")).toBeDefined();
      expect(state.statuses.find((s) => s.objectId === "st3")).toBeDefined();
    });

    test("leaves list unchanged when statusId is not found", () => {
      const action = {
        type: deleteStatus.fulfilled.type,
        meta: { arg: { statusId: "nope" } },
        payload: {},
      };
      const state = projectReducer(stateWithStatuses, action);
      expect(state.statuses).toHaveLength(3);
    });

    test("results in empty list when the only status is deleted", () => {
      const singleState = { ...initialState, statuses: [STATUS_A] };
      const action = {
        type: deleteStatus.fulfilled.type,
        meta: { arg: { statusId: "st1" } },
        payload: {},
      };
      const state = projectReducer(singleState, action);
      expect(state.statuses).toHaveLength(0);
    });
  });
});
