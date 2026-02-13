import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { approvePairing } from "../services/api";

export default function PairPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uuid = searchParams.get("uuid");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [machineName, setMachineName] = useState(null);

  const handleApprove = async () => {
    if (!uuid) return;
    setStatus("loading");
    setError(null);
    try {
      const result = await approvePairing(uuid);
      setMachineName(result.machine?.name || "Machine");
      setStatus("success");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  if (!uuid) {
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
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h5" gutterBottom>
              Invalid Pairing Link
            </Typography>
            <Typography color="text.secondary">
              This link is missing the machine UUID. Please scan the QR code again.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
      <Card sx={{ maxWidth: 440, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>
            Machine Pairing
          </Typography>

          {status === "idle" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                A new machine wants to connect to your account. Approve to generate
                an API key and pair the device.
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, fontFamily: "monospace" }}>
                UUID: {uuid}
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleApprove}
              >
                Approve Pairing
              </Button>
            </>
          )}

          {status === "loading" && (
            <Box sx={{ py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Pairing machine...</Typography>
            </Box>
          )}

          {status === "success" && (
            <>
              <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Pairing Successful
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {machineName} has been paired to your account. The API key has been
                sent to the machine automatically.
              </Typography>
              <Button variant="outlined" onClick={() => navigate("/")}>
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
                {error}
              </Alert>
              <Button variant="outlined" onClick={handleApprove} sx={{ mr: 1 }}>
                Try Again
              </Button>
              <Button variant="text" onClick={() => navigate("/")}>
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
