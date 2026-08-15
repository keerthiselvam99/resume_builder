import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { exportPdf } from '../controllers/pdf.controller';
import { login, logout, me, refresh, register } from '../controllers/auth.controller';
import { runAtsAnalysis } from '../controllers/ats.controller';
import { runJobMatch } from '../controllers/job-matcher.controller';
import {
  cloneVersion,
  compareVersions,
  createResume,
  createVersion,
  deleteResume,
  duplicateResume,
  getResume,
  getVersion,
  listResumes,
  listVersions,
  markResumeSaved,
  publishVersion,
  renameResume,
  setPrimaryResume,
  updateVersionContent,
  updateVersionTemplate,
} from '../controllers/resume.controller';
import { requireAdmin, requireAuth } from '../middleware/require-auth';
import {
  jobMatchLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from '../middleware/rate-limit';

const router = Router();

router.get('/health', getHealth);

// Authentication
router.post('/auth/register', registerLimiter, register);
router.post('/auth/login', loginLimiter, login);
router.post('/auth/refresh', refreshLimiter, refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', requireAuth, me);

// Resumes (all owned by the authenticated user)
router.get('/resumes', requireAuth, listResumes);
router.post('/resumes', requireAuth, createResume);
router.get('/resumes/:id', requireAuth, getResume);
router.patch('/resumes/:id', requireAuth, renameResume);
router.post('/resumes/:id/duplicate', requireAuth, duplicateResume);
router.delete('/resumes/:id', requireAuth, deleteResume);
router.post('/resumes/:id/primary', requireAuth, setPrimaryResume);
router.post('/resumes/:id/save', requireAuth, markResumeSaved);
router.get('/resumes/:resumeId/versions', requireAuth, listVersions);
router.post('/resumes/:resumeId/versions', requireAuth, createVersion);

// Versions (compare must be declared before /versions/:id)
router.get('/versions/compare', requireAuth, compareVersions);
router.get('/versions/:id', requireAuth, getVersion);
router.post('/versions/:id/clone', requireAuth, cloneVersion);
router.post('/versions/:id/publish', requireAuth, publishVersion);
router.patch('/versions/:id/content', requireAuth, updateVersionContent);
router.patch('/versions/:id/template', requireAuth, updateVersionTemplate);

// ATS analysis (a pure function of the saved version; body is ignored)
router.post('/versions/:id/ats-analysis', requireAuth, runAtsAnalysis);

// Job matching always analyses the authenticated user's server-owned version.
router.post('/versions/:versionId/job-match', requireAuth, jobMatchLimiter, runJobMatch);

// PDF export (auth + ownership enforced in the controller)
router.post('/versions/:versionId/pdf', requireAuth, exportPdf);

// Admin-only placeholder to demonstrate role enforcement
router.get('/admin/placeholder', requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

export default router;
