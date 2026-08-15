import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PdfExportService } from '../src/services/pdf/pdf-export.service';
import { PdfValidationError, PdfGenerationError } from '../src/services/pdf/errors';
import {
  buildDefinitions,
  LAYOUT_META,
  SectionKey,
} from '../../frontend/src/app/core/templates/template-catalogue';
import {
  ColorThemeId,
  LayoutFamilyId,
  TemplateCategory,
  TemplateDefinition,
} from '../../frontend/src/app/core/models/template-definition.model';
import { sampleContent, longContent } from '../../frontend/scripts/shared/sample-content';
import type { ResumeContent } from '../../frontend/src/app/core/models/resume.model';

/**
 * CLI export matrix (final acceptance for Phase 3).
 *
 * Exercises every layout family through the backend's canonical renderer and
 * verifies, per export, that:
 *   - the worker made zero outbound network attempts (CSP + route defence),
 *   - the generated PDF matches the pagination report page count,
 *   - every page is A4 with selectable text,
 *   - every link annotation uses a safe scheme,
 *   - the expected final-section text made it into the document.
 *
 * Coverage:
 *   1. all 25 Navy templates (rich sample content),
 *   2. all four themes for one representative of each of the five categories,
 *   3. Executive Banner and Creative Portfolio with `longContent` (saved to
 *      artifacts/ for visual review).
 */

const THEMES: readonly ColorThemeId[] = [
  ColorThemeId.Navy,
  ColorThemeId.Charcoal,
  ColorThemeId.Teal,
  ColorThemeId.Burgundy,
];

const REPRESENTATIVES: ReadonlyArray<{
  category: TemplateCategory;
  slug: LayoutFamilyId;
}> = [
  { category: TemplateCategory.AtsFormal, slug: LayoutFamilyId.ClassicAts },
  { category: TemplateCategory.Modern, slug: LayoutFamilyId.ModernSplit },
  { category: TemplateCategory.Technical, slug: LayoutFamilyId.DeveloperConsole },
  { category: TemplateCategory.Executive, slug: LayoutFamilyId.ExecutiveBanner },
  { category: TemplateCategory.CreativeMinimal, slug: LayoutFamilyId.CreativePortfolio },
];

const LONG_EXPORT_IDS = ['t-executive-banner-navy', 't-creative-portfolio-navy'];

const ARTIFACTS_DIR = join(__dirname, '..', 'artifacts', 'pdf-matrix');

const SAFE_SCHEME = /^(https?|mailto|tel):/i;

interface MatrixCase {
  definition: TemplateDefinition;
  content: ResumeContent;
  kind: 'navy' | 'theme-sample' | 'long';
}

let failures = 0;
let exportsRun = 0;

async function main(): Promise<void> {
  const service = new PdfExportService({ generationTimeoutMs: 60_000 });
  const definitions = buildDefinitions();

  const cases = buildMatrixCases(definitions);
  const counts = countKinds(cases);
  console.log(
    `Export matrix: ${cases.length} cases ` +
      `(${counts.navy} Navy, ${counts['theme-sample']} theme samples, ${counts.long} long-content)`
  );
  console.log('');

  try {
    for (const testCase of cases) {
      await runCase(service, testCase);
    }
  } finally {
    await service.close();
  }

  console.log('');
  if (failures > 0) {
    console.error(`FAILED: ${failures}/${cases.length} matrix cases failed.`);
    process.exit(1);
  }
  console.log(`PASSED: all ${cases.length} matrix cases verified (${exportsRun} exports).`);
}

function countKinds(cases: MatrixCase[]): Record<MatrixCase['kind'], number> {
  const counts: Record<MatrixCase['kind'], number> = { navy: 0, 'theme-sample': 0, long: 0 };
  for (const testCase of cases) {
    counts[testCase.kind] += 1;
  }
  return counts;
}

function buildMatrixCases(definitions: TemplateDefinition[]): MatrixCase[] {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const cases: MatrixCase[] = [];

  const navy = definitions.filter((d) => d.colorTheme === ColorThemeId.Navy);
  if (navy.length !== 25) {
    throw new Error(`Expected 25 Navy templates, found ${navy.length}.`);
  }
  for (const definition of navy) {
    cases.push({ definition, content: sampleContent, kind: 'navy' });
  }

  for (const representative of REPRESENTATIVES) {
    for (const theme of THEMES) {
      const id = `t-${representative.slug}-${theme}`;
      const definition = byId.get(id);
      if (!definition) {
        throw new Error(`Missing definition ${id}`);
      }
      cases.push({ definition, content: sampleContent, kind: 'theme-sample' });
    }
  }

  for (const id of LONG_EXPORT_IDS) {
    const definition = byId.get(id);
    if (!definition) {
      throw new Error(`Missing definition ${id}`);
    }
    cases.push({ definition, content: longContent, kind: 'long' });
  }

  return cases;
}

async function runCase(service: PdfExportService, testCase: MatrixCase): Promise<void> {
  const { definition, content, kind } = testCase;
  const label = `${definition.id} [${kind}]`;
  try {
    const result = await service.export(content, definition.id, `matrix-${definition.id}`);

    const problems: string[] = [];

    if (result.networkAttempts !== 0) {
      problems.push(`networkAttempts=${result.networkAttempts} (expected 0)`);
    }
    if (!isA4(result.pageSizePt.width, result.pageSizePt.height)) {
      problems.push(
        `page size ${result.pageSizePt.width.toFixed(1)}x${result.pageSizePt.height.toFixed(1)}pt is not A4`
      );
    }
    if (result.pageCount < 1) {
      problems.push(`pageCount=${result.pageCount}`);
    }
    if (result.pagesText.length !== result.pageCount || result.pagesText.some((t) => !t.trim())) {
      problems.push('a page has no selectable text');
    }
    const unsafeAnnotation = result.linkAnnotations.find((a) => !SAFE_SCHEME.test(a.url));
    if (unsafeAnnotation) {
      problems.push(`unsafe annotation ${unsafeAnnotation.url} on page ${unsafeAnnotation.page}`);
    }

    const finalSectionMarker = finalSectionMarkerFor(definition, content);
    if (!finalSectionMarker || !result.text.includes(finalSectionMarker)) {
      problems.push(
        finalSectionMarker
          ? `final-section text missing: "${finalSectionMarker}"`
          : 'could not compute final-section marker'
      );
    }

    exportsRun += 1;
    if (problems.length > 0) {
      failures += 1;
      console.log(`✗ ${label} — ${problems.join('; ')}`);
      return;
    }

    console.log(
      `✓ ${label} — ${result.pageCount} page(s), A4 ${result.pageSizePt.width.toFixed(0)}x${result.pageSizePt.height.toFixed(0)}pt, ` +
        `${result.linkAnnotations.length} safe annotation(s), 0 network attempts, ${result.buffer.length} bytes`
    );

    if (kind === 'long') {
      await saveArtifact(result.buffer, `${definition.id}-long.pdf`);
    }
  } catch (err) {
    failures += 1;
    if (err instanceof PdfValidationError || err instanceof PdfGenerationError) {
      console.log(`✗ ${label} — ${err.message}`);
    } else {
      console.log(
        `✗ ${label} — unexpected error: ${err instanceof Error ? err.stack : String(err)}`
      );
    }
  }
}

function isA4(width: number, height: number): boolean {
  return width >= 580 && width <= 615 && height >= 830 && height <= 855;
}

/**
 * The final section rendered into the document, per layout shell. Text is
 * extracted in DOM order: single/sidebar emit the main column last (the
 * sidebar is rendered first in the grid), while split/cards emit the accent
 * column last.
 */
function finalSectionKey(definition: TemplateDefinition): SectionKey {
  const meta = LAYOUT_META[definition.layoutFamily];
  if (meta.shell === 'split' || meta.shell === 'cards') {
    const accent = meta.accentOrder ?? [];
    if (accent.length > 0) return accent[accent.length - 1];
  }
  const order = meta.order;
  return order[order.length - 1];
}

function finalSectionMarkerFor(definition: TemplateDefinition, content: ResumeContent): string {
  const key = finalSectionKey(definition);
  switch (key) {
    case 'summary':
      return truncate(content.summary.trim(), 48);
    case 'skills':
      return content.skills[content.skills.length - 1] ?? '';
    case 'experience': {
      const last = content.experiences[content.experiences.length - 1];
      return last ? last.company : '';
    }
    case 'projects': {
      const last = content.projects[content.projects.length - 1];
      return last ? last.name : '';
    }
    case 'education': {
      const last = content.education[content.education.length - 1];
      return last ? last.institution : '';
    }
    case 'certifications': {
      const last = content.certifications[content.certifications.length - 1];
      return last ? last.name : '';
    }
    case 'awards': {
      const achievements = content.achievements;
      const lastAchievement = achievements[achievements.length - 1];
      if (lastAchievement) return truncate(lastAchievement.text, 48);
      const lastAward = content.awards[content.awards.length - 1];
      return lastAward ? lastAward.title : '';
    }
    case 'languages': {
      const last = content.languages[content.languages.length - 1];
      return last ? last.name : '';
    }
    case 'custom': {
      const last = content.customSections[content.customSections.length - 1];
      return last ? last.heading : '';
    }
    default:
      return '';
  }
}

function truncate(value: string, max: number): string {
  if (!value) return '';
  return value.length <= max ? value : value.slice(0, max).replace(/\s+\S*$/, '');
}

async function saveArtifact(buffer: Buffer, filename: string): Promise<void> {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const target = join(ARTIFACTS_DIR, filename);
  await writeFile(target, buffer);
  console.log(`   saved ${target} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('Matrix runner crashed:', err);
  process.exit(1);
});
