import { ResumeContent } from '../models/resume.model';

export interface PdfExportRequest {
  /** Canonical template definition id used by the server-side renderer. */
  templateDefinitionId: string;
  /** Structured resume content; the backend renders it through the shared renderer. */
  content: ResumeContent;
  /** Sanitizable base name, e.g. "Arun Kumar Master Resume". */
  filename: string;
}

export interface PdfExportResult {
  blob: Blob;
  /** Final download filename, including the .pdf extension. */
  filename: string;
  /** Verified page count reported by the export service. */
  pageCount: number;
}

export interface PdfExportRepository {
  exportPdf(versionId: string, request: PdfExportRequest): Promise<PdfExportResult>;
}
