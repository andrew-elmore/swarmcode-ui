import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — mock it globally for ChatView tests
Element.prototype.scrollIntoView = jest.fn();

// jsdom doesn't implement speechSynthesis — mock it globally for StreamView tests
if (!window.speechSynthesis) {
  window.speechSynthesis = {
    cancel: jest.fn(),
    speak: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    speaking: false,
    paused: false,
    pending: false,
  };
}

