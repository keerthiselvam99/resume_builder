import { createHash, randomBytes, randomUUID } from 'node:crypto';
export function generateActionToken() {
  const raw = randomBytes(32).toString('base64url');
  return { id: randomUUID(), raw, hash: hashActionToken(raw) };
}
export function hashActionToken(raw: string) {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
