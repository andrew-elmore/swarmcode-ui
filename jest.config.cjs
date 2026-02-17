module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  transformIgnorePatterns: [
    "/node_modules/(?!(@mui|@babel|@reduxjs|react-redux|@testing-library)/)",
  ],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    // Mock CSS modules and static assets
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|svg)$": "<rootDir>/tests/__mocks__/fileMock.cjs",
    // Mock Parse SDK to prevent module-level initialization crash in Jest/Node
    "^parse$": "<rootDir>/tests/__mocks__/parseMock.cjs",
    // Mock react-markdown (ESM-only) to avoid transformation issues in Jest
    "^react-markdown$": "<rootDir>/tests/__mocks__/reactMarkdownMock.cjs",
  },
  testMatch: ["<rootDir>/tests/**/*.test.{js,jsx}"],
};
