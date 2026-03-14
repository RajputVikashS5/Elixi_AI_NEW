import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.resolve(__dirname, '../../../memory/elixi.db');

// Command tier classification
const TIER_PATTERNS: { pattern: RegExp; tier: number }[] = [
  { pattern: /^system_info|^get_cpu|^get_ram|^get_disk/, tier: 1 },
  { pattern: /^open_app|^close_app|^play_music|^open_url/, tier: 2 },
  { pattern: /^switch_app|^create_folder|^search_file|^list_files|^read_file|^move_file|^copy_file/, tier: 3 },
  { pattern: /^write_file|^delete_file/, tier: 4 },
  { pattern: /^run_command|^exec|^terminal/, tier: 4 },
  { pattern: /^delete_system|^format|^rm -rf/, tier: 5 },
];

export const permissionService = {
  getCommandTier(command: string): number {
    const normalized = command.toLowerCase().trim();
    for (const { pattern, tier } of TIER_PATTERNS) {
      if (pattern.test(normalized)) return tier;
    }
    return 3; // Default to elevated
  },

  async isPermissionGranted(command: string): Promise<boolean> {
    if (!fs.existsSync(DB_PATH)) return false;
    const db = new Database(DB_PATH);
    try {
      const tier = this.getCommandTier(command);
      if (tier <= 2) return true; // T1/T2 are always allowed (T2 after first grant)

      const row = db
        .prepare('SELECT granted FROM permissions WHERE command_pattern = ? AND granted = 1')
        .get(command) as { granted: number } | undefined;
      return !!row;
    } finally {
      db.close();
    }
  },

  async grantPermission(commandPattern: string, tier: number): Promise<void> {
    if (!fs.existsSync(DB_PATH)) return;
    const db = new Database(DB_PATH);
    try {
      const existing = db
        .prepare('SELECT id FROM permissions WHERE command_pattern = ?')
        .get(commandPattern) as { id: string } | undefined;

      if (existing) {
        db.prepare(
          'UPDATE permissions SET granted = 1, granted_at = CURRENT_TIMESTAMP WHERE command_pattern = ?'
        ).run(commandPattern);
      } else {
        db.prepare(
          'INSERT INTO permissions (id, command_pattern, tier, granted, granted_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)'
        ).run(uuidv4(), commandPattern, tier);
      }
    } finally {
      db.close();
    }
  },

  async getAllPermissions() {
    if (!fs.existsSync(DB_PATH)) return [];
    const db = new Database(DB_PATH);
    try {
      return db.prepare('SELECT * FROM permissions ORDER BY granted_at DESC').all();
    } finally {
      db.close();
    }
  },
};
