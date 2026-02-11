import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — mock it globally for ChatView tests
Element.prototype.scrollIntoView = jest.fn();

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL — mock globally
// so AudioStreamManager (which uses Blob URLs for <audio> elements) works in tests.
if (typeof URL.createObjectURL === "undefined") {
  let blobCounter = 0;
  URL.createObjectURL = jest.fn(() => `blob:mock-${++blobCounter}`);
  URL.revokeObjectURL = jest.fn();
} else {
  // If they exist but aren't spyable, wrap them
  URL.createObjectURL = jest.fn(URL.createObjectURL);
  URL.revokeObjectURL = jest.fn(URL.revokeObjectURL);
}
