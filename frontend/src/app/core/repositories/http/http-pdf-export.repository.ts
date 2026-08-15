import { PdfExportRepository, PdfExportRequest, PdfExportResult } from '../pdf.repository';
import { HttpApiClient } from './api-client';

/**
 * HTTP implementation of the PDF export repository. Posts the structured
 * resume content to the backend renderer and returns the verified PDF blob.
 * There is intentionally no localStorage mock: PDF generation requires the
 * controlled headless-Chromium service.
 */
export class HttpPdfExportRepository implements PdfExportRepository {
  constructor(private readonly client: HttpApiClient) {}

  async exportPdf(versionId: string, request: PdfExportRequest): Promise<PdfExportResult> {
    const response = await this.client.requestRaw(
      'POST',
      `/versions/${encodeURIComponent(versionId)}/pdf`,
      request,
    );

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const headerFilename = disposition.match(/filename="([^"]+)"/)?.[1];
    const pageCountHeader = Number(response.headers.get('X-Pdf-Page-Count'));

    return {
      blob,
      filename: headerFilename ?? `${request.filename}.pdf`,
      pageCount: Number.isFinite(pageCountHeader) && pageCountHeader > 0 ? pageCountHeader : 1,
    };
  }
}
