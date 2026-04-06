/**
 * Token Encryption and Decryption Service
 * Handles secure storage of OAuth tokens in SQLite
 */

import crypto from 'crypto';
import { logger } from './logger';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_ENCODING = 'hex';
const IV_SIZE = 16; // 128 bits
const TAG_SIZE = 16; // 128 bits
const SALT_SIZE = 32; // 256 bits

export class TokenEncryption {
  private encryptionKey: Buffer;

  constructor() {
    const keySource = process.env.TOKEN_ENCRYPTION_KEY || 'default-insecure-key-change-in-production';
    this.encryptionKey = crypto
      .pbkdf2Sync(keySource, 'elixi-salt', 100000, 32, 'sha256');
  }

  /**
   * Encrypt a token string
   */
  encrypt(token: string): string {
    try {
      const iv = crypto.randomBytes(IV_SIZE);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

      let encrypted = cipher.update(token, 'utf8', ENCRYPTION_ENCODING);
      encrypted += cipher.final(ENCRYPTION_ENCODING);

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encrypted
      return `${iv.toString(ENCRYPTION_ENCODING)}:${authTag.toString(ENCRYPTION_ENCODING)}:${encrypted}`;
    } catch (error) {
      logger.error('Token encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt an encrypted token
   */
  decrypt(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, ENCRYPTION_ENCODING);
      const authTag = Buffer.from(authTagHex, ENCRYPTION_ENCODING);

      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, ENCRYPTION_ENCODING, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Check if encryption key is secure
   */
  isUsingSecureKey(): boolean {
    return (process.env.TOKEN_ENCRYPTION_KEY || '').length > 32;
  }
}

export const tokenEncryption = new TokenEncryption();
