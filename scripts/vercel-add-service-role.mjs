import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.setup');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing in .env.setup');
  process.exit(1);
}

for (const target of ['production', 'preview', 'development']) {
  console.log(`→ Adding SUPABASE_SERVICE_ROLE_KEY to ${target}...`);
  execSync(
    `npx vercel env add SUPABASE_SERVICE_ROLE_KEY ${target}`,
    {
      cwd: root,
      input: key,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    },
  );
}

console.log('→ Redeploying production...');
execSync('npx vercel deploy --prod --yes', { cwd: root, stdio: 'inherit', shell: true });
console.log('✓ Done');
