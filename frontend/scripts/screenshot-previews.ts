import { chromium } from 'playwright';
import { LAYOUT_ORDER } from '../src/app/core/templates/template-catalogue';
import { renderResumeHtml } from '../src/app/core/templates/resume-template-renderer';
import { buildDefinitions } from '../src/app/core/templates/template-catalogue';
import { sampleContent, sparseContent, longContent } from './shared/sample-content';
import { ResumeContent } from '../src/app/core/models/resume.model';
import * as path from 'path';
import * as fs from 'fs';

const PREVIEW_DIR = path.join(__dirname, '..', 'previews');
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

const CONTENT_VARIANTS: Record<string, ResumeContent> = {
  sample: sampleContent,
  long: longContent,
  sparse: sparseContent,
};

async function main(): Promise<void> {
  const contentArg = process.argv.indexOf('--content');
  const variant = contentArg >= 0 ? process.argv[contentArg + 1] ?? 'sample' : 'sample';
  const content = CONTENT_VARIANTS[variant];
  if (!content) {
    console.error(`Unknown --content value: ${variant} (expected sample|long|sparse)`);
    process.exit(1);
  }
  const suffix = variant === 'sample' ? '' : `-${variant}`;

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 816, height: 1056 },
    deviceScaleFactor: 1,
  });

  const defsById = new Map(buildDefinitions().map((d) => [d.id, d]));

  let count = 0;
  for (const family of LAYOUT_ORDER) {
    const def = defsById.get(`t-${family}-navy`);
    const htmlFile = path.join(PREVIEW_DIR, `preview-${family}-navy.html`);
    const screenshotPath = path.join(SCREENSHOT_DIR, `preview-${family}-navy${suffix}.png`);

    const page = await context.newPage();
    if (variant === 'sample' && def) {
      await page.goto(`file://${htmlFile}`, { waitUntil: 'networkidle' });
    } else if (def) {
      await page.setContent(renderResumeHtml(content, def), { waitUntil: 'networkidle' });
    } else {
      console.error(`Definition missing for t-${family}-navy`);
      process.exit(1);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
    count += 1;
    console.log(`Screenshot saved: ${screenshotPath}`);
  }

  await browser.close();
  console.log(`Done. ${count} screenshots generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
