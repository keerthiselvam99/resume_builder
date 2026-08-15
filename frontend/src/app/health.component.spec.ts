import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HealthComponent } from './health.component';

describe('HealthComponent', () => {
  let fixture: ComponentFixture<HealthComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows database up status from the health endpoint', async () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/health');
    req.flush({ app: 'ok', database: 'up', timestamp: new Date().toISOString(), version: '0.1.0' });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Database: up');
  });

  it('shows database down status from the health endpoint', async () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/health');
    req.flush({
      app: 'ok',
      database: 'down',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Database: down');
  });
});
