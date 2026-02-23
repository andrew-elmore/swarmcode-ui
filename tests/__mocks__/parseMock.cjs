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
    equalTo: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(mockSubscription),
  })),
  Object: {
    extend: jest.fn().mockImplementation((className) => ({
      createWithoutData: jest.fn((id) => ({ id, className })),
    })),
  },
};

module.exports = Parse;
module.exports.default = Parse;
