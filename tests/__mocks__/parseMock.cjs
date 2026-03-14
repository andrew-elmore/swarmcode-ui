// Mock for parse/dist/parse.min.js — prevents Parse.initialize() crash in Jest/Node context.
// CARD-081: Added User.logIn / logOut / current stubs for auth tests.

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
    include: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue(mockSubscription),
  })),
  Object: {
    extend: jest.fn().mockImplementation((className) => ({
      createWithoutData: jest.fn((id) => ({ id, className })),
    })),
  },
  User: {
    logIn: jest.fn(),
    logOut: jest.fn(),
    current: jest.fn(() => null),
  },
};

module.exports = Parse;
module.exports.default = Parse;
