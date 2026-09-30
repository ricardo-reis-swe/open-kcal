// Migration 5 (DATA-23): the UX-23 theme preference. Existing installs get `system`. `schema/schema.sql` carries the
// same shape. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

export const migration005: Migration = {
  version: 5,
  name: 'theme preference',
  up: (tx) =>
    tx.exec(`
      ALTER TABLE app_settings
        ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark'));
    `),
};
