import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../http/errors';
import { verifyAccessToken } from '../services/security/tokens';
import { getRepositories } from '../repositories';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    next(new UnauthorizedError('Authentication required.'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const current = await getRepositories().users.findById(payload.sub);
    if (!current || current.status !== 'active' || (current.authVersion ?? 0) !== payload.ver)
      throw new Error('inactive');
    req.user = { id: current.id, email: current.email, role: current.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session.'));
  }
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const current = req.user ? await getRepositories().users.findById(req.user.id) : null;
  if (!current || current.status !== 'active' || current.role !== 'admin') {
    next(new ForbiddenError('Admin access required.'));
    return;
  }
  next();
}
