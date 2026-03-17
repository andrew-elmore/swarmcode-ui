import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useAppDispatch, useAppSelector } from "../store";
import { restoreSession } from "../store/authSlice";
import { registerUserDevice } from "../services/api";

export default function RegisterView() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [internalStatus, setInternalStatus] = useState(null); // null | 'success' | 'error'
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get("deviceId");

  // missing_device is derived -- no setState needed
  const apiStatus = deviceId ? internalStatus : "missing_device";

  useEffect(() => {
    dispatch(restoreSession()).then(() => setSessionRestored(true));
  }, [dispatch]);

  useEffect(() => {
    if (!sessionRestored || !deviceId || !authUser) return;

    registerUserDevice(deviceId)
      .then(() => setInternalStatus("success"))
      .catch(() => setInternalStatus("error"));
  }, [authUser, sessionRestored, deviceId]);

  // Derive display state during render -- no synchronous setState in effects
  const unauthenticated = sessionRestored && !authUser;
  const loading = !sessionRestored || (!unauthenticated && apiStatus === null);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          Device Registration
        </Typography>

        {loading && !unauthenticated && (
          <Box sx={{ mt: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Registering device…
            </Typography>
          </Box>
        )}

        {apiStatus === "success" && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Device registered successfully.
          </Alert>
        )}

        {unauthenticated && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You must be signed in to register this device. Please open the app on your computer, sign in, and scan this QR code again.
          </Alert>
        )}

        {apiStatus === "error" && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Registration failed. Please try again.
          </Alert>
        )}

        {apiStatus === "missing_device" && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Invalid registration link -- no device ID found.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
