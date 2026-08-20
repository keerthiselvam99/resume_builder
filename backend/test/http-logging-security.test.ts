import express from 'express';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { httpLoggerOptions } from '../src/server';

describe('HTTP logging security', () => {
  it('redacts authentication cookies and bearer tokens', async () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const app = express();
    app.use(pinoHttp(httpLoggerOptions, stream));
    app.get('/probe', (_req, res) => {
      res.setHeader('Set-Cookie', 'refresh_token=refresh-secret; HttpOnly');
      res.json({ ok: true });
    });

    await request(app)
      .get('/probe')
      .set('Authorization', 'Bearer access-secret')
      .set('Cookie', 'refresh_token=request-secret');

    expect(output).not.toContain('access-secret');
    expect(output).not.toContain('refresh-secret');
    expect(output).not.toContain('request-secret');
    expect(output).toContain('[Redacted]');
  });
});
