import { Request, Response } from 'express';
import { ValidationError } from '../http/errors';
import { asyncHandler } from '../middleware/error-handler';
import { AtsService } from '../services/ats/ats.service';

const atsService = new AtsService();

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * POST /api/v1/versions/:id/ats-analysis
 *
 * The request body is intentionally ignored: the analysis always runs over the
 * saved, authorized version content so clients can never feed the engine their
 * own score fragments.
 */
export const runAtsAnalysis = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await atsService.analyzeVersion(req.user!.id, req.params.id));
});

function assertSafeId(value: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new ValidationError([`Invalid identifier: "${value}".`]);
  }
}
