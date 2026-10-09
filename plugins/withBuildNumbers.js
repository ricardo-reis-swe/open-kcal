// ROAD-06: the iOS buildNumber and Android versionCode come from the semver `version`, so each release installs
// over the previous one with no number to bump by hand. MAJOR * 10000 + MINOR * 100 + PATCH (0.1.0 → 100).
function buildNumberFor(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!match) {
    throw new Error(`app.json version must be MAJOR.MINOR.PATCH, got "${version}" (ROAD-06)`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(`app.json version ${version}: MINOR and PATCH must be below 100 (ROAD-06)`);
  }
  return major * 10000 + minor * 100 + patch;
}

function withBuildNumbers(config) {
  const build = buildNumberFor(config.version);
  return {
    ...config,
    ios: { ...config.ios, buildNumber: String(build) },
    android: { ...config.android, versionCode: build },
  };
}

module.exports = withBuildNumbers;
module.exports.buildNumberFor = buildNumberFor;
