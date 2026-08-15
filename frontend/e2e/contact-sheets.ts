import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Builds a browsable HTML contact sheet plus PNG montages from the visual
// approval evidence in ../final-visual-review (baselines vs candidates).
const REVIEW = path.resolve('final-visual-review');
const HTMLS = {
  candidates: 'contact-sheet-candidates.html',
  baselines: 'contact-sheet-baselines.html',
  'side-by-side': 'contact-sheet-side-by-side.html',
};

function rowFor(base: string): string {
  const label = base
    .replace(/^preview-/, '')
    .replace(/-navy$/, '')
    .replace(/-/g, ' ');
  return `<div class="cell"><img src="candidates/${base}.png" alt="${base}"><p>${label}</p></div>`;
}

function pageShell(title: string, cells: string[], mode: 'single' | 'side'): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font: 12px/1.4 system-ui, sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(5, minmax(180px, 1fr)); gap: 14px; }
  .cell { border: 1px solid #ddd; background: #fff; padding: 6px; border-radius: 4px; }
  .cell p { margin: 6px 0 2px; font-weight: 600; text-align: center; }
  .cell img { width: 100%; height: auto; display: block; border: 1px solid #eee; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pair .tag { text-align: center; font-weight: 400; color: #666; font-size: 11px; }
  .pair img { width: 100%; height: auto; border: 1px solid #eee; }
</style></head>
<body>
<h1>${title}</h1>
<p class="sub">${mode === 'side' ? 'Left: committed baseline &mdash; Right: current candidate' : 'Generated from the visual-regression failure artifacts'}</p>
<div class="grid">${cells.join('\n')}</div>
</body></html>`;
}

async function main(): Promise<void> {
  const candidates = fs.readdirSync(path.join(REVIEW, 'candidates')).filter((f) => f.endsWith('.png'));
  candidates.sort();
  const bases = candidates.map((f) => f.replace(/\.png$/, ''));

  const singleCells = bases.map((b) => rowFor(b));
  const sideCells = bases.map(
    (b) => `<div class="cell">
  <div class="pair">
    <div><img src="baselines/${b}.png" alt=""><p class="tag">baseline</p></div>
    <div><img src="candidates/${b}.png" alt=""><p class="tag">candidate</p></div>
  </div>
  <p>${b.replace(/^preview-/, '').replace(/-navy$/, '')}</p>
</div>`,
  );

  for (const [key, file] of Object.entries(HTMLS)) {
    const title =
      key === 'candidates'
        ? 'Current candidates (28)'
        : key === 'baselines'
          ? 'Committed baselines (28)'
          : 'Baseline vs candidate, side by side (28)';
    fs.writeFileSync(
      path.join(REVIEW, file),
      pageShell(title, key === 'side-by-side' ? sideCells : singleCells, key === 'side-by-side' ? 'side' : 'single'),
      'utf8',
    );
    console.log(`wrote ${file}`);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  for (const file of Object.values(HTMLS)) {
    await page.goto(`file://${path.join(REVIEW, file).replace(/\\/g, '/')}`);
    await page.waitForFunction(() => {
      const imgs = Array.from(document.images);
      return imgs.every((img) => img.complete && img.naturalWidth > 0);
    });
    const png = file.replace(/\.html$/, '.png');
    await page.screenshot({ path: path.join(REVIEW, png), fullPage: true });
    console.log(`wrote ${png}`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});