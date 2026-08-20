import { Routes } from '@angular/router';
import { AppShell } from './shell/app-shell.component';
import { authGuard, guestGuard, adminGuard } from './core/guards/auth.guard';
import { canDeactivateEditor } from './features/editor/editor.guard';
import { environment } from './core/environment';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'resumes', pathMatch: 'full' },
      { path: 'dashboard', redirectTo: 'resumes', pathMatch: 'full' },
      {
        path: 'templates',
        loadComponent: () =>
          import('./features/templates/gallery.component').then((m) => m.GalleryComponent),
        title: 'Templates',
      },
      {
        path: 'templates/:id',
        loadComponent: () =>
          import('./features/templates/template-preview.component').then(
            (m) => m.TemplatePreviewComponent,
          ),
        title: 'Template Preview',
      },
      {
        path: 'resumes',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'My Resumes',
      },
      {
        path: 'resumes/drafts',
        data: { drafts: true },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Drafts',
      },

      {
        path: 'resumes/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/resumes/create-resume.component').then((m) => m.CreateResumeComponent),
        title: 'Create Resume',
      },
      {
        path: 'resumes/:resumeId/versions/:versionId/edit',
        canDeactivate: [canDeactivateEditor],
        loadComponent: () =>
          import('./features/editor/resume-editor.component').then((m) => m.ResumeEditorComponent),
        title: 'Resume Editor',
      },
      {
        path: 'job-matcher',
        loadComponent: () =>
          import('./features/job-matcher/job-matcher.component').then((m) => m.JobMatcherComponent),
        title: 'Job Matcher',
      },
      { path: 'job-descriptions', redirectTo: 'job-matcher', pathMatch: 'full' },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
        title: 'Admin',
      },
    ],
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Log in',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
    title: 'Register',
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    title: 'Forgot password',
  },
  {
    path: 'check-email',
    loadComponent: () =>
      import('./features/auth/check-email.component').then((m) => m.CheckEmailComponent),
    title: 'Check your email',
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email.component').then((m) => m.VerifyEmailComponent),
    title: 'Verify email',
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'Reset password',
  },
  ...(environment.production
    ? []
    : [
        {
          path: 'dev/mailbox',
          loadComponent: () =>
            import('./features/dev-mailbox/dev-mailbox.component').then(
              (m) => m.DevMailboxComponent,
            ),
          title: 'Development email mailbox',
        },
      ]),
  { path: '**', redirectTo: 'resumes' },
];
