import { it, describe, expect, vi, afterEach } from 'vitest';
import { Request, Response } from 'express';

afterEach(() => {
  delete process.env.AUTH_RATE_LIMIT_LOGIN_MAX;
  vi.resetModules();
});

interface StubResponse extends Response {
  statusCode: number;
  body: unknown;
}

type LoginLimiter = (typeof import('../src/middleware/rate-limit'))['loginLimiter'];

function stubRes(): StubResponse {
  return {
    statusCode: 200,
    body: null,
    status(this: StubResponse, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: StubResponse, body: unknown) {
      this.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
  } as unknown as StubResponse;
}

async function callLimiter(
  limiter: LoginLimiter
): Promise<{ res: StubResponse; next: ReturnType<typeof vi.fn> }> {
  const req = { ip: '203.0.113.1' } as unknown as Request;
  const res = stubRes();
  const next = vi.fn();
  limiter(req, res, next);
  await new Promise((r) => setTimeout(r, 30));
  return { res, next };
}

describe('authentication rate limiting', () => {
  it('blocks requests beyond the configured max with a 429', async () => {
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = '2';
    const { loginLimiter } = await import('../src/middleware/rate-limit');

    const first = await callLimiter(loginLimiter);
    const second = await callLimiter(loginLimiter);
    expect(first.next).toHaveBeenCalledTimes(1);
    expect(second.next).toHaveBeenCalledTimes(1);
    expect(first.res.statusCode).not.toBe(429);

    const third = await callLimiter(loginLimiter);
    expect(third.next).not.toHaveBeenCalled();
    expect(third.res.statusCode).toBe(429);
    expect((third.res.body as { error: string }).error).toContain('Too many attempts');
  });
});
