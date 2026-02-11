/**
 * CARD-071: Voice picker in AgentEditDialog — Test Suite
 * Updated for CARD-090: Uses browser speechSynthesis instead of server-side Piper.
 * Tests for voice dropdown, preview button, and voice field save.
 * Author: developer-1
 * Updated: 2026-02-11 (CARD-090: browser speechSynthesis replaces getVoices API)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import AgentEditDialog from "../src/components/AgentEditDialog";

// Mock browser speechSynthesis API
const MOCK_BROWSER_VOICES = [
  { name: "Google US English", lang: "en-US", localService: false },
  { name: "Google UK English Female", lang: "en-GB", localService: false },
  { name: "Samantha", lang: "en-US", localService: true },
  { name: "Thomas", lang: "fr-FR", localService: true },
];

const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockGetVoices = jest.fn(() => MOCK_BROWSER_VOICES);
let voicesChangedHandler = null;

beforeEach(() => {
  window.speechSynthesis = {
    speak: mockSpeak,
    cancel: mockCancel,
    getVoices: mockGetVoices,
    speaking: false,
    addEventListener: jest.fn((event, handler) => {
      if (event === "voiceschanged") voicesChangedHandler = handler;
    }),
    removeEventListener: jest.fn(),
  };
  window.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    text,
    voice: null,
    onend: null,
    onerror: null,
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
  voicesChangedHandler = null;
});

const theme = createTheme();

const MOCK_AGENT = {
  name: "developer-1",
  description: "Developer",
  openingInstructions: "",
  permanentMemory: "",
  permissions: { allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"] },
  sortOrder: 2,
  voice: "Samantha",
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

// ─── Voice dropdown ───────────────────────────────────────────────────────────

describe("CARD-071/090: Voice dropdown (browser speechSynthesis)", () => {
  test("renders Voice label in the dialog", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    });
  });

  test("loads browser voices via speechSynthesis.getVoices()", async () => {
    renderDialog();
    await waitFor(() => {
      expect(mockGetVoices).toHaveBeenCalled();
    });
  });

  test("voice selector exists with combobox role", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Voice")).toBeInTheDocument();
    });
    const voiceField = screen.getByLabelText("Voice");
    expect(voiceField).toHaveAttribute("role", "combobox");
  });

  test("handles voiceschanged event (async Chrome voice loading)", async () => {
    // Start with no voices
    mockGetVoices.mockReturnValueOnce([]);
    renderDialog();

    const callsBefore = mockGetVoices.mock.calls.length;

    // Simulate Chrome async voice loading
    mockGetVoices.mockReturnValue(MOCK_BROWSER_VOICES);
    if (voicesChangedHandler) {
      act(() => voicesChangedHandler());
    }

    await waitFor(() => {
      // getVoices should have been called at least once more after voiceschanged
      expect(mockGetVoices.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  test("shows helper text when no browser voices available", async () => {
    mockGetVoices.mockReturnValue([]);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("No browser voices available")).toBeInTheDocument();
    });
  });
});

// ─── Preview button ───────────────────────────────────────────────────────────

describe("CARD-071/090: Voice preview (browser speechSynthesis)", () => {
  test("renders preview button", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTitle("Preview voice")).toBeInTheDocument();
    });
  });

  test("preview button is disabled when no voice selected", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "" } });
    await waitFor(() => {
      const btn = screen.getByTitle("Preview voice");
      expect(btn).toBeDisabled();
    });
  });

  test("preview button is enabled when voice is selected", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "Samantha" } });
    await waitFor(() => {
      const btn = screen.getByTitle("Preview voice");
      expect(btn).not.toBeDisabled();
    });
  });

  test("clicking preview calls speechSynthesis.speak()", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "Samantha" } });
    await waitFor(() => {
      expect(screen.getByTitle("Preview voice")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTitle("Preview voice"));

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  test("preview creates SpeechSynthesisUtterance with agent description", async () => {
    renderDialog({ agent: { ...MOCK_AGENT, voice: "Samantha", description: "Developer" } });
    await waitFor(() => {
      expect(screen.getByTitle("Preview voice")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTitle("Preview voice"));

    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith(
      "Hello, I am Developer."
    );
  });
});

// ─── Save includes voice ──────────────────────────────────────────────────────

describe("CARD-071/090: Voice saved with agent", () => {
  test("onSave includes voice field (browser voice name)", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onSave, agent: { ...MOCK_AGENT, voice: "Samantha" } });

    await waitFor(() => expect(mockGetVoices).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: "Samantha",
        })
      );
    });
  });

  test("onSave sends null voice when Default selected", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onSave, agent: { ...MOCK_AGENT, voice: "" } });

    await waitFor(() => expect(mockGetVoices).toHaveBeenCalled());

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

describe("CARD-071/090: Voice for new agent", () => {
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
