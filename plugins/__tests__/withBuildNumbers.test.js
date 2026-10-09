// ROAD-06: build numbers derive from the semver version.
const app = require('../../app.json');
const withBuildNumbers = require('../withBuildNumbers');

const { buildNumberFor } = withBuildNumbers;

describe('withBuildNumbers', () => {
  it('maps MAJOR.MINOR.PATCH to an increasing integer', () => {
    expect(buildNumberFor('0.1.0')).toBe(100);
    expect(buildNumberFor('0.1.9')).toBe(109);
    expect(buildNumberFor('0.2.0')).toBe(200);
    expect(buildNumberFor('1.0.0')).toBe(10000);
    expect(buildNumberFor('1.0.0')).toBeGreaterThan(buildNumberFor('0.99.99'));
  });

  it('rejects versions it cannot map', () => {
    expect(() => buildNumberFor('1.0')).toThrow('MAJOR.MINOR.PATCH');
    expect(() => buildNumberFor('1.0.0-beta.1')).toThrow('MAJOR.MINOR.PATCH');
    expect(() => buildNumberFor('1.100.0')).toThrow('below 100');
  });

  it('sets the iOS buildNumber and Android versionCode', () => {
    const config = withBuildNumbers({ version: '0.3.2', ios: { supportsTablet: true }, android: { package: 'x' } });
    expect(config.ios).toEqual({ supportsTablet: true, buildNumber: '302' });
    expect(config.android).toEqual({ package: 'x', versionCode: 302 });
  });

  it('is registered in app.json and the app and package versions match', () => {
    expect(app.expo.plugins).toContain('./plugins/withBuildNumbers');
    expect(app.expo.version).toBe(require('../../package.json').version);
    expect(() => buildNumberFor(app.expo.version)).not.toThrow();
  });
});
