import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Operador Page RBAC & Shift Isolation: Role adaptive header, myShift fetch, and batch ownership on delete', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'operador', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'operador/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // 1. Session check on mount
  assert.ok(content.includes('/api/auth/me'), 'Must query /api/auth/me for active user session');

  // 2. myShift parameter based on operator role
  assert.ok(content.includes('myShift=true'), 'Must query myShift=true for operator shift isolation');

  // 3. Conditional delete permission checking createdBy
  assert.ok(content.includes('createdBy'), 'Must check batch createdBy for deletion authorization');

  // 4. Logout action available for operators
  assert.ok(content.includes('/api/auth/logout') || content.includes('handleLogout'), 'Must provide logout capability');
});
