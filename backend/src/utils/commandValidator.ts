/**
 * Validates automation commands against a whitelist of safe patterns.
 * Uses allowlist approach — everything is denied by default.
 */

const ALLOWED_COMMANDS = new Set([
  'open_app',
  'switch_app',
  'close_app',
  'system_info',
  'get_cpu',
  'get_ram',
  'get_disk',
  'open_url',
  'create_folder',
  'search_file',
  'copy_file',
  'move_file',
  'delete_file',
  'list_files',
  'read_file',
  'write_file',
]);

const ALLOWED_PATTERNS = [
  /^open_app:[\w\s-]{1,50}$/,
  /^switch_app:[\w\s-]{1,50}$/,
  /^close_app:[\w\s-]{1,50}$/,
  /^open_url:https?:\/\/[\w.-]+/,
  /^create_folder:[\w\s/-]{1,100}$/,
  /^search_file:[\w\s.*-]{1,100}$/,
  /^copy_file:.{1,260}$/,
  /^move_file:.{1,260}$/,
  /^delete_file:.{1,260}$/,
  /^list_files:.{1,260}$/,
  /^read_file:.{1,260}$/,
  /^write_file:.{1,260}$/,
];

export const commandValidator = {
  isAllowed(command: string): boolean {
    const normalized = command.toLowerCase().trim();
    const base = normalized.split(':')[0];

    if (ALLOWED_COMMANDS.has(base)) return true;
    return ALLOWED_PATTERNS.some((p) => p.test(normalized));
  },
};
