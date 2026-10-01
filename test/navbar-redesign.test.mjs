import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Navbar Redesign: Brand overflow protection, operator consolidation and session controls', () => {
  const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.tsx');
  assert.ok(fs.existsSync(navbarPath), 'Navbar.tsx must exist');
  const content = fs.readFileSync(navbarPath, 'utf8');

  // 1. Brand overflow protection: Must have shrink-0 and whitespace-nowrap
  assert.ok(content.includes('shrink-0'), 'Brand container must have shrink-0');
  assert.ok(content.includes('whitespace-nowrap'), 'Institution titles must have whitespace-nowrap to prevent multiline clipping');
  assert.ok(content.includes('Fundación Nutrición y Vida A.C.'), 'Must contain institution title');
  assert.ok(content.includes('CEDIS Celaya'), 'Must contain CEDIS Celaya');

  // 2. Navigation items: Consolidated reception to /operador
  assert.ok(content.includes('href="/operador"') || content.includes("href: '/operador'"), 'NAV_ITEMS must point to /operador');
  assert.ok(content.includes('ScanLine'), 'Must import and use ScanLine icon');

  // 3. User session integration: checks /api/auth/me and includes logout
  assert.ok(content.includes('/api/auth/me'), 'Navbar must check active user session');
  assert.ok(content.includes('/api/auth/logout'), 'Navbar must have logout functionality');
  assert.ok(content.includes('LogOut'), 'Navbar must import LogOut icon');

  // 4. Mobile & Desktop tactile feedback must be preserved
  assert.ok(content.includes('active:scale-[0.97]'), 'Must preserve tactile active:scale-[0.97]');
  assert.ok(content.includes('active:scale-95'), 'Must preserve tactile active:scale-95');
  assert.ok(content.includes('prefetch={true}'), 'Must preserve prefetch={true}');
});
