import { PdfExportRepository, PdfExportRequest, PdfExportResult } from '../pdf.repository';

/**
 * Message shown whenever a demo-mode build is asked to export a PDF.
 * The standalone app (useMockApi: true) has no backend, and PDF rendering must
 * not be approximated in the browser: a hand-written client PDF would not match
 * the selected template, multi-page pagination, fonts, or links, and would
 * bypass the verified, sanitizing backend export. The editor therefore disables
 * the button in demo mode and points users at the full application.
 */
export const DEMO_PDF_UNAVAILABLE_MESSAGE =
  'PDF download requires the local backend. Start the full application to export your resume.';

/**
 * Demo-mode PDF repository. Never produces bytes: PDF export requires the
 * controlled backend service. Used only as a guard so a mock build can never
 * hit the network PDF endpoint; the UI disables the button before this is
 * reachable.
 */
export class MockPdfExportRepository implements PdfExportRepository {
  exportPdf(_versionId: string, _request: PdfExportRequest): Promise<PdfExportResult> {
    return Promise.reject(new Error(DEMO_PDF_UNAVAILABLE_MESSAGE));
  }
}
