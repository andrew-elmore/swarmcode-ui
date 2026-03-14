import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useAppDispatch, useAppSelector } from "../store";
import { loginUser, createAccount, clearError } from "../store/authSlice";

export default function LoginDialog({ open, onClose }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountName, setAccountName] = useState("");
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  function resetFields() {
    setUsername("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setAccountName("");
  }

  function handleToggleMode() {
    dispatch(clearError());
    resetFields();
    setMode((m) => (m === "signin" ? "signup" : "signin"));
  }

  function handleSubmit() {
    const action =
      mode === "signin"
        ? dispatch(loginUser({ username, password }))
        : dispatch(createAccount({ username, password, firstName, lastName, accountName }));

    action
      .unwrap()
      .then(() => {
        resetFields();
        setMode("signin");
        onClose();
      })
      .catch(() => {});
  }

  function handleClose() {
    dispatch(clearError());
    resetFields();
    setMode("signin");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === "signin" ? "Sign In" : "Sign Up"}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          margin="normal"
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          margin="normal"
          onKeyDown={(e) => {
            if (e.key === "Enter" && mode === "signin") handleSubmit();
          }}
        />
        {mode === "signup" && (
          <>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Account Name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              fullWidth
              margin="normal"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </>
        )}
        <Box sx={{ mt: 1, textAlign: "center" }}>
          <Button variant="text" size="small" onClick={handleToggleMode}>
            {mode === "signin"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {mode === "signin"
            ? loading ? "Signing in…" : "Sign In"
            : loading ? "Signing up…" : "Sign Up"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
