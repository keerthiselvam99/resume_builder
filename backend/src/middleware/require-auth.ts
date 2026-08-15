import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../http/errors';
import { verifyAccessToken } from '../services/security/tokens';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    next(new UnauthorizedError('Authentication required.'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session.'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    next(new ForbiddenError('Admin access required.'));
    return;
  }
  next();
}
