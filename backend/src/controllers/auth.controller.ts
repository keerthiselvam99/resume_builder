import { Request, Response } from 'express';
import { config } from '../config/config';
import { asyncHandler } from '../middleware/error-handler';
import { AuthService } from '../services/auth/auth.service';
import { AccountRecoveryService } from '../services/auth/account-recovery.service';
import {
  captureEmailProvider,
  isDevelopmentMailboxEnabled,
} from '../services/email/email-provider';

const authService = new AuthService();
const recoveryService = new AccountRecoveryService();
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
    requireVerification: req.header('x-account-recovery-test') === 'true',
  });
  if ('requiresVerification' in session) {
    res.status(201).json(session);
    return;
  }
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

export const verifyEmail = asyncHandler(async (req, res) => {
  await recoveryService.verify(req.body?.token);
  res.json({ verified: true });
});
export const resendVerification = asyncHandler(async (req, res) => {
  await recoveryService.resend(req.body?.email);
  res.status(202).json({ message: 'If verification is needed, an email will be sent.' });
});
export const forgotPassword = asyncHandler(async (req, res) => {
  await recoveryService.forgot(req.body?.email);
  res.status(202).json({ message: 'If an eligible account exists, a reset email will be sent.' });
});
export const resetPassword = asyncHandler(async (req, res) => {
  await recoveryService.reset(req.body?.token, req.body?.newPassword);
  clearRefreshCookie(res);
  res.json({ reset: true });
});
export const capturedEmails = asyncHandler(async (_req, res) => {
  if (!isDevelopmentMailboxEnabled()) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  res.json({ messages: captureEmailProvider.list() });
});
export const capturedEmailAction = asyncHandler(async (req, res) => {
  if (!isDevelopmentMailboxEnabled()) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  const actionPath = captureEmailProvider.actionPath(req.params.id);
  if (!actionPath) {
    res.status(404).json({ error: 'Message action not found.' });
    return;
  }
  res.json({ actionPath });
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
