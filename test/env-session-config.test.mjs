import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getAuthSecret, SESSION_COOKIE_NAME } from '../src/lib/session.ts';

test('Task 2: .gitignore includes data/*.db and sensitive files', () => {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
  const content = fs.readFileSync(gitignorePath, 'utf8');

  assert.ok(content.includes('/data/*.db'), 'Should ignore /data/*.db');
  assert.ok(content.includes('/data/*.db-wal'), 'Should ignore /data/*.db-wal');
  assert.ok(content.includes('/data/*.sqlite'), 'Should ignore /data/*.sqlite');
  assert.ok(content.includes('.env'), 'Should ignore .env');
  assert.ok(content.includes('.env*.local'), 'Should ignore .env*.local');
});

test('Task 2: .env.example exists and documents AUTH_SECRET and server variables', () => {
  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
  const content = fs.readFileSync(envExamplePath, 'utf8');

  assert.ok(content.includes('AUTH_SECRET='), '.env.example must define AUTH_SECRET');
  assert.ok(content.includes('PORT=3000'), '.env.example must define PORT');
  assert.ok(content.includes('HOSTNAME=0.0.0.0'), '.env.example must define HOSTNAME');
});

test('Task 2: LICENSE exists and contains MIT License with FNVAC copyright', () => {
  const licensePath = path.resolve(process.cwd(), 'LICENSE');
  assert.ok(fs.existsSync(licensePath), 'LICENSE must exist');
  const content = fs.readFileSync(licensePath, 'utf8');

  assert.ok(content.includes('MIT License'), 'LICENSE must specify MIT License');
  assert.ok(
    content.includes('Fundación Nutrición y Vida A.C.'),
    'LICENSE must credit Fundación Nutrición y Vida A.C.'
  );
});

test('Task 2: getAuthSecret returns env AUTH_SECRET or fallback with production warning', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    // 1. Explicit AUTH_SECRET
    process.env.AUTH_SECRET = 'custom-test-secret-12345';
    assert.equal(getAuthSecret(), 'custom-test-secret-12345');

    // 2. Unset AUTH_SECRET in development/test
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'test';
    const fallbackSecret = getAuthSecret();
    assert.equal(fallbackSecret, 'fnvac-dev-secret-key-change-in-production-2026');

    // 3. Unset AUTH_SECRET in production triggers warning
    process.env.NODE_ENV = 'production';
    let warnedMessage = '';
    const originalWarn = console.warn;
    console.warn = (msg) => {
      warnedMessage = msg;
    };
    try {
      const prodFallback = getAuthSecret();
      assert.equal(prodFallback, 'fnvac-dev-secret-key-change-in-production-2026');
      assert.ok(
        warnedMessage.includes('[ADVERTENCIA DE SEGURIDAD]'),
        'Should log security warning in production'
      );
    } finally {
      console.warn = originalWarn;
    }
  } finally {
    if (originalAuthSecret !== undefined) {
      process.env.AUTH_SECRET = originalAuthSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }
});
