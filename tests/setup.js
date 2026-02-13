// Polyfill TextEncoder/TextDecoder for react-router-dom v7 in jsdom
import { TextEncoder, TextDecoder } from "util";
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;

import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — mock it globally for ChatView tests
Element.prototype.scrollIntoView = jest.fn();

