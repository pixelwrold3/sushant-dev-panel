import assert from 'assert';
import path from 'path';
import { resolveWorkspacePath, getWorkspaceBaseDir } from '../lib/filesystem/workspace';
import { checkRequest } from '../lib/security/rateLimiter';
import { hasPermission } from '../lib/auth/rbac';
import { getDatabase, saveDatabase } from '../lib/database/db';

console.log('\n======================================================');
console.log('  RUNNING DEVPANEL SECURITY & SUITE TEST RUNNER');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

// 1. Path Traversal & Escape Prevention Tests
runTest('Path Traversal: blocks ../../etc/passwd attempt', () => {
  assert.throws(
    () => {
      resolveWorkspacePath('main-website', '../../etc/passwd');
    },
    /Security Violation|outside workspace/
  );
});

runTest('Path Traversal: blocks absolute path escape /etc/passwd', () => {
  assert.throws(
    () => {
      resolveWorkspacePath('main-website', '/etc/passwd');
    },
    /Security Violation|outside workspace/
  );
});

runTest('Path Traversal: blocks ../.env secret leakage', () => {
  assert.throws(
    () => {
      resolveWorkspacePath('main-website', '../.env');
    },
    /Security Violation|outside workspace/
  );
});

runTest('Workspace Sanitization: blocks malicious workspace id (traversal)', () => {
  assert.throws(
    () => {
      resolveWorkspacePath('..', 'file.txt');
    },
    /Invalid workspace identifier/
  );
});

// 2. Authorization / RBAC Tests
runTest('RBAC: DEVELOPER is barred from server actions (service restart)', () => {
  const allowed = hasPermission('DEVELOPER', 'server_actions');
  assert.strictEqual(allowed, false, 'DEVELOPER should not have server_actions permission');
});

runTest('RBAC: DEVELOPER is barred from managing security rules', () => {
  const allowed = hasPermission('DEVELOPER', 'manage_security');
  assert.strictEqual(allowed, false, 'DEVELOPER should not have manage_security permission');
});

runTest('RBAC: DEVELOPER has code edit and git commit permission', () => {
  assert.strictEqual(hasPermission('DEVELOPER', 'edit_code'), true);
  assert.strictEqual(hasPermission('DEVELOPER', 'git_commit_push'), true);
});

runTest('RBAC: VIEWER has read-only access (no edit, no terminal)', () => {
  assert.strictEqual(hasPermission('VIEWER', 'view_code'), true);
  assert.strictEqual(hasPermission('VIEWER', 'edit_code'), false);
  assert.strictEqual(hasPermission('VIEWER', 'use_terminal'), false);
  assert.strictEqual(hasPermission('VIEWER', 'git_commit_push'), false);
});

runTest('RBAC: OWNER has full permissions', () => {
  assert.strictEqual(hasPermission('OWNER', 'server_actions'), true);
  assert.strictEqual(hasPermission('OWNER', 'manage_security'), true);
  assert.strictEqual(hasPermission('OWNER', 'deploy'), true);
});

// 3. Rate Limiting & IP Blocking Tests
runTest('Rate Limiter: allows normal traffic within threshold', () => {
  const testIp = '198.51.100.22';
  const result = checkRequest(testIp, 'GET', '/api/test');
  assert.strictEqual(result.allowed, true);
});

runTest('Rate Limiter: drops and blocks IP when threshold is exceeded', () => {
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const db = getDatabase();
  // Clear any leftover record for this test IP
  db.ipRecords = db.ipRecords.filter(r => r.ip !== testIp);

  // Add tight test rule
  db.securityRules.unshift({
    id: `test_rule_${Date.now()}`,
    name: 'Unit Test Strict Rule',
    route: '/api/test-flood',
    method: 'ALL',
    threshold: 3,
    windowSeconds: 60,
    action: 'block',
    blockDurationMinutes: 10,
    enabled: true,
    createdAt: new Date().toISOString(),
  });

  // Make 3 requests (all allowed)
  assert.strictEqual(checkRequest(testIp, 'GET', '/api/test-flood').allowed, true);
  assert.strictEqual(checkRequest(testIp, 'GET', '/api/test-flood').allowed, true);
  const third = checkRequest(testIp, 'GET', '/api/test-flood');
  assert.strictEqual(third.allowed, true);

  // 4th request exceeds threshold -> BLOCKED
  const fourth = checkRequest(testIp, 'GET', '/api/test-flood');
  assert.strictEqual(fourth.allowed, false, '4th request must be blocked');

  // Verify IP is recorded in blocklist
  const ipRec = db.ipRecords.find(r => r.ip === testIp && r.status === 'active');
  assert.ok(ipRec, 'IP must be registered as active block in db');
});

runTest('Allowlist: whitelisted IP always bypasses blocking', () => {
  const trustedIp = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
  const db = getDatabase();
  db.ipRecords = db.ipRecords.filter(r => r.ip !== trustedIp);
  db.ipRecords.push({
    id: `ip_trusted_${Date.now()}`,
    ip: trustedIp,
    type: 'allowlist',
    reason: 'Trusted test station',
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  const res = checkRequest(trustedIp, 'GET', '/api/test-flood');
  assert.strictEqual(res.allowed, true, 'Whitelisted IP must be allowed');
});

console.log('\n------------------------------------------------------');
console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
