import crypto from 'crypto';
import type { AuthSession } from '../types/index';

export type { AuthSession };


/**
 * Hashes a password using scrypt and a cryptographic salt.
 */
export function hashPassword(
  password: string,
  customSalt?: string
): { hash: string; salt: string } {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verifies a password against a known hash and salt using timing-safe comparison.
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  if (!password || !hash || !salt) {
    return false;
  }
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (hashBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, computedBuffer);
  } catch {
    return false;
  }
}

export {
  SESSION_COOKIE_NAME,
  getAuthSecret,
  createSessionToken,
  verifySessionToken,
  getSessionFromRequest,
  constantTimeEqual,
} from './session.ts';
