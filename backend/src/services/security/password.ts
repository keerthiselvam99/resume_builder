import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const N = 16384;
const R = 8;
const P = 1;

const PREFIX = 'scrypt';

/**
 * Hashes a password with a per-user random salt using Node's scrypt (a
 * memory-hard KDF). Stored format: scrypt$<N>$<saltHex>$<hashHex>, which keeps
 * the parameters explicit so they can be raised without breaking old records.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `${PREFIX}$${N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return false;
  }
  const [prefix, n, saltHex, hashHex] = parts;
  if (prefix !== PREFIX) {
    return false;
  }
  const nParam = Number(n);
  if (!Number.isInteger(nParam)) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const derived = await scrypt(password, salt, expected.length, {
    N: nParam,
    r: R,
    p: P,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
