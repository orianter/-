import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  { file: 'client/src/data/content.js', includes: ['AI_DISCLAIMER', 'לא הבטחה', 'OpenAI'] },
  { file: 'client/src/components/AiDisclaimer.jsx', includes: ['role="note"', 'aria-label'] },
  { file: 'client/src/components/Layout.jsx', includes: ['skip-link', 'main-content', 'aria-label'] },
  { file: 'client/src/components/FAQ.jsx', includes: ['aria-expanded', 'aria-controls'] },
  { file: 'client/src/pages/AnalyzePage.jsx', includes: ['AiDisclaimer', 'role="status"', 'aria-live'] },
  { file: 'client/src/pages/HomePage.jsx', includes: ['ai-disclaimer', 'לא הבטחת'] },
  { file: 'client/src/styles/global.css', includes: ['skip-link', 'focus-visible', 'visually-hidden'] },
  { file: 'client/index.html', includes: ['lang="he"', 'dir="rtl"', 'לא הבטח'] },
];

let passed = 0;

for (const check of checks) {
  const path = join(root, check.file);
  const content = readFileSync(path, 'utf8');
  for (const needle of check.includes) {
    if (!content.includes(needle)) {
      console.error(`✗ ${check.file}: missing "${needle}"`);
      process.exit(1);
    }
  }
  passed += 1;
  console.log(`✓ ${check.file}`);
}

console.log(`\nAll ${passed} site quality checks passed.`);
