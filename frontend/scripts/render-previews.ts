import { renderResumeHtml } from '../src/app/core/templates/resume-template-renderer';
import { buildDefinitions } from '../src/app/core/templates/template-catalogue';
import { sampleContent, sparseContent } from './shared/sample-content';
import * as fs from 'fs';
import * as path from 'path';

const PREVIEW_DIR = path.join(__dirname, '..', 'previews');

if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

const definitions = buildDefinitions();

for (const def of definitions) {
  const html = renderResumeHtml(sampleContent, def);
  const filename = `preview-${def.layoutFamily}-${def.colorTheme}.html`;
  const filepath = path.join(PREVIEW_DIR, filename);
  fs.writeFileSync(filepath, html, 'utf-8');
  console.log(`Wrote ${filepath} (${html.length} bytes)`);
}

// Sparse-content previews (one per layout family) for empty/partial checks.
const seenFamilies = new Set<string>();
for (const def of definitions) {
  if (seenFamilies.has(def.layoutFamily)) {
    continue;
  }
  seenFamilies.add(def.layoutFamily);
  const html = renderResumeHtml(sparseContent, def);
  const filepath = path.join(PREVIEW_DIR, `sparse-${def.layoutFamily}.html`);
  fs.writeFileSync(filepath, html, 'utf-8');
  console.log(`Wrote ${filepath} (${html.length} bytes)`);
}

console.log(`Done. ${definitions.length} definitions rendered.`);
