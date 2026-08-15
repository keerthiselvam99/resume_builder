import { Request, Response } from 'express';
import { z } from 'zod';
import { pdfExportService } from '../services/pdf/pdf-export.service';
import { ResumeContentSchema, isResumeContentEmpty } from '../services/pdf/content-validation';
import { config } from '../config/config';
import { PdfBusyError, PdfGenerationError, PdfValidationError } from '../services/pdf/errors';
import { NotFoundError, ValidationError } from '../http/errors';
import { getRepositories } from '../repositories';
import { asyncHandler } from '../middleware/error-handler';

const ExportPdfBody = z.strictObject({
  templateDefinitionId: z.string().min(1).max(120),
  content: ResumeContentSchema,
  filename: z.string().min(1).max(120).optional(),
});

/**
 * POST /api/v1/versions/:versionId/pdf
 *
 * Receives structured resume content plus the canonical template definition id
 * and renders it server-side through the shared renderer. Arbitrary HTML is
 * deliberately NOT accepted (`z.strictObject` rejects unknown keys such as the
 * legacy `html` field), so the endpoint is a resume renderer rather than a
 * general HTML-to-PDF service. The caller must own the resume that owns
 * :versionId; cross-user access returns 404.
 */
export const exportPdf = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ExportPdfBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      {
        pdfExport: {
          versionId: req.params.versionId,
          issues: parsed.error.issues.map((i) => i.message),
        },
      },
      'pdf export rejected'
    );
    res.status(400).json({
      error: 'Invalid export request.',
      details: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  assertVersionIdFormat(req.params.versionId);

  const version = await getRepositories().resumes.getVersionForUser(
    req.user!.id,
    req.params.versionId
  );
  if (!version) {
    throw new NotFoundError('Version not found.');
  }

  try {
    if (isResumeContentEmpty(parsed.data.content)) {
      throw new PdfValidationError(
        'The resume has no content to export yet. Add your details and try again.'
      );
    }

    const result = await pdfExportService.export(
      parsed.data.content,
      parsed.data.templateDefinitionId,
      parsed.data.filename ?? 'resume'
    );

    // Structured diagnostics live in the server logs. Only the page count is
    // exposed publicly (plus the request id set by middleware). Everything else
    // is gated behind PDF_EXPORT_DEBUG=true.
    req.log.info(
      {
        pdfExport: {
          versionId: req.params.versionId,
          templateDefinitionId: parsed.data.templateDefinitionId,
          filename: result.filename,
          pageCount: result.pageCount,
          pageSizePt: result.pageSizePt,
          networkAttempts: result.networkAttempts,
          linkAnnotations: result.linkAnnotations,
          selectableTextBytes: Buffer.byteLength(result.text, 'utf8'),
          pagesWithText: result.pagesText.length,
        },
      },
      'pdf export completed'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', String(result.buffer.length));
    res.setHeader('X-Pdf-Page-Count', String(result.pageCount));
    if (config.pdf.debug) {
      res.setHeader('X-Pdf-Filename', result.filename);
      res.setHeader('X-Pdf-Network-Attempts', String(result.networkAttempts));
      res.setHeader('X-Pdf-Link-Annotations', JSON.stringify(result.linkAnnotations));
    }
    res.send(result.buffer);
  } catch (err) {
    if (err instanceof PdfValidationError) {
      req.log.warn(
        { pdfExport: { error: err.message, versionId: req.params.versionId } },
        'pdf export rejected'
      );
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof PdfBusyError) {
      req.log.warn(
        { pdfExport: { error: err.message, versionId: req.params.versionId } },
        'pdf export busy'
      );
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof PdfGenerationError) {
      req.log.error(
        { pdfExport: { error: err.message, versionId: req.params.versionId } },
        'pdf export failed'
      );
      res.status(500).json({ error: err.message });
      return;
    }
    req.log.error(
      { pdfExport: { versionId: req.params.versionId } },
      'pdf export failed unexpectedly'
    );
    res.status(500).json({ error: 'Could not generate the PDF. Please try again.' });
  }
});

function assertVersionIdFormat(versionId: string): void {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(versionId)) {
    throw new ValidationError(['Invalid version id.']);
  }
}
