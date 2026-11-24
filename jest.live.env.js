// POST-08: jest-expo's setup replaces global fetch with Expo's stub; keep Node's real fetch for the live suite.
const { TestEnvironment } = require('jest-environment-node');

module.exports = class LiveEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.liveFetch = globalThis.fetch.bind(globalThis);
  }
};
