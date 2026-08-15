# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Demo mode vs full application

The default dev server runs the app in **demo mode** (`useMockApi: true`):
every API is backed by localStorage, so no backend is required. One feature is
intentionally unavailable in demo mode — **Download PDF** is disabled with the
hint “PDF download requires the local backend. Start the full application to
export your resume.” PDF export only happens on the verified backend service
(Chromium renderer), and a browser-side mock would not match the selected
template, pagination, fonts, or links.

To run the **full application** — backend API plus the HTTP-mode frontend,
with working PDF download — use:

```bash
npm run start:full
```

This starts the backend on `http://127.0.0.1:3000` (with the PDF worker
pre-warmed) and the app on `http://127.0.0.1:4201`. Sign up or log in there and
the Download PDF button exports a real PDF through the backend.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

End-to-end tests use [Playwright](https://playwright.dev/) against the Angular dev
servers and the backend:

```bash
npm run e2e
```

Authoritative runs always start fresh web servers (`reuseExistingServer: false`)
so a stale dev server can never skew results. If you already have the backend
and dev servers running locally and want Playwright to reuse them, pass the
explicit local-development flag:

```bash
E2E_REUSE_SERVERS=1 npm run e2e
```

With PowerShell the flag is set as an environment variable first:

```powershell
$env:E2E_REUSE_SERVERS = "1"; npm run e2e
```

Interactive helpers: `npm run e2e:headed` (visible browser), `npm run e2e:ui`
(Playwright UI), `npm run e2e:report` (last run's HTML report).

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
