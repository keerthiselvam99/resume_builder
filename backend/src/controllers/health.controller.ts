import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { pdfExportService } from '../services/pdf/pdf-export.service';

const healthService = new HealthService();

/**
 * Liveness probe: the process is running, independent of Oracle. Returns 200
 * whenever the app can respond.
 */
export function getLivez(_req: Request, res: Response): void {
  res.status(200).json(healthService.getLive());
}

/**
 * Readiness probe: Oracle must be reachable. Returns 503 when it is not.
 */
export async function getReadyz(_req: Request, res: Response): Promise<void> {
  const health = await healthService.getHealth();
  res.status(health.database === 'up' ? 200 : 503).json(health);
}

/**
 * Legacy health endpoint: same semantics as /readyz.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await healthService.getHealth();
  const statusCode = health.database === 'up' ? 200 : 503;
  res.status(statusCode).json(health);
}

/**
 * PDF worker readiness probe: 200 once the shared Chromium instance is
 * launched, 503 while it is still launching or after a failed launch. Passive —
 * polling it never spawns a browser. Environments that need a deterministic
 * first export warm the worker up at boot (PDF_WARMUP=true) and gate exports
 * behind this probe.
 */
export async function getPdfz(_req: Request, res: Response): Promise<void> {
  const ready = await pdfExportService.browserReady();
  res.status(ready ? 200 : 503).json({ pdf: ready ? 'ok' : 'not-ready' });
}
