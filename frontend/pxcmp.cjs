const { chromium } = require('@playwright/test');
const path = require('path');
const crypto = require('crypto');
const OUT = 'C:\\Users\\Ruban R\\Desktop\\keerthi\\preview-compare';

const pairs = [
  ['create-academic-navy-p1.png', 'template-academic-navy-p1.png'],
  ['create-academic-navy-p2.png', 'template-academic-navy-p2.png'],
  ['create-classic-ats-navy-p1.png', 'template-classic-ats-navy-p1.png'],
  ['create-classic-ats-navy-p2.png', 'template-classic-ats-navy-p2.png'],
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [a, b] of pairs) {
    const r = await page.evaluate(async ([pa, pb]) => {
      async function px(file) {
        const img = new Image();
        img.src = 'file:///' + file.replace(/\\/g, '/');
        await new Promise((res) => { img.onload = res; });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return { w: img.naturalWidth, h: img.naturalHeight, data: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) };
      }
      const A = await px(pa); const B = await px(pb);
      if (A.w !== B.w || A.h !== B.h) return { same: false, reason: 'size', a: [A.w, A.h], b: [B.w, B.h] };
      let diff = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        if (A.data[i] !== B.data[i] || A.data[i+1] !== B.data[i+1] || A.data[i+2] !== B.data[i+2] || A.data[i+3] !== B.data[i+3]) diff += 1;
      }
      return { same: diff === 0, diffPixels: diff, total: A.data.length / 4, a: [A.w, A.h] };
    }, [path.join(OUT, a), path.join(OUT, b)]);
    console.log(`${a} vs ${b}: ${JSON.stringify(r)}`);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });