import { InjectionToken, Provider } from '@angular/core';
import { environment } from '../environment';
import { AuthRepository } from './auth.repository';
import { ResumeRepository } from './resume.repository';
import { TemplateRepository } from './template.repository';
import { AnalysisRepository } from './analysis.repository';
import { SuggestionRepository } from './suggestion.repository';
import { PdfExportRepository } from './pdf.repository';
import { MockAuthRepository } from './mock/mock-auth.repository';
import { MockResumeRepository } from './mock/mock-resume.repository';
import { MockTemplateRepository } from './mock/mock-template.repository';
import { MockAnalysisRepository } from './mock/mock-analysis.repository';
import { MockSuggestionRepository } from './mock/mock-suggestion.repository';
import { MockPdfExportRepository } from './mock/mock-pdf-export.repository';
import { MockStore } from './mock/mock-store';
import { HttpApiClient } from './http/api-client';
import { HttpAuthSession } from './http/http-auth-session';
import { HttpAuthRepository } from './http/http-auth.repository';
import { HttpResumeRepository } from './http/http-resume.repository';
import { HttpAnalysisRepository } from './http/http-analysis.repository';
import { HttpPdfExportRepository } from './http/http-pdf-export.repository';
import { JobMatchRepository } from './job-match.repository';
import { HttpJobMatchRepository } from './http/http-job-match.repository';
import { MockJobMatchRepository } from './mock/mock-job-match.repository';
import { AdminRepository } from './admin.repository';
import { HttpAdminRepository } from './http/http-admin.repository';
import { MockAdminRepository } from './mock/mock-admin.repository';

export const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('AuthRepository');
export const RESUME_REPOSITORY = new InjectionToken<ResumeRepository>('ResumeRepository');
export const TEMPLATE_REPOSITORY = new InjectionToken<TemplateRepository>('TemplateRepository');
export const ANALYSIS_REPOSITORY = new InjectionToken<AnalysisRepository>('AnalysisRepository');
export const SUGGESTION_REPOSITORY = new InjectionToken<SuggestionRepository>(
  'SuggestionRepository',
);
export const PDF_EXPORT_REPOSITORY = new InjectionToken<PdfExportRepository>('PdfExportRepository');
export const JOB_MATCH_REPOSITORY = new InjectionToken<JobMatchRepository>('JobMatchRepository');
export const ADMIN_REPOSITORY = new InjectionToken<AdminRepository>('AdminRepository');

/**
 * True when the app runs against localStorage-backed repositories (the default
 * demo build). Some features are backend-only — PDF export in particular — so
 * the UI can degrade gracefully instead of trying (and failing) network calls.
 */
export const DEMO_MODE = new InjectionToken<boolean>('DemoMode');

export const HTTP_AUTH_SESSION = new InjectionToken<HttpAuthSession>('HttpAuthSession');
export const HTTP_API_CLIENT = new InjectionToken<HttpApiClient>('HttpApiClient');

/**
 * Prevent a mock-enabled build from being treated as production.
 * The production build replaces environment.ts with environment.prod.ts
 * (useMockApi: false); if they ever disagree, fail fast at startup.
 */
if (environment.production && environment.useMockApi) {
  throw new Error(
    'Refusing to start: environment.production is true but useMockApi is also true. ' +
      'A mock-enabled build must never run as production.',
  );
}

/**
 * Repository providers. When environment.useMockApi is true, localStorage-backed
 * mocks are used. Otherwise HTTP repositories talk to the backend; the shared
 * API client attaches the bearer token and refreshes a short-lived access token
 * on 401 (the refresh token is an httpOnly cookie, never visible to JS).
 */
export const repositoryProviders: Provider[] = [
  {
    provide: ADMIN_REPOSITORY,
    deps: [HTTP_API_CLIENT],
    useFactory: (client: HttpApiClient) =>
      environment.useMockApi ? new MockAdminRepository() : new HttpAdminRepository(client),
  },
  {
    provide: HTTP_AUTH_SESSION,
    useFactory: () => new HttpAuthSession(),
  },
  {
    provide: HTTP_API_CLIENT,
    deps: [HTTP_AUTH_SESSION],
    useFactory: (session: HttpAuthSession) =>
      new HttpApiClient({
        baseUrl: environment.apiUrl,
        getAccessToken: () => session.currentAccessToken,
        setAccessToken: (token) => session.setAccessToken(token),
        refresh: () => session.refreshSession(),
        onSessionExpired: () => session.clear(),
      }),
  },
  {
    provide: AUTH_REPOSITORY,
    deps: [HTTP_API_CLIENT, HTTP_AUTH_SESSION],
    useFactory: (client: HttpApiClient, session: HttpAuthSession) => {
      if (environment.useMockApi) {
        MockStore.migrate();
        return new MockAuthRepository();
      }
      return new HttpAuthRepository(client, session);
    },
  },
  {
    provide: RESUME_REPOSITORY,
    deps: [HTTP_API_CLIENT],
    useFactory: (client: HttpApiClient) => {
      if (environment.useMockApi) {
        MockStore.migrate();
        return new MockResumeRepository();
      }
      return new HttpResumeRepository(client);
    },
  },
  {
    provide: TEMPLATE_REPOSITORY,
    useFactory: () => {
      if (environment.useMockApi) {
        MockStore.migrate();
        return new MockTemplateRepository();
      }
      return missingHttp('template');
    },
  },
  {
    provide: ANALYSIS_REPOSITORY,
    deps: [HTTP_API_CLIENT],
    useFactory: (client: HttpApiClient) => {
      if (environment.useMockApi) {
        MockStore.migrate();
        return new MockAnalysisRepository();
      }
      return new HttpAnalysisRepository(client);
    },
  },
  {
    provide: SUGGESTION_REPOSITORY,
    useFactory: () => {
      if (environment.useMockApi) {
        MockStore.migrate();
        return new MockSuggestionRepository();
      }
      return missingHttp('suggestion');
    },
  },
  {
    provide: DEMO_MODE,
    useValue: environment.useMockApi,
  },
  {
    provide: JOB_MATCH_REPOSITORY,
    deps: [HTTP_API_CLIENT, RESUME_REPOSITORY],
    useFactory: (client: HttpApiClient, resumes: ResumeRepository) =>
      environment.useMockApi
        ? new MockJobMatchRepository(resumes)
        : new HttpJobMatchRepository(client),
  },
  {
    provide: PDF_EXPORT_REPOSITORY,
    // PDF export always requires the controlled backend service: real PDF bytes
    // come from the Chromium renderer (template-accurate, paginated, sanitized).
    // In demo mode a guard repository is provided instead of an HTTP one; the
    // editor disables the button and explains how to start the full app.
    deps: [HTTP_API_CLIENT],
    useFactory: (client: HttpApiClient) => {
      if (environment.useMockApi) {
        return new MockPdfExportRepository();
      }
      return new HttpPdfExportRepository(client);
    },
  },
];

function missingHttp(name: string): never {
  throw new Error(
    `HTTP repository for "${name}" is not implemented yet. Set environment.useMockApi = true, or implement the HTTP repository.`,
  );
}
