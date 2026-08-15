/**
 * Regenerates root/shared/ats-template-catalogue.ts from the canonical frontend
 * template catalogue. The generated file is the single source of truth for the
 * ATS-facing fields (isAtsFriendly / isVisual / columnCount) consumed by the
 * backend engine, so backend code and tests never import frontend source.
 *
 * Run from the backend directory:
 *   npx tsx scripts/generate-ats-template-catalogue.ts          # write file
 *   npx tsx scripts/generate-ats-template-catalogue.ts --check  # verify drift-free
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildDefinitions } from '../../frontend/src/app/core/templates/template-catalogue';

const outPath = resolve(__dirname, '../../shared/ats-template-catalogue.ts');
mkdirSync(dirname(outPath), { recursive: true });

const profiles = buildDefinitions().map((d) => ({
  id: d.id,
  isAtsFriendly: d.isAtsFriendly,
  isVisual: d.isVisual,
  columnCount: d.columnCount,
}));

const rows = profiles
  .map(
    (p) =>
      `  { id: '${p.id}', isAtsFriendly: ${p.isAtsFriendly}, isVisual: ${p.isVisual}, columnCount: ${p.columnCount} },`
  )
  .join('\n');

const output = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * ATS-relevant template metadata shared by every package. Generated from the',
  ' * canonical frontend template catalogue by running',
  ' * `npx tsx scripts/generate-ats-template-catalogue.ts` in the backend directory.',
  ' */',
  '',
  'export interface TemplateAtsProfile {',
  '  id: string;',
  '  isAtsFriendly: boolean;',
  '  isVisual: boolean;',
  '  columnCount: number;',
  '}',
  '',
  `export const ATS_TEMPLATE_PROFILES: readonly TemplateAtsProfile[] = [\n${rows}\n];`,
  '',
  `export const DEFAULT_ATS_TEMPLATE_ID = 't-classic-ats-navy';`,
  '',
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const drift = !existsSync(outPath) || readFileSync(outPath, 'utf8') !== output;
  if (drift) {
    console.error(
      `[catalogue] DRIFT: ${outPath} does not match the frontend catalogue ` +
        `(${profiles.length} profiles). Run ` +
        '`npm run catalogue:generate` to regenerate.'
    );
    process.exit(1);
  }
  console.log(
    `[catalogue] OK: checked-in file matches the frontend catalogue (${profiles.length} profiles).`
  );
} else {
  writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote ${profiles.length} profiles to ${outPath}`);
}
