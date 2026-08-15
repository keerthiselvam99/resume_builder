import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../http/errors';

/** Express 4 does not catch rejected promises; wrap async handlers with this. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    req.log.warn?.({ error: err.issues.map((i) => i.message) }, 'request validation failed');
    res.status(400).json({
      error: 'Invalid request.',
      details: err.issues.map((issue) =>
        `${issue.path.join('.') || 'payload'} ${issue.message}`.trim()
      ),
    });
    return;
  }
  if (err instanceof AppError) {
    const body: { error: string; details?: string[] } = { error: err.message };
    if (err.name === 'ValidationError' && 'details' in err && Array.isArray(err.details)) {
      body.details = err.details as string[];
    }
    req.log.warn?.({ error: err.message, code: err.code }, 'request rejected');
    res.status(err.statusCode).json(body);
    return;
  }
  req.log.error?.({ error: err instanceof Error ? err.message : String(err) }, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
