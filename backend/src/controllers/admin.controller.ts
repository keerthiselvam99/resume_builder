import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../http/errors';
import { AdminUserQuery } from '../repositories/interfaces';
import { AdminService } from '../services/admin/admin.service';
const service = new AdminService();
const one = (value: unknown) => (Array.isArray(value) ? value[0] : value);
function page(req: Request) {
  const value = Number(one(req.query.page) ?? 1),
    size = Number(one(req.query.pageSize) ?? 20);
  if (!Number.isInteger(value) || value < 1 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new ValidationError(['page must be >= 1 and pageSize must be between 1 and 100.']);
  return { page: value, pageSize: size };
}
export async function adminSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.summary());
  } catch (e) {
    next(e);
  }
}
export async function adminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const p = page(req);
    const role = String(one(req.query.role) ?? '');
    const status = String(one(req.query.status) ?? '');
    const sort = String(one(req.query.sort) ?? 'createdAt');
    const direction = String(one(req.query.direction) ?? 'desc');
    if (
      (role && !['user', 'admin'].includes(role)) ||
      (status && !['active', 'disabled'].includes(status)) ||
      !['name', 'email', 'createdAt', 'updatedAt'].includes(sort) ||
      !['asc', 'desc'].includes(direction)
    )
      throw new ValidationError(['Invalid user filter or sort.']);
    res.json(
      await service.users({
        ...p,
        q: String(one(req.query.q) ?? '').trim() || undefined,
        role: role ? (role as AdminUserQuery['role']) : undefined,
        status: status ? (status as AdminUserQuery['status']) : undefined,
        sort: sort as AdminUserQuery['sort'],
        direction: direction as AdminUserQuery['direction'],
      })
    );
  } catch (e) {
    next(e);
  }
}
export async function updateAdminRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (!['user', 'admin'].includes(req.body?.role))
      throw new ValidationError(['role must be user or admin.']);
    res.json(await service.role(req.user!.id, req.params.userId, req.body.role));
  } catch (e) {
    next(e);
  }
}
export async function updateAdminStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!['active', 'disabled'].includes(req.body?.status))
      throw new ValidationError(['status must be active or disabled.']);
    res.json(await service.status(req.user!.id, req.params.userId, req.body.status));
  } catch (e) {
    next(e);
  }
}
export async function adminAudits(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await service.audits({
        ...page(req),
        action: String(one(req.query.action) ?? '') || undefined,
        actorUserId: String(one(req.query.actor) ?? '') || undefined,
        targetUserId: String(one(req.query.targetUser) ?? '') || undefined,
        from: String(one(req.query.from) ?? '') || undefined,
        to: String(one(req.query.to) ?? '') || undefined,
      })
    );
  } catch (e) {
    next(e);
  }
}
