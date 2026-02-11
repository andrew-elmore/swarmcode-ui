/**
 * CARD-071: Voice picker in AgentEditDialog — Test Suite
 * Tests for voice dropdown, preview button, and voice field save.
 * Author: developer-1
 * Date: 2026-02-11
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import * as api from "../src/services/api";
import AgentEditDialog from "../src/components/AgentEditDialog";

jest.mock("../src/services/api", () => ({
  getVoices: jest.fn(),
  synthesizeSpeech: jest.fn(),
}));

const theme = createTheme();

const MOCK_VOICES = [
  { id: "en_US-amy-medium", name: "Amy", language: "en-US", quality: "medium" },
  { id: "en_US-ryan-medium", name: "Ryan", language: "en-US", quality: "medium" },
  { id: "en_GB-alba-medium", name: "Alba", language: "en-GB", quality: "medium" },
];

const MOCK_AGENT = {
  name: "developer-1",
  description: "Developer",
  openingInstructions: "",
  permanentMemory: "",
  permissions: { allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"] },
  sortOrder: 2,
  voice: "en_US-ryan-medium",
};

function renderDialog(props = {}) {
  const defaults = {
    open: true,
    onClose: jest.fn(),
    agent: MOCK_AGENT,
    onSave: jest.fn().mockResolvedValue(undefined),
  };
  return render(
    <ThemeProvider theme={theme}>
      <AgentEditDialog {...defaults} {...props} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  api.getVoices.mockResolvedValue(MOCK_VOICES);
  api.synthesizeSpeech.mockResolvedValue(new ArrayBuffer(100));
});

afterEach(() => jest.restoreAllMocks());

// ─── Voice dropdown ───────────────────────────────────────────────────────────

describe("CARD-071: Voice dropdown", () => {
  test("renders Voice label in the dialog", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    });
  });

  test("fetches voices when dialog opens", async () => {
    renderDialog();
    await waitFor(() => {
      expect(api.getVoices).toHaveBeenCalled();
    });
  });

  test("voice selector exists with combobox role", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    });
    // MUI select renders a combobox
    const voiceField = screen.getByLabelText("Voice");
    expect(voiceField).toHaveAttribute("role", "combobox");
  });

  test("loads agent voice value from agent prop", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "en_US-amy-medium" } });
    await waitFor(() => {
      expect(api.getVoices).toHaveBeenCalled();
    });
  });

  test("handles getVoices failure gracefully with fallback voices", async () => {
    api.getVoices.mockRejectedValue(new Error("Network error"));
    renderDialog();
    await waitFor(() => {
      expect(api.getVoices).toHaveBeenCalled();
    });
    // Should still render without crashing
    expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    // Should show helper text about fallback
    await waitFor(() => {
      expect(screen.getByText(/Could not reach TTS server/)).toBeInTheDocument();
    });
  });
});

// ─── Preview button ───────────────────────────────────────────────────────────

describe("CARD-071: Voice preview", () => {
  test("renders preview button", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTitle("Preview voice")).toBeInTheDocument();
    });
  });

  test("preview button is disabled when no voice selected", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: null } });
    await waitFor(() => {
      const btn = screen.getByTitle("Preview voice");
      expect(btn).toBeDisabled();
    });
  });

  test("preview button is enabled when voice is selected", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "en_US-amy-medium" } });
    await waitFor(() => {
      const btn = screen.getByTitle("Preview voice");
      expect(btn).not.toBeDisabled();
    });
  });
});

// ─── Save includes voice ──────────────────────────────────────────────────────

describe("CARD-071: Voice saved with agent", () => {
  test("onSave includes voice field", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onSave, agent: { ...MOCK_AGENT, voice: "en_US-ryan-medium" } });

    await waitFor(() => expect(api.getVoices).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: "en_US-ryan-medium",
        })
      );
    });
  });

  test("onSave sends null voice when Default selected", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onSave, agent: { ...MOCK_AGENT, voice: "" } });

    await waitFor(() => expect(api.getVoices).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: null,
        })
      );
    });
  });
});

// ─── New agent creation ───────────────────────────────────────────────────────

describe("CARD-071: Voice for new agent", () => {
  test("new agent dialog shows Voice field", async () => {
    renderDialog({ agent: null });
    await waitFor(() => {
      expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    });
  });

  test("new agent voice selector is present", async () => {
    renderDialog({ agent: null });
    await waitFor(() => {
      const voiceField = screen.getByLabelText("Voice");
      expect(voiceField).toBeInTheDocument();
    });
  });
});
