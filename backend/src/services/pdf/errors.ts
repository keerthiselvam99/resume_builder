/**
 * Request-level error: the caller sent something invalid (bad HTML, unsafe
 * link scheme, oversized payload). Maps to HTTP 400.
 */
export class PdfValidationError extends Error {
  readonly code = 'PDF_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PdfValidationError';
  }
}

/**
 * Failure while rendering or verifying the PDF (browser error, pagination
 * invariant broken, verification mismatch). Maps to HTTP 500.
 */
export class PdfGenerationError extends Error {
  readonly code = 'PDF_GENERATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PdfGenerationError';
  }
}

/**
 * The export worker is at capacity (concurrency limit reached and the queue
 * is full). Maps to HTTP 503 so the client can retry.
 */
export class PdfBusyError extends Error {
  readonly code = 'PDF_BUSY_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PdfBusyError';
  }
}
