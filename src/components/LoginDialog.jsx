import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useAppDispatch, useAppSelector } from "../store";
import { loginUser, clearError } from "../store/authSlice";

export default function LoginDialog({ open, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  function handleSubmit() {
    dispatch(loginUser({ username, password }))
      .unwrap()
      .then(() => {
        setUsername("");
        setPassword("");
        onClose();
      })
      .catch(() => {});
  }

  function handleClose() {
    dispatch(clearError());
    setUsername("");
    setPassword("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Sign In</DialogTitle>
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
            if (e.key === "Enter") handleSubmit();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
