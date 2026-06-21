import assert from 'node:assert/strict';
import {
  buildIdentityHash,
  extractFingerprint,
  FREE_LIMIT_MESSAGE,
  isFreeUsageDisabled,
  normalizeFingerprint,
  readUsageCookie,
  resolveFreeUsage,
  setUsageCookie,
} from '../api/lib/freeUsage.js';

process.env.FREE_USAGE_DISABLED = '1';
process.env.FREE_USAGE_SECRET = 'test-free-usage-secret';

function mockReq({ fingerprint, ip = '203.0.113.10', cookie } = {}) {
  return {
    headers: {
      'x-device-fingerprint': fingerprint,
      'x-forwarded-for': ip,
      ...(cookie ? { cookie: `ra_free_used=${cookie}` } : {}),
    },
    socket: { remoteAddress: ip },
  };
}

function mockRes() {
  const headers = {};
  return {
    setHeader(key, value) {
      headers[key] = value;
    },
    getHeader(key) {
      return headers[key];
    },
  };
}

async function testNormalizeFingerprint() {
  assert.equal(normalizeFingerprint('not-valid!'), null);
  assert.equal(normalizeFingerprint('short'), null);
  assert.equal(
    normalizeFingerprint('a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01'),
    'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01',
  );
  console.log('✓ normalizeFingerprint');
}

async function testIdentityHashStable() {
  const fp = 'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01';
  const first = buildIdentityHash(fp, '203.0.113.10');
  const second = buildIdentityHash(fp, '203.0.113.10');
  assert.equal(first.identityHash, second.identityHash);
  assert.notEqual(first.identityHash, buildIdentityHash(fp, '203.0.113.11').identityHash);
  console.log('✓ buildIdentityHash');
}

async function testExtractFingerprint() {
  const req = mockReq({ fingerprint: 'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01' });
  assert.equal(
    extractFingerprint(req, {}),
    'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01',
  );
  console.log('✓ extractFingerprint');
}

async function testDisabledAllowsUsage() {
  assert.equal(isFreeUsageDisabled(), true);
  const usage = await resolveFreeUsage(
    mockReq({ fingerprint: 'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01' }),
    {},
  );
  assert.equal(usage.allowed, true);
  assert.equal(usage.freeRemaining, 1);
  console.log('✓ resolveFreeUsage when disabled');
}

async function testMissingFingerprintBlocked() {
  process.env.FREE_USAGE_DISABLED = '0';
  const usage = await resolveFreeUsage(mockReq({ fingerprint: '' }), {});
  assert.equal(usage.allowed, false);
  assert.equal(usage.status, 400);
  process.env.FREE_USAGE_DISABLED = '1';
  console.log('✓ missing fingerprint blocked when enabled');
}

async function testSignedCookieRoundTrip() {
  const fp = 'a1b2c3d4e5f6789012345678abcdef01-12345678abcdef01';
  const { identityHash } = buildIdentityHash(fp, '203.0.113.10');
  const res = mockRes();
  setUsageCookie(res, identityHash);
  const setCookie = res.getHeader('Set-Cookie');
  assert.match(setCookie, /^ra_free_used=/);
  const token = setCookie.split('=')[1].split(';')[0];
  const req = mockReq({ fingerprint: fp, cookie: token });
  assert.equal(readUsageCookie(req), identityHash);
  console.log('✓ signed usage cookie');
}

async function testFreeLimitMessage() {
  assert.match(FREE_LIMIT_MESSAGE, /בחר מסלול/);
  console.log('✓ Hebrew free limit message');
}

async function main() {
  await testNormalizeFingerprint();
  await testIdentityHashStable();
  await testExtractFingerprint();
  await testDisabledAllowsUsage();
  await testMissingFingerprintBlocked();
  await testSignedCookieRoundTrip();
  await testFreeLimitMessage();
  console.log('All free usage tests passed.');
}

main().catch((err) => {
  console.error('Free usage test failed:', err.message);
  process.exit(1);
});
