import { Observable } from 'rxjs';
import { TemplateRepository } from '../template.repository';
import { ResumeTemplate } from '../../models/analysis.model';
import { MockStore, mockResponse } from './mock-store';
import { fixtures } from './fixtures';

export class MockTemplateRepository implements TemplateRepository {
  private key = 'templates';

  list(): Observable<ResumeTemplate[]> {
    const templates = MockStore.read(this.key, fixtures.templates);
    return mockResponse(templates);
  }

  get(id: string): Observable<ResumeTemplate | null> {
    const templates = MockStore.read(this.key, fixtures.templates);
    return mockResponse(templates.find((t) => t.id === id) ?? null);
  }
}
