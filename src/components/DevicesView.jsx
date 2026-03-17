import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAppDispatch, useAppSelector } from "../store";
import {
  fetchUserDevices,
  deleteUserDevice,
  clearError,
} from "../store/devicesSlice";

export default function DevicesView() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const { devices, loading, error } = useAppSelector((s) => s.devices);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchUserDevices());
    }
  }, [dispatch, authUser]);

  const handleDeleteClick = (device) => {
    setDeleteTarget(device);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await dispatch(deleteUserDevice(deleteTarget.objectId));
    setDeleting(false);
    if (!result.error) {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  if (!authUser) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
        <Alert severity="info">Sign in to view and manage your registered devices.</Alert>
      </Box>
    );
  }

  if (loading && devices.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: "auto", height: "100%", overflow: "auto" }}>
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Registered Devices</Typography>
      </Box>

      {devices.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No devices registered. Use the QR code button in the top bar to register a device.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device ID</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.objectId} data-testid={`device-list-item-${device.objectId}`}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {device.deviceId.slice(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(device.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title="Delete" onClick={() => handleDeleteClick(device)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Remove Device</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove device <strong>{deleteTarget?.deviceId.slice(0, 8)}...</strong>?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {deleting ? "Removing..." : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
