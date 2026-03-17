import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/api";


export const fetchUserDevices = createAsyncThunk(
  "devices/fetchUserDevices",
  async () => {
    return api.getUserDevices();
  }
);

export const deleteUserDevice = createAsyncThunk(
  "devices/deleteUserDevice",
  async (objectId) => {
    await api.deleteUserDevice(objectId);
    return objectId;
  }
);


const devicesSlice = createSlice({
  name: "devices",
  initialState: {
    devices: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUserDevices.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchUserDevices.fulfilled, (state, action) => {
      state.loading = false;
      state.devices = action.payload.devices;
    });
    builder.addCase(fetchUserDevices.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });

    builder.addCase(deleteUserDevice.fulfilled, (state, action) => {
      state.devices = state.devices.filter((d) => d.objectId !== action.payload);
    });
    builder.addCase(deleteUserDevice.rejected, (state, action) => {
      state.error = action.error.message;
    });
  },
});

export const { clearError } = devicesSlice.actions;
export default devicesSlice.reducer;
