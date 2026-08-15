import { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../http/errors';
import { asyncHandler } from '../middleware/error-handler';
import { JobMatcherService } from '../services/job-matcher/job-matcher.service';

const service = new JobMatcherService();
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const JobMatchBody = z.strictObject({
  jobTitle: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional(),
  jobDescription: z.string().trim().min(200).max(15_000),
});

export const runJobMatch = asyncHandler(async (req: Request, res: Response) => {
  const versionId = req.params.versionId;
  if (!ID_PATTERN.test(versionId)) {
    throw new ValidationError(['versionId: Invalid identifier.']);
  }
  const body = JobMatchBody.parse(req.body);
  res.json(await service.analyzeVersion(req.user!.id, versionId, body, req.ip));
});
