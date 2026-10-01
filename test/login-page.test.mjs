import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('UI Component: login/page.tsx exists and contains expected institutional elements', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'login', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'login/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Must be a client component
  assert.ok(content.includes("'use client'"), 'Must be a client component');

  // Must contain institutional branding
  assert.ok(content.includes('Fundación Nutrición y Vida'), 'Must display institution name');
  assert.ok(content.includes('CEDIS Celaya'), 'Must display CEDIS Celaya');

  // Must contain form inputs with accessible labels or placeholders
  assert.ok(content.includes('username') || content.includes('usuario'), 'Must have username field');
  assert.ok(content.includes('password') || content.includes('contraseña'), 'Must have password field');

  // Must have quick demo login buttons for admin and operator
  assert.ok(content.includes('admin'), 'Must have admin demo shortcut');
  assert.ok(content.includes('operador'), 'Must have operador demo shortcut');
});
