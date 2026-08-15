import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';
import { Request } from 'express';
import { config } from '../config/config';

function keyGenerator(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

function makeLimiter(max: number): ReturnType<typeof rateLimit> {
  const options: Partial<Options> = {
    windowMs: config.auth.rateLimit.windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    },
  };
  return rateLimit(options);
}

export const loginLimiter = makeLimiter(config.auth.rateLimit.loginMax);
export const registerLimiter = makeLimiter(config.auth.rateLimit.registerMax);
export const refreshLimiter = makeLimiter(config.auth.rateLimit.refreshMax);
