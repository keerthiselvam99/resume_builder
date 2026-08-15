import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    getConnection: vi.fn(),
    closePool: vi.fn(),
  };
});

vi.mock('../src/db/connection', () => ({
  Db: {
    getConnection: mocks.getConnection,
    close: mocks.closePool,
  },
}));

import { HealthService } from '../src/services/health.service';

const service = new HealthService();

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports database up when SELECT 1 FROM DUAL succeeds', async () => {
    const fakeConn = {
      execute: vi.fn().mockResolvedValue({ rows: [{ STATUS: 1 }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mocks.getConnection.mockResolvedValue(fakeConn);

    const health = await service.getHealth();

    expect(fakeConn.execute).toHaveBeenCalledWith('SELECT 1 AS STATUS FROM DUAL', [], {
      outFormat: 2,
    });
    expect(health.app).toBe('ok');
    expect(health.database).toBe('up');
    expect(fakeConn.close).toHaveBeenCalled();
  });

  it('reports database down when connection fails and closes no connection', async () => {
    mocks.getConnection.mockRejectedValue(new Error('connection refused'));

    const health = await service.getHealth();

    expect(health.app).toBe('ok');
    expect(health.database).toBe('down');
  });

  it('reports liveness without any database interaction', () => {
    const live = service.getLive();

    expect(live).toMatchObject({ status: 'ok' });
    expect(typeof live.timestamp).toBe('string');
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });
});
