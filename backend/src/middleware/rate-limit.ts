import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';
import { Request } from 'express';
import { config } from '../config/config';

function keyGenerator(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

function makeLimiter(max: number, identifier = false): ReturnType<typeof rateLimit> {
  const options: Partial<Options> = {
    windowMs: config.auth.rateLimit.windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: identifier
      ? (req) =>
          `${keyGenerator(req)}:${String(req.body?.email ?? '')
            .trim()
            .toLowerCase()}`
      : keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    },
  };
  return rateLimit(options);
}

export const loginLimiter = makeLimiter(config.auth.rateLimit.loginMax);
export const registerLimiter = makeLimiter(config.auth.rateLimit.registerMax);
export const refreshLimiter = makeLimiter(config.auth.rateLimit.refreshMax);
/** Job descriptions are relatively expensive to normalize; limit per client without affecting auth. */
export const jobMatchLimiter = makeLimiter(30);
export const adminMutationLimiter = makeLimiter(30);
export const recoveryIpLimiter = makeLimiter(20);
export const recoveryIdentifierLimiter = makeLimiter(5, true);
export const recoveryTokenLimiter = makeLimiter(20);
