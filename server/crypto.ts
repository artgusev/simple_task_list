import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * AES-256-GCM for individual database values.
 *
 * Every value is sealed under a fresh random 96-bit nonce and bound to its row and
 * column through the additional authenticated data, so a ciphertext cannot be copied
 * into another row (or another column) without decryption failing.
 *
 * Stored layout: nonce (12 bytes) || ciphertext || authentication tag (16 bytes).
 */

export const ALGORITHM = 'aes-256-gcm';
export const KEY_BYTES = 32;
export const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/**
 * scrypt cost for turning the configured passphrase into the key: 32 MiB of memory and a
 * few hundred milliseconds, paid once at startup. The salt lives in the database, so a copy
 * of the file alone does not let anyone precompute guesses.
 */
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function deriveKey(passphrase: string, salt: Uint8Array): Buffer {
  return scryptSync(passphrase, salt, KEY_BYTES, SCRYPT);
}

export function newSalt(): Buffer {
  return randomBytes(SALT_BYTES);
}

/** Thrown when a value does not open: wrong key, wrong row, or damaged data. */
export class DecryptError extends Error {
  constructor(message = 'wrong key or corrupted value') {
    super(message);
    this.name = 'DecryptError';
  }
}

export class Cipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_BYTES) throw new Error(`Key must be ${KEY_BYTES} bytes`);
  }

  seal(plain: string, aad: string): Buffer {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, body, cipher.getAuthTag()]);
  }

  open(sealed: Uint8Array, aad: string): string {
    if (sealed.byteLength < NONCE_BYTES + TAG_BYTES) throw new DecryptError('value is too short');
    const buf = Buffer.from(sealed.buffer, sealed.byteOffset, sealed.byteLength);
    const nonce = buf.subarray(0, NONCE_BYTES);
    const body = buf.subarray(NONCE_BYTES, buf.length - TAG_BYTES);
    const tag = buf.subarray(buf.length - TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.key, nonce);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    } catch {
      throw new DecryptError();
    }
  }
}
