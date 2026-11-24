/// <reference types="node" />
// Jest stand-in for src/data/db/transfer/files.ts (ARCH-25): the same exports over Node's fs, on real temp files.
// Paths under `jest-memory://` (the in-memory app database's "directory") are always missing, so startup
// recovery/cleanup in ordinary app tests does nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DatabaseError } from '@/shared/errors';

let tempDir: string | null = null;

const virtual = (p: string) => p.startsWith('jest-memory://');

export function cacheDirectory(): string {
  if (!tempDir) tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-kcal-jest-'));
  return tempDir;
}

export function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export function toUri(p: string): string {
  return 'file://' + encodeURI(p);
}

async function wrap<T>(task: () => T | Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (cause) {
    throw new DatabaseError('File operation failed', { cause });
  }
}

export const exists = async (p: string): Promise<boolean> => (virtual(p) ? false : fs.existsSync(p));

export const size = (p: string): Promise<number> => wrap(() => fs.statSync(p).size);

export const readHead = (p: string, n: number): Promise<Uint8Array> =>
  wrap(() => {
    const fd = fs.openSync(p, 'r');
    try {
      const buffer = Buffer.alloc(n);
      const read = fs.readSync(fd, buffer, 0, n, 0);
      return new Uint8Array(buffer.subarray(0, read));
    } finally {
      fs.closeSync(fd);
    }
  });

export const copy = (from: string, to: string): Promise<void> => wrap(() => fs.copyFileSync(from, to));

export const move = (from: string, to: string): Promise<void> =>
  wrap(() => {
    try {
      fs.renameSync(from, to);
    } catch {
      fs.copyFileSync(from, to);
      fs.rmSync(from);
    }
  });

export const remove = (p: string): Promise<void> =>
  virtual(p) ? Promise.resolve() : wrap(() => fs.rmSync(p, { force: true }));

export const ensureDir = (p: string): Promise<void> =>
  virtual(p) ? Promise.resolve() : wrap(() => void fs.mkdirSync(p, { recursive: true }));

export const removeDir = (p: string): Promise<void> =>
  virtual(p) ? Promise.resolve() : wrap(() => fs.rmSync(p, { recursive: true, force: true }));

export const writeText = (p: string, text: string): Promise<void> => wrap(() => fs.writeFileSync(p, text));

/** Test helper: remove the temp dir. */
export function __resetFiles(): void {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
}
