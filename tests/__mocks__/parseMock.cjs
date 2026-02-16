// Mock for parse/dist/parse.min.js — prevents Parse.initialize() crash in Jest/Node context.

const mockSubscription = {
  on: jest.fn(),
  unsubscribe: jest.fn(),
};

const Parse = {
  initialize: jest.fn(),
  serverURL: "",
  Cloud: {
    run: jest.fn(),
  },
  Query: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn().mockResolvedValue(mockSubscription),
  })),
};

module.exports = Parse;
module.exports.default = Parse;
