/**
 * Minimal type surface for `pdfjs-dist`'s legacy build, which is loaded from
 * the CommonJS backend via dynamic `import()` (Node resolves the ESM build).
 * Only the APIs used for programmatic PDF verification are declared.
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export interface PdfTextItem {
    str: string;
  }

  export interface PdfTextContent {
    items: PdfTextItem[];
  }

  export interface PdfLinkAnnotation {
    subtype?: string;
    url?: unknown;
  }

  export interface PdfPageProxy {
    getViewport(options: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<PdfTextContent>;
    getAnnotations(): Promise<PdfLinkAnnotation[]>;
  }

  export interface PdfDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
    destroy(): void;
  }

  export interface PdfDocumentLoadingTask {
    promise: Promise<PdfDocumentProxy>;
    destroy(): Promise<void>;
  }

  export function getDocument(params: {
    data: Uint8Array;
    isEvalSupported?: boolean;
  }): PdfDocumentLoadingTask;
}
