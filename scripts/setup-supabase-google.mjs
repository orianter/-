/**
 * One-time setup: Google OAuth + Supabase URLs + email usage table check.
 *
 * 1. Copy Google OAuth JSON → project root as google-oauth.json
 * 2. Copy .env.setup.example → .env.setup and fill tokens
 * 3. node scripts/setup-supabase-google.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PROJECT_REF = 'hgfyokwxcvuufzskvloi';
const SITE_URL = 'https://reelzanalyze1.vercel.app';
const REDIRECT_ALLOW = `${SITE_URL}/**`;

function loadEnvSetup() {
  const envPath = path.join(root, '.env.setup');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.setup — copy .env.setup.example and fill values.');
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function loadGoogleOAuth() {
  const jsonPath = path.join(root, 'google-oauth.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('Missing google-oauth.json in project root (download from Google Cloud).');
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const web = data.web || data.installed || data;
  const clientId = web.client_id;
  const clientSecret = web.client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('google-oauth.json must contain client_id and client_secret.');
  }
  return { clientId, clientSecret, redirectUris: web.redirect_uris || [] };
}

async function patchAuthConfig(accessToken, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Auth config failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function runSqlViaManagement(accessToken, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (res.ok) return true;
  console.warn('SQL via API failed:', (await res.text()).slice(0, 200));
  return false;
}

async function tableExists(serviceRoleKey) {
  const res = await fetch(
    `https://${PROJECT_REF}.supabase.co/rest/v1/free_analysis_email_usage?select=email_hash&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  return res.status === 200;
}

async function main() {
  const env = loadEnvSetup();
  const { clientId, clientSecret, redirectUris } = loadGoogleOAuth();
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN missing in .env.setup');
  }

  const expectedRedirect = `https://${PROJECT_REF}.supabase.co/auth/v1/callback`;
  if (!redirectUris.some((u) => u === expectedRedirect)) {
    console.warn(`⚠ google-oauth.json redirect_uris should include:\n  ${expectedRedirect}`);
  }

  console.log('→ Configuring Google provider + URLs in Supabase...');
  await patchAuthConfig(accessToken, {
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: clientSecret,
    site_url: SITE_URL,
    uri_allow_list: REDIRECT_ALLOW,
  });
  console.log('✓ Google OAuth + Site URL + Redirect URLs configured');

  const migrationPath = path.join(root, 'supabase/migrations/20250621120000_free_analysis_email_usage.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const sqlOk = await runSqlViaManagement(accessToken, sql);
  if (sqlOk) {
    console.log('✓ Database migration applied');
  } else if (serviceRoleKey && (await tableExists(serviceRoleKey))) {
    console.log('✓ Database table already exists');
  } else {
    console.log('⚠ Run SQL manually in Supabase SQL Editor:');
    console.log('  supabase/migrations/20250621120000_free_analysis_email_usage.sql');
  }

  if (!serviceRoleKey) {
    console.log('\n⚠ Add SUPABASE_SERVICE_ROLE_KEY to .env.setup and Vercel Environment Variables.');
  } else {
    console.log('\n→ Add the same SUPABASE_SERVICE_ROLE_KEY to Vercel → Redeploy.');
  }

  console.log('\nTest: https://reelzanalyze1.vercel.app/analyze → המשך עם Google');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
