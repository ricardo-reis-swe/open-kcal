// ROAD-06: prints the AltStore / SideStore source for one unsigned iOS release, to stdout.
// Usage (Release workflow, macOS): node scripts/altstore-source.mjs <ipa> <built .app Info.plist>
// Users add the source by its stable URL: releases/latest/download/altstore-source.json.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const [ipaPath, infoPlistPath] = process.argv.slice(2);
const repo = process.env.GITHUB_REPOSITORY;
if (!ipaPath || !infoPlistPath || !repo) {
  console.error('Usage: GITHUB_REPOSITORY=owner/repo node scripts/altstore-source.mjs <ipa> <Info.plist>');
  process.exit(1);
}

const { expo } = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', infoPlistPath], { encoding: 'utf8' }));
const ipaName = ipaPath.split('/').pop();

// AltStore refuses an install whose usage descriptions are missing from the source, so they come from the build.
const privacy = Object.fromEntries(Object.entries(info).filter(([key]) => /^NS\w+UsageDescription$/.test(key)));

const source = {
  name: 'Open Kcal',
  identifier: `${expo.ios.bundleIdentifier}.source`,
  sourceURL: `https://github.com/${repo}/releases/latest/download/altstore-source.json`,
  website: `https://github.com/${repo}`,
  apps: [
    {
      name: expo.name,
      bundleIdentifier: expo.ios.bundleIdentifier,
      developerName: 'Ricardo Reis',
      subtitle: 'Local-first calorie and food diary.',
      localizedDescription:
        'A local-first calorie and food diary. Your data stays on your phone: no account, no cloud, no ads.',
      iconURL: `https://raw.githubusercontent.com/${repo}/main/assets/icon.png`,
      versions: [
        {
          version: info.CFBundleShortVersionString,
          buildVersion: info.CFBundleVersion,
          date: new Date().toISOString(),
          downloadURL: `https://github.com/${repo}/releases/download/v${info.CFBundleShortVersionString}/${ipaName}`,
          size: statSync(ipaPath).size,
          minOSVersion: info.MinimumOSVersion,
        },
      ],
      // Unsigned build: no entitlements are embedded; the sideloading tool signs it with the user's Apple ID.
      appPermissions: { entitlements: [], privacy },
    },
  ],
  news: [],
};

process.stdout.write(`${JSON.stringify(source, null, 2)}\n`);
