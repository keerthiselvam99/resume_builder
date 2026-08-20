import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { config } from './config/config';
import apiRouter from './routes';
import { Db } from './db/connection';
import { pdfExportService } from './services/pdf/pdf-export.service';
import { errorHandler } from './middleware/error-handler';
import { getLivez, getPdfz, getReadyz } from './controllers/health.controller';

const app = express();

export const httpLoggerOptions = {
  level: config.logLevel,
  genReqId: () => randomUUID(),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[Redacted]',
  },
};

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: config.bodyLimit }));
app.use(cookieParser());
app.use(pinoHttp(httpLoggerOptions));

/**
 * Correlation ID: echoes the pino request id back to the caller so logs and
 * responses can be joined across hops. This is the only request identifier
 * exposed publicly.
 */
app.use((req, res, next) => {
  const requestId = (req as { id?: unknown }).id;
  if (typeof requestId === 'string') {
    res.setHeader('X-Request-Id', requestId);
  }
  next();
});

app.use('/api/v1', apiRouter);

/**
 * Liveness probe: process is running, independent of Oracle. Used by the
 * Playwright webServer readiness check and by orchestration to see the app
 * process is alive.
 */
app.get('/healthz', getLivez);

/**
 * Standard Kubernetes-style probes. /livez = process alive (no Oracle);
 * /readyz = Oracle reachable, 503 when not. /pdfz = PDF browser worker
 * launched, 503 while it is still warming up.
 */
app.get('/livez', getLivez);
app.get('/readyz', getReadyz);
app.get('/pdfz', getPdfz);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

async function start(): Promise<void> {
  const port = config.port;
  const server = app.listen(port, () => {
    console.log(`ResumeIQ API listening on http://localhost:${port}`);
    console.log(`Data store: ${config.dataStore}`);
  });

  /**
   * Deterministic PDF worker warm-up for environments that opt in (the E2E
   * test-server boundary). Chromium is launched lazily on the first export by
   * default; on a cold process that launch can consume most of the export
   * budget. Starting it here means the first export awaits an already-running
   * launch. Failures are non-fatal: the launch cache is cleared and exports
   * retry the browser launch lazily exactly as they would without warm-up.
   */
  if (process.env.PDF_WARMUP === 'true') {
    pdfExportService.prepare().then(
      () => {
        console.log('ResumeIQ PDF worker is warm and ready to export.');
      },
      (err: unknown) => {
        console.error(
          'ResumeIQ PDF warm-up failed; exports will start the browser lazily.',
          err instanceof Error ? err.message : err
        );
      }
    );
  }

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    server.close(async () => {
      await pdfExportService.close();
      await Db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { app };

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
