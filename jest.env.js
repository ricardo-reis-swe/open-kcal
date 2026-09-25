// Loads `.env.example` into process.env so tests see the same public config as a local build (ARCH-14).
const fs = require('fs');
const path = require('path');

const file = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
for (const line of file.split('\n')) {
  const match = /^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
}
