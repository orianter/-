import fs from 'fs';
import path from 'path';
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

const res = await fetch('https://api.supabase.com/v1/projects/hgfyokwxcvuufzskvloi/api-keys', {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});
const keys = await res.json();
const service = keys.find((k) => k.name === 'service_role');
if (!service?.api_key) {
  console.error('Could not fetch service_role key:', res.status);
  process.exit(1);
}

let setup = fs.readFileSync(envPath, 'utf8');
if (setup.match(/SUPABASE_SERVICE_ROLE_KEY=.+/)) {
  setup = setup.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SERVICE_ROLE_KEY=${service.api_key}`);
} else {
  setup = `${setup.trim()}\nSUPABASE_SERVICE_ROLE_KEY=${service.api_key}\n`;
}
fs.writeFileSync(envPath, setup);
console.log('✓ SUPABASE_SERVICE_ROLE_KEY saved to .env.setup');
console.log('Add the same value to Vercel → SUPABASE_SERVICE_ROLE_KEY → Redeploy');
