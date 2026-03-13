/**
 * Sanitizes user input to prevent injection attacks.
 * Strips null bytes, controls characters, and trims whitespace.
 * Does NOT HTML-encode (responses are rendered in controlled React components).
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // Remove control chars (keep \n \r \t)
    .trim()
    .slice(0, 4000);              // Hard limit
}
