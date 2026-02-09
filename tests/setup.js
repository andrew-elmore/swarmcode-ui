import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — mock it globally for ChatView tests
Element.prototype.scrollIntoView = jest.fn();
