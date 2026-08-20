import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HTTP_API_CLIENT } from '../../core/repositories/repository.providers';
import { CapturedEmailSummary, DevMailboxComponent } from './dev-mailbox.component';

class FakeApiClient {
  response: Promise<{ messages: CapturedEmailSummary[] }> = Promise.resolve({ messages: [] });
  request() {
    return this.response;
  }
}

const captured: CapturedEmailSummary = {
  id: 'safe-message-id',
  recipient: 'dev@example.com',
  kind: 'verify-email',
  subject: 'Verify your ResumeIQ email',
  createdAt: '2026-08-17T10:00:00.000Z',
  expiresAt: '2026-08-18T10:00:00.000Z',
  hasAction: true,
};

describe('DevMailboxComponent', () => {
  let fixture: ComponentFixture<DevMailboxComponent>;
  let api: FakeApiClient;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DevMailboxComponent],
      providers: [provideRouter([]), { provide: HTTP_API_CLIENT, useClass: FakeApiClient }],
    }).compileComponents();
    api = TestBed.inject(HTTP_API_CLIENT) as unknown as FakeApiClient;
    fixture = TestBed.createComponent(DevMailboxComponent);
    fixture.detectChanges();
  }

  it('shows a loading state while fetching messages', async () => {
    await TestBed.configureTestingModule({
      imports: [DevMailboxComponent],
      providers: [
        provideRouter([]),
        {
          provide: HTTP_API_CLIENT,
          useValue: { request: () => new Promise(() => undefined) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DevMailboxComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading captured emails');
  });

  it('shows the empty mailbox state', async () => {
    await create();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No captured emails yet');
  });

  it('shows a safe error when the mailbox is unavailable', async () => {
    await create();
    api.response = Promise.reject(new Error('Not found'));
    fixture.componentInstance.refresh();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('mailbox is disabled or unavailable');
  });

  it('renders captured metadata and an action without a raw token', async () => {
    await create();
    api.response = Promise.resolve({ messages: [captured] });
    fixture.componentInstance.refresh();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('dev@example.com');
    expect(text).toContain('Email verification');
    expect(text).toContain('Open verification link');
    expect(text).not.toContain('token=');
  });
});
