import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/connection', () => ({
  Db: {
    getConnection: vi.fn(),
    close: vi.fn(),
  },
}));

import { Db } from '../src/db/connection';
import { app } from '../src/server';

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with database up', async () => {
    const fakeConn = {
      execute: vi.fn().mockResolvedValue({ rows: [{ STATUS: 1 }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Db.getConnection).mockResolvedValue(fakeConn as never);

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ app: 'ok', database: 'up' });
  });

  it('returns 503 with database down', async () => {
    vi.mocked(Db.getConnection).mockRejectedValue(new Error('refused'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ app: 'ok', database: 'down' });
  });
});

describe('GET /livez (liveness)', () => {
  it('returns 200 without touching Oracle', async () => {
    const res = await request(app).get('/livez');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(Db.getConnection).not.toHaveBeenCalled();
  });
});

describe('GET /readyz (readiness)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with database up', async () => {
    const fakeConn = {
      execute: vi.fn().mockResolvedValue({ rows: [{ STATUS: 1 }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Db.getConnection).mockResolvedValue(fakeConn as never);

    const res = await request(app).get('/readyz');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ app: 'ok', database: 'up' });
  });

  it('returns 503 with database down', async () => {
    vi.mocked(Db.getConnection).mockRejectedValue(new Error('refused'));

    const res = await request(app).get('/readyz');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ app: 'ok', database: 'down' });
  });
});

describe('GET /pdfz (PDF worker readiness)', () => {
  it('returns 503 while the PDF worker has not been launched', async () => {
    // No warm-up runs in unit tests, so the passive probe must report
    // not-ready without ever spawning a browser.
    const res = await request(app).get('/pdfz');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ pdf: 'not-ready' });
  });
});
