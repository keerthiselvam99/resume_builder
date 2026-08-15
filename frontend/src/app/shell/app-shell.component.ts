import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/session/session.service';
import { MockBannerComponent } from './mock-banner.component';

@Component({
  selector: 'app-shell',
  template: `
    <app-mock-banner />
    <header class="shell-header">
      <div class="shell-header__inner">
        <a class="shell-header__brand" routerLink="/resumes">
          <span class="shell-header__logo" aria-hidden="true">IQ</span>
          <span class="shell-header__title">ResumeIQ</span>
        </a>

        @if (session.isAuthenticated()) {
          <button
            class="shell-header__toggle"
            type="button"
            [attr.aria-expanded]="menuOpen"
            aria-controls="shell-nav"
            (click)="menuOpen = !menuOpen"
          >
            <span class="sr-only">Toggle navigation</span>
            <span class="burger" aria-hidden="true"></span>
          </button>

          <nav
            id="shell-nav"
            class="shell-nav"
            [class.shell-nav--open]="menuOpen"
            aria-label="Primary"
          >
            <a
              routerLink="/resumes"
              routerLinkActive="shell-nav__link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="shell-nav__link"
              (click)="menuOpen = false"
              >My Resumes</a
            >
            <a
              routerLink="/templates"
              routerLinkActive="shell-nav__link--active"
              class="shell-nav__link"
              (click)="menuOpen = false"
              >Templates</a
            >
            <a
              routerLink="/job-matcher"
              routerLinkActive="shell-nav__link--active"
              class="shell-nav__link"
              (click)="menuOpen = false"
              >Job Matcher</a
            >
            @if (session.isAdmin()) {
              <a
                routerLink="/admin"
                routerLinkActive="shell-nav__link--active"
                class="shell-nav__link"
                (click)="menuOpen = false"
                >Admin</a
              >
            }
            <div class="shell-nav__user">
              <span class="shell-nav__name">{{ session.user()?.name }}</span>
              <button type="button" class="shell-nav__logout" (click)="logout()">Log out</button>
            </div>
          </nav>
        }
      </div>
    </header>

    <main class="shell-main">
      <router-outlet />
    </main>
  `,
  styles: `
    .shell-header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      height: var(--header-height);
    }
    .shell-header__inner {
      max-width: var(--content-max-width);
      margin: 0 auto;
      height: 100%;
      padding: 0 var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }
    .shell-header__brand {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      color: var(--color-text);
    }
    .shell-header__logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      font-weight: 800;
      font-size: var(--fs-sm);
    }
    .shell-header__title {
      font-weight: 700;
      font-size: var(--fs-lg);
    }
    .shell-nav {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .shell-nav__link {
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-md);
      text-decoration: none;
      color: var(--color-text-muted);
      font-size: var(--fs-sm);
      font-weight: 600;
      &:hover {
        background: var(--color-surface-alt);
        color: var(--color-text);
      }
      &--active {
        background: var(--color-primary-soft);
        color: var(--color-primary);
      }
    }
    .shell-nav__user {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: var(--space-4);
      padding-left: var(--space-4);
      border-left: 1px solid var(--color-border);
    }
    .shell-nav__name {
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .shell-nav__logout {
      border: 1px solid var(--color-border-strong);
      background: var(--color-surface);
      color: var(--color-text);
      border-radius: var(--radius-md);
      padding: 0.35rem 0.75rem;
      font-size: var(--fs-sm);
      cursor: pointer;
      &:hover {
        background: var(--color-surface-alt);
      }
    }
    .shell-header__toggle {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-2);
      .burger {
        display: block;
        width: 20px;
        height: 2px;
        background: var(--color-text);
        position: relative;
        &::before,
        &::after {
          content: '';
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          background: var(--color-text);
        }
        &::before {
          top: -6px;
        }
        &::after {
          top: 6px;
        }
      }
    }
    .shell-main {
      min-height: calc(100vh - var(--header-height));
    }
    @media (max-width: 720px) {
      .shell-header__toggle {
        display: inline-flex;
      }
      .shell-nav {
        display: none;
        position: absolute;
        top: var(--header-height);
        left: 0;
        right: 0;
        flex-direction: column;
        align-items: stretch;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        padding: var(--space-3);
        gap: var(--space-1);
        &--open {
          display: flex;
        }
      }
      .shell-nav__user {
        margin-left: 0;
        padding-left: 0;
        border-left: none;
        border-top: 1px solid var(--color-border);
        padding-top: var(--space-3);
        margin-top: var(--space-2);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MockBannerComponent],
})
export class AppShell {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected menuOpen = false;

  protected logout(): void {
    this.session.logout().subscribe(() => {
      this.menuOpen = false;
      void this.router.navigate(['/login']);
    });
  }
}
