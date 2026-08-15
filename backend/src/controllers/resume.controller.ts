import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler';
import { ResumeService } from '../services/resume/resume.service';

const resumeService = new ResumeService();

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

const CreateResumeBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
  templateId: z.string().min(1).max(120),
});

const RenameResumeBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
});

const CreateVersionBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
  sourceVersionId: z.string().regex(ID_PATTERN).optional(),
});

const CloneVersionBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
});

const UpdateTemplateBody = z.strictObject({
  templateId: z.string().min(1).max(120),
});

const UpdateContentBody = z.strictObject({
  content: z.unknown(),
});

export const listResumes = asyncHandler(async (req: Request, res: Response) => {
  res.json(await resumeService.list(req.user!.id));
});

export const createResume = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateResumeBody.parse(req.body);
  const resume = await resumeService.create(req.user!.id, body);
  res.status(201).json(resume);
});

export const getResume = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await resumeService.get(req.user!.id, req.params.id));
});

export const renameResume = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  const body = RenameResumeBody.parse(req.body);
  res.json(await resumeService.rename(req.user!.id, req.params.id, body.name));
});

export const duplicateResume = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.status(201).json(await resumeService.duplicate(req.user!.id, req.params.id));
});

export const deleteResume = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  await resumeService.delete(req.user!.id, req.params.id);
  res.status(204).send();
});

export const setPrimaryResume = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await resumeService.setPrimary(req.user!.id, req.params.id));
});

export const markResumeSaved = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await resumeService.markSaved(req.user!.id, req.params.id));
});

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.resumeId);
  res.json(await resumeService.listVersions(req.user!.id, req.params.resumeId));
});

export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.resumeId);
  const body = CreateVersionBody.parse(req.body);
  const version = await resumeService.createVersion(req.user!.id, req.params.resumeId, body);
  res.status(201).json(version);
});

export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await resumeService.getVersion(req.user!.id, req.params.id));
});

export const cloneVersion = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  const body = CloneVersionBody.parse(req.body);
  res.status(201).json(await resumeService.cloneVersion(req.user!.id, req.params.id, body.name));
});

export const publishVersion = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  res.json(await resumeService.publishVersion(req.user!.id, req.params.id));
});

export const updateVersionContent = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  const body = UpdateContentBody.parse(req.body);
  res.json(await resumeService.updateContent(req.user!.id, req.params.id, body.content));
});

export const updateVersionTemplate = asyncHandler(async (req: Request, res: Response) => {
  assertSafeId(req.params.id);
  const body = UpdateTemplateBody.parse(req.body);
  res.json(await resumeService.updateTemplate(req.user!.id, req.params.id, body.templateId));
});

export const compareVersions = asyncHandler(async (req: Request, res: Response) => {
  const versionA = req.query.versionA;
  const versionB = req.query.versionB;
  if (typeof versionA !== 'string' || typeof versionB !== 'string') {
    throw new z.ZodError([
      {
        code: 'custom',
        message: 'versionA and versionB query parameters are required.',
        path: ['versionA'],
      },
    ]);
  }
  assertSafeId(versionA);
  assertSafeId(versionB);
  res.json(await resumeService.compare(req.user!.id, versionA, versionB));
});

function assertSafeId(value: string): void {
  if (!ID_PATTERN.test(value)) {
    const err = new z.ZodError([{ code: 'custom', message: 'Invalid identifier.', path: [] }]);
    throw err;
  }
}
