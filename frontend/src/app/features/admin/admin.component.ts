import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AccountStatus,
  AdminRole,
  AdminSummary,
  AdminUser,
  AuditEvent,
} from '../../core/models/admin.model';
import { ADMIN_REPOSITORY } from '../../core/repositories/repository.providers';
import { SessionService } from '../../core/session/session.service';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="admin" aria-labelledby="admin-title">
    <header>
      <div>
        <p class="eyebrow">Administration</p>
        <h1 id="admin-title">Admin console</h1>
        <p>Manage access without exposing authentication secrets.</p>
      </div>
      <button type="button" (click)="load()">Refresh</button>
    </header>
    <p class="status" aria-live="polite">{{ message() }}</p>
    @if (summary()) {
      <div class="summary" aria-label="Account and resume summary">
        @for (card of cards(); track card.label) {
          <article>
            <strong>{{ card.value }}</strong
            ><span>{{ card.label }}</span>
          </article>
        }
      </div>
    }
    <section class="panel">
      <h2>Users</h2>
      <div class="filters">
        <label>Search<input [(ngModel)]="q" (ngModelChange)="page = 1; loadUsers()" /></label
        ><label
          >Role<select [(ngModel)]="role" (ngModelChange)="page = 1; loadUsers()">
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select></label
        ><label
          >Status<select [(ngModel)]="status" (ngModelChange)="page = 1; loadUsers()">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select></label
        >
      </div>
      @if (loading()) {
        <p>Loading users…</p>
      } @else if (!users().length) {
        <p>No users match these filters.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td>{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span class="badge">{{ user.role }}</span>
                  </td>
                  <td>
                    <span class="badge">{{ user.status }}</span>
                  </td>
                  <td>{{ date(user.createdAt) }}</td>
                  <td>{{ date(user.updatedAt) }}</td>
                  <td class="actions">
                    <button
                      type="button"
                      [disabled]="isSelf(user)"
                      [title]="isSelf(user) ? 'You cannot change your own administrator role.' : ''"
                      (click)="confirm(user, 'role')"
                    >
                      {{ user.role === 'admin' ? 'Demote to User' : 'Promote to Admin' }}</button
                    ><button
                      type="button"
                      [disabled]="isSelf(user)"
                      [title]="isSelf(user) ? 'You cannot disable your own account.' : ''"
                      (click)="confirm(user, 'status')"
                    >
                      {{ user.status === 'active' ? 'Disable account' : 'Enable account' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <nav class="pager" aria-label="User pages">
        <button type="button" [disabled]="page <= 1" (click)="page = page - 1; loadUsers()">
          Previous</button
        ><span>Page {{ page }} of {{ totalPages() || 1 }}</span
        ><button
          type="button"
          [disabled]="page >= totalPages()"
          (click)="page = page + 1; loadUsers()"
        >
          Next
        </button>
      </nav>
    </section>
    <section class="panel">
      <h2>Audit events</h2>
      @if (!events().length) {
        <p>No administrative events yet.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Safe details</th>
              </tr>
            </thead>
            <tbody>
              @for (event of events(); track event.id) {
                <tr>
                  <td>{{ date(event.createdAt) }}</td>
                  <td>{{ event.action }}</td>
                  <td>{{ event.actorUserId || 'System' }}</td>
                  <td>{{ event.targetUserId || '—' }}</td>
                  <td>{{ event.details || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    <dialog #dialog (close)="restoreFocus()">
      <h2>Confirm account change</h2>
      @if (selected()) {
        <p>{{ dialogText() }}</p>
      }
      <div class="dialog-actions">
        <button type="button" (click)="dialog.close()">Cancel</button
        ><button type="button" [disabled]="pending()" (click)="apply()">
          {{ pending() ? 'Applying…' : 'Confirm change' }}
        </button>
      </div>
    </dialog>
  </section>`,
  styles: `
    :host {
      display: block;
    }
    .admin {
      max-width: 1200px;
      margin: auto;
      padding: 2rem 1rem;
      min-width: 0;
      overflow-x: clip;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    .eyebrow {
      color: var(--color-primary);
      font-weight: 700;
    }
    .status {
      min-height: 1.5rem;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 1rem;
    }
    .summary article,
    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1rem;
    }
    .summary article {
      display: flex;
      flex-direction: column;
    }
    .summary strong {
      font-size: 1.75rem;
    }
    .panel {
      margin-top: 1rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .filters label {
      display: grid;
      gap: 0.35rem;
    }
    input,
    select,
    button {
      box-sizing: border-box;
      max-width: 100%;
      min-height: 42px;
      padding: 0.5rem;
      border: 1px solid var(--color-border-strong);
      border-radius: 0.4rem;
      background: var(--color-surface);
      color: var(--color-text);
    }
    button {
      cursor: pointer;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 850px;
    }
    th,
    td {
      text-align: left;
      padding: 0.7rem;
      border-bottom: 1px solid var(--color-border);
    }
    .badge {
      text-transform: capitalize;
      font-weight: 700;
    }
    .actions {
      display: flex;
      gap: 0.4rem;
    }
    .pager,
    .dialog-actions {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1rem;
    }
    dialog {
      max-width: 480px;
      border: 0;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 20px 50px #0005;
    }
    dialog::backdrop {
      background: #0008;
    }
    @media (max-width: 600px) {
      header {
        display: block;
      }
      .filters > * {
        width: 100%;
      }
      .table-wrap table {
        min-width: 0;
        width: 100%;
        table-layout: fixed;
      }
      .table-wrap thead {
        display: none;
      }
      .table-wrap tr {
        display: block;
        box-sizing: border-box;
        width: 100%;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        margin: 0.75rem 0;
        padding: 0.5rem;
      }
      .table-wrap td {
        display: grid;
        grid-template-columns: 7rem minmax(0, 1fr);
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .table-wrap td:nth-child(1)::before {
        content: 'Name';
      }
      .table-wrap td:nth-child(2)::before {
        content: 'Email';
      }
      .table-wrap td:nth-child(3)::before {
        content: 'Role';
      }
      .table-wrap td:nth-child(4)::before {
        content: 'Status';
      }
      .table-wrap td:nth-child(5)::before {
        content: 'Created';
      }
      .table-wrap td:nth-child(6)::before {
        content: 'Updated';
      }
      .table-wrap td:nth-child(7)::before {
        content: 'Actions';
      }
      .actions {
        display: grid !important;
      }
    }
  `,
})
export class AdminComponent {
  private repo = inject(ADMIN_REPOSITORY);
  private session = inject(SessionService);
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  summary = signal<AdminSummary | null>(null);
  users = signal<AdminUser[]>([]);
  events = signal<AuditEvent[]>([]);
  loading = signal(true);
  pending = signal(false);
  message = signal('');
  totalPages = signal(1);
  q = '';
  role = '';
  status = '';
  page = 1;
  selected = signal<AdminUser | null>(null);
  action = signal<'role' | 'status'>('role');
  private trigger: HTMLElement | null = null;
  constructor() {
    this.load();
  }
  cards() {
    const s = this.summary();
    return s
      ? [
          { label: 'Total users', value: s.totalUsers },
          { label: 'Active', value: s.activeUsers },
          { label: 'Disabled', value: s.disabledUsers },
          { label: 'Administrators', value: s.adminCount },
          { label: 'Resumes', value: s.totalResumes },
          { label: 'Saved / drafts', value: `${s.savedResumes} / ${s.drafts}` },
        ]
      : [];
  }
  load() {
    this.repo
      .summary()
      .subscribe({ next: (s) => this.summary.set(s), error: (e) => this.message.set(e.message) });
    this.loadUsers();
    this.loadAudits();
  }
  loadUsers() {
    this.loading.set(true);
    this.repo
      .users({
        page: this.page,
        pageSize: 10,
        q: this.q || undefined,
        role: (this.role as AdminRole) || undefined,
        status: (this.status as AccountStatus) || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.users.set(r.items);
          this.totalPages.set(r.totalPages);
        },
        error: (e) => this.message.set(e.message),
      });
  }
  loadAudits() {
    this.repo.audits({ page: 1, pageSize: 20 }).subscribe({
      next: (r) => this.events.set(r.items),
      error: (e) => this.message.set(e.message),
    });
  }
  confirm(user: AdminUser, action: 'role' | 'status') {
    this.trigger = document.activeElement as HTMLElement;
    this.selected.set(user);
    this.action.set(action);
    this.dialog.nativeElement.showModal();
  }
  dialogText() {
    const u = this.selected()!;
    return this.action() === 'role'
      ? `${u.role === 'admin' ? 'Remove administrator access from' : 'Grant administrator access to'} ${u.name} (${u.email})? Active sessions will be revoked.`
      : `${u.status === 'active' ? 'Disable' : 'Enable'} ${u.name} (${u.email})? ${u.status === 'active' ? 'They will lose access immediately.' : 'They must log in again.'}`;
  }
  apply() {
    const u = this.selected()!;
    this.pending.set(true);
    const op =
      this.action() === 'role'
        ? this.repo.updateRole(u.id, u.role === 'admin' ? 'user' : 'admin')
        : this.repo.updateStatus(u.id, u.status === 'active' ? 'disabled' : 'active');
    op.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => {
        this.message.set('Account updated successfully.');
        this.dialog.nativeElement.close();
        this.load();
      },
      error: (e) => this.message.set(e.message),
    });
  }
  restoreFocus() {
    this.trigger?.focus();
  }
  isSelf(u: AdminUser) {
    return u.id === this.session.currentUserId;
  }
  date(v: string) {
    return new Date(v).toLocaleDateString();
  }
}
