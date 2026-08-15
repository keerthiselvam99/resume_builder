import { Request, Response } from 'express';
import { config } from '../config/config';
import { asyncHandler } from '../middleware/error-handler';
import { AuthService } from '../services/auth/auth.service';

const authService = new AuthService();
const COOKIE_NAME = config.auth.cookieName;

const cookieOptions = {
  httpOnly: true,
  secure: config.auth.cookieSecure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(COOKIE_NAME, raw, cookieOptions);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const session = await authService.register({
    name: req.body?.name,
    email: req.body?.email,
    password: req.body?.password,
  });
  setRefreshCookie(res, session.rawRefreshToken);
  req.log.info({ auth: { action: 'register', userId: session.user.id } }, 'user registered');
  res.status(201).json(toPublicSession(session));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const session = await authService.login(
    { email: req.body?.email, password: req.body?.password },
    { ip: req.ip }
  );
  setRefreshCookie(res, session.rawRefreshToken);
  req.log.info({ auth: { action: 'login', userId: session.user.id } }, 'user logged in');
  res.json(toPublicSession(session));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const session = await authService.refresh(readRefreshCookie(req), { ip: req.ip });
  setRefreshCookie(res, session.rawRefreshToken);
  res.json(toPublicSession(session));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(readRefreshCookie(req), req.user?.id ?? null);
  clearRefreshCookie(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.json(user);
});

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toPublicSession(session: Awaited<ReturnType<AuthService['login']>>) {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: session.user,
  };
}
