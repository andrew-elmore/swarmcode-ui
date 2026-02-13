import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAppDispatch, useAppSelector } from "../store";
import { fetchMe } from "../store/authSlice";
import { setSessionToken } from "../services/api";

export default function AuthGate({ children }) {
  const dispatch = useAppDispatch();
  const { sessionToken, initialized, loading } = useAppSelector((s) => s.auth);
  const location = useLocation();

  // On mount, if we have a stored session token but haven't validated it yet, call getMe
  useEffect(() => {
    if (sessionToken && !initialized) {
      setSessionToken(sessionToken);
      dispatch(fetchMe());
    }
  }, [dispatch, sessionToken, initialized]);

  // No session token at all — redirect to login
  if (!sessionToken) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  // Have token but still validating — show loader
  if (!initialized || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return children;
}
