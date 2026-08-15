import { chromium, Browser } from 'playwright';
import { renderResumeHtml } from '../src/app/core/templates/resume-template-renderer';
import { buildDefinitions, LAYOUT_ORDER, THEMES } from '../src/app/core/templates/template-catalogue';
import { ColorThemeId, LayoutFamilyId } from '../src/app/core/models/template-definition.model';
import { sampleContent } from './shared/sample-content';
import * as path from 'path';
import * as fs from 'fs';

const THUMBNAIL_DIR = path.join(__dirname, '..', 'public', 'template-thumbnails');

const VIEWPORT_WIDTH = 794;
const VIEWPORT_HEIGHT = 1123;

function parseArgs(argv: string[]): { families: string[]; themes: string[] } {
  const families: string[] = [];
  const themes: string[] = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--family' && argv[i + 1]) {
      families.push(argv[i + 1]);
      i += 1;
    } else if (arg === '--theme' && argv[i + 1]) {
      themes.push(argv[i + 1]);
      i += 1;
    }
  }
  return { families, themes };
}

function expectedDefinitions(families: string[], themes: string[]) {
  const familyFilter = families.length ? new Set(families) : null;
  const themeFilter = themes.length ? new Set(themes) : null;
  return LAYOUT_ORDER.filter((f) => !familyFilter || familyFilter.has(f))
    .flatMap((f) =>
      THEMES.filter((t) => !themeFilter || themeFilter.has(t)).map((t) => ({ family: f, theme: t })),
    );
}

function pngSignatureValid(buffer: Buffer): boolean {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > 24 && buffer.subarray(0, 8).equals(sig);
}

function validateThumbnails(combos: { family: LayoutFamilyId; theme: ColorThemeId }[]): void {
  const expectedIds = combos.map((c) => `t-${c.family}-${c.theme}`);
  const errors: string[] = [];

  const byId = new Map<string, string>();
  for (const def of buildDefinitions()) {
    if (byId.has(def.id)) {
      errors.push(`Duplicate template ID: ${def.id}`);
    }
    byId.set(def.id, def.id);
  }

  for (const id of expectedIds) {
    const filepath = path.join(THUMBNAIL_DIR, `${id}.png`);
    if (!fs.existsSync(filepath)) {
      errors.push(`Missing thumbnail: ${id}.png`);
      continue;
    }
    const buffer = fs.readFileSync(filepath);
    if (buffer.length === 0) {
      errors.push(`Blank thumbnail: ${id}.png (0 bytes)`);
    } else if (!pngSignatureValid(buffer)) {
      errors.push(`Undecodable thumbnail (bad PNG header): ${id}.png`);
    }
  }

  const files = fs.readdirSync(THUMBNAIL_DIR).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    if (!expectedIds.some((id) => `${id}.png` === file)) {
      errors.push(`Unexpected thumbnail file: ${file}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Thumbnail validation FAILED with ${errors.length} error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`Thumbnail validation passed (${expectedIds.length} expected, all present/decodable).`);
}

async function main(): Promise<void> {
  const { families, themes } = parseArgs(process.argv);
  const combos = expectedDefinitions(families, themes);

  if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
  }

  const browser: Browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
  });

  const defsById = new Map(buildDefinitions().map((d) => [d.id, d]));

  for (const combo of combos) {
    const id = `t-${combo.family}-${combo.theme}`;
    const def = defsById.get(id);
    if (!def) {
      console.error(`Definition missing for ${id}`);
      process.exit(1);
    }
    const html = renderResumeHtml(sampleContent, def);
    const filepath = path.join(THUMBNAIL_DIR, `${id}.png`);

    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: filepath, fullPage: true });
    await page.close();
    console.log(`Thumbnail saved: ${id}.png`);
  }

  await browser.close();

  validateThumbnails(combos);
  const total = combos.length;
  console.log(
    `Done. ${total} thumbnail(s) generated for ${families.length} family filter(s) and ${themes.length} theme filter(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
