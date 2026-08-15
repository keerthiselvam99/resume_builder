import { Observable, of } from 'rxjs';
import { SuggestionRepository } from '../suggestion.repository';
import { Suggestion, SuggestionDecision } from '../../models/suggestion.model';
import { MockStore, mockResponse } from './mock-store';
import { fixtures } from './fixtures';

export class MockSuggestionRepository implements SuggestionRepository {
  private key = 'suggestions';

  list(versionId: string): Observable<Suggestion[]> {
    const all = MockStore.read<Suggestion[]>(this.key, []);
    return mockResponse(all.filter((s) => s.versionId === versionId));
  }

  improveSummary(versionId: string, text: string): Observable<Suggestion> {
    const improved = text.trim()
      ? `${text.trim().replace(/[.\s]+$/, '')}. Proven track record of delivering measurable impact in cross-functional teams.`
      : 'Experienced professional focused on delivering high-quality results through strong technical and collaborative skills.';
    return this.push({
      versionId,
      type: 'summary',
      original: text,
      suggested: improved,
      rationale: 'Adds a measurable-impact clause and strengthens the opening.',
    });
  }

  improveBullet(versionId: string, text: string): Observable<Suggestion> {
    const verb = pickFirst(/^(developed|built|designed|implemented|led|improved|created)/i, text);
    const suggestion = text.trim()
      ? `${capitalize(verb || 'developed')} ${text
          .replace(
            /^(developed|built|designed|implemented|led|improved|created|worked on|responsible for)\s*/i,
            '',
          )
          .trim()
          .replace(/[.\s]+$/, '')} using modern tools and engineering best practices.`
      : 'Describe what you built, the technology used, and the measurable outcome.';
    return this.push({
      versionId,
      type: 'bullet',
      original: text,
      suggested: suggestion,
      rationale: 'Converts the bullet into an achievement-oriented statement with an action verb.',
    });
  }

  tailorForJob(versionId: string, jobDescriptionId: string): Observable<Suggestion[]> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const jds = MockStore.read(this.jdKey, fixtures.jobDescriptions);
    const version = versions.find((v) => v.id === versionId);
    const jd = jds.find((j) => j.id === jobDescriptionId);
    if (!version || !jd) {
      return of([]);
    }
    const keywords = extractKeywords(jd.content);
    const summary = version.content.summary;
    const suggestions: Suggestion[] = [];
    for (const kw of keywords) {
      if (summary && !summary.toLowerCase().includes(kw.toLowerCase())) {
        suggestions.push({
          id: MockStore.generateId(),
          versionId,
          type: 'tailoring',
          original: summary,
          suggested: `${summary.replace(/[.\s]+$/, '')}, with hands-on ${kw} experience.`,
          rationale: `Tailors the summary toward "${kw}", which appears in the job description.`,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        break;
      }
    }
    return this.pushAll(suggestions);
  }

  decide(id: string, decision: SuggestionDecision): Observable<Suggestion> {
    const all = MockStore.read<Suggestion[]>(this.key, []);
    const target = all.find((s) => s.id === id);
    if (!target) {
      return mockResponse({} as Suggestion);
    }
    const updated = { ...target, status: decision.status };
    MockStore.write(
      this.key,
      all.map((s) => (s.id === id ? updated : s)),
    );
    return mockResponse(updated);
  }

  generateInterviewQuestions(versionId: string): Observable<string[]> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const version = versions.find((v) => v.id === versionId);
    if (!version) {
      return mockResponse([]);
    }
    const topics = [
      ...version.content.skills.slice(0, 3),
      ...version.content.projects.map((p) => p.name).slice(0, 2),
    ];
    return mockResponse(
      topics.map(
        (t) =>
          `You mentioned "${t}". Can you walk through a specific challenge you faced and how you solved it?`,
      ),
    );
  }

  private versionsKey = 'versions';
  private jdKey = 'jobDescriptions';

  private push(s: Omit<Suggestion, 'id' | 'status' | 'createdAt'>): Observable<Suggestion> {
    const suggestion: Suggestion = {
      ...s,
      id: MockStore.generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const all = MockStore.read<Suggestion[]>(this.key, []);
    MockStore.write(this.key, [...all, suggestion]);
    return mockResponse(suggestion);
  }

  private pushAll(
    suggestions: Omit<Suggestion, 'status' | 'createdAt'>[],
  ): Observable<Suggestion[]> {
    const all = MockStore.read<Suggestion[]>(this.key, []);
    const created: Suggestion[] = suggestions.map((s) => ({
      ...s,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));
    MockStore.write(this.key, [...all, ...created]);
    return mockResponse(created);
  }
}

function pickFirst(pattern: RegExp, text: string): string | null {
  const match = text.match(pattern);
  return match ? match[0] : null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractKeywords(text: string, limit = 6): string[] {
  const common = new Set([
    'and',
    'the',
    'with',
    'for',
    'experience',
    'years',
    'ability',
    'strong',
    'good',
    'working',
    'using',
  ]);
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.]+/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    if (common.has(w) || w.length < 3) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}
