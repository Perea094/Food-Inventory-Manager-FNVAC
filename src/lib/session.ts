import type { AuthSession } from '../types/index';

export type { AuthSession };

export const SESSION_COOKIE_NAME = 'fnvac_session';

const DEV_AUTH_SECRET_FALLBACK = 'fnvac-dev-secret-key-change-in-production-2026';

export function getAuthSecret(): string {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[ADVERTENCIA DE SEGURIDAD] AUTH_SECRET no está configurado en las variables de entorno. Utilizando clave por defecto no apta para producción.'
    );
  }
  return DEV_AUTH_SECRET_FALLBACK;
}

// ---------------------------------------------------------------------------
// Pure TypeScript SHA-256 and HMAC-SHA256 (Edge Runtime & Node.js Universal)
// ---------------------------------------------------------------------------

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(bytes: number[]): number[] {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  const words: number[] = [];
  const bitLength = bytes.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);

  const padded = Array.from(bytes);
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0x00);

  for (i = 0; i < padded.length; i++) {
    words[i >> 2] |= padded[i] << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (bitLength / maxWord) | 0;
  words[words.length] = bitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) |
        0;
      const temp2 =
        ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
          maj) |
        0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  const result: number[] = [];
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      result.push((hash[i] >> (8 * j)) & 255);
    }
  }
  return result;
}

function computeHmacSha256(keyStr: string, messageStr: string): string {
  const encoder = new TextEncoder();
  let keyBytes = Array.from(encoder.encode(keyStr));
  const msgBytes = Array.from(encoder.encode(messageStr));

  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  while (keyBytes.length < 64) {
    keyBytes.push(0);
  }

  const oKeyPad = keyBytes.map((b) => b ^ 0x5c);
  const iKeyPad = keyBytes.map((b) => b ^ 0x36);

  const innerHash = sha256Bytes(iKeyPad.concat(msgBytes));
  const finalHash = sha256Bytes(oKeyPad.concat(innerHash));

  let binary = '';
  for (let i = 0; i < finalHash.length; i++) {
    binary += String.fromCharCode(finalHash[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Base64url and Timing-Safe String Comparison
// ---------------------------------------------------------------------------

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Public Session API
// ---------------------------------------------------------------------------

export function createSessionToken(
  payload: Omit<AuthSession, 'expiresAt'>,
  expiresInDays: number = 7
): string {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const sessionData: AuthSession = {
    ...payload,
    expiresAt,
  };

  const payloadJson = JSON.stringify(sessionData);
  const payloadB64 = base64UrlEncode(payloadJson);
  const signature = computeHmacSha256(getAuthSecret(), payloadB64);

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): AuthSession | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return null;
    }

    const expectedSignature = computeHmacSha256(getAuthSecret(), payloadB64);
    if (!constantTimeEqual(signature, expectedSignature)) {
      return null;
    }

    const payloadJson = base64UrlDecode(payloadB64);
    const session: AuthSession = JSON.parse(payloadJson);

    if (!session || typeof session !== 'object') {
      return null;
    }

    if (
      !session.expiresAt ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request | any): AuthSession | null {
  if (!req) {
    return null;
  }

  let cookieHeader: string | null | undefined = null;

  if (typeof req.headers?.get === 'function') {
    cookieHeader = req.headers.get('cookie');
  } else if (req.headers && typeof req.headers.cookie === 'string') {
    cookieHeader = req.headers.cookie;
  } else if (typeof req.headers === 'string') {
    cookieHeader = req.headers;
  }

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      let token = rest.join('=');
      try {
        token = decodeURIComponent(token);
      } catch {
        // use raw token if decode fails
      }
      return verifySessionToken(token);
    }
  }

  return null;
}
