import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import { useAppDispatch, useAppSelector } from "../store";
import { signUp, logIn, clearAuthError } from "../store/authSlice";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const dispatch = useAppDispatch();
  const { loading, error, sessionToken } = useAppSelector((s) => s.auth);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redirect after successful login/signup
  useEffect(() => {
    if (sessionToken) {
      const returnTo = searchParams.get("returnTo") || "/";
      navigate(returnTo, { replace: true });
    }
  }, [sessionToken, searchParams, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignUp) {
      dispatch(signUp({ email, password, displayName }));
    } else {
      dispatch(logIn({ email, password }));
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    dispatch(clearAuthError());
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ maxWidth: 400, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">
            SwarmCode
          </Typography>
          <Typography variant="h6" gutterBottom align="center" color="text.secondary">
            {isSignUp ? "Create Account" : "Sign In"}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            {isSignUp && (
              <TextField
                label="Display Name"
                fullWidth
                margin="normal"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus={isSignUp}
              />
            )}
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={!isSignUp}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helperText={isSignUp ? "At least 8 characters" : ""}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 2, mb: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
          </Box>

          <Typography align="center" variant="body2">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <Link component="button" variant="body2" onClick={toggleMode}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
