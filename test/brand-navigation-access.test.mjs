import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Task 2: Navbar.tsx reflects official FNVAC branding, colors, and active states', () => {
  const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.tsx');
  assert.ok(fs.existsSync(navbarPath), 'Navbar.tsx must exist');
  const content = fs.readFileSync(navbarPath, 'utf8');

  // 1. Logo image replaces generic icon
  assert.ok(
    content.includes('<img') &&
    content.includes('src="/logo-fnvac.png"') &&
    content.includes('alt="Fundación Nutrición y Vida A.C."') &&
    content.includes('h-10 sm:h-12 w-auto object-contain'),
    'Navbar must render official FNVAC logo'
  );

  // 2. Active nav links use fnvac-blue palette
  assert.ok(
    content.includes('bg-fnvac-blue-50 text-fnvac-blue-800'),
    'Active nav link must use bg-fnvac-blue-50 text-fnvac-blue-800'
  );
  assert.ok(
    content.includes('text-fnvac-blue-600'),
    'Active nav icon must use text-fnvac-blue-600'
  );

  // 3. Brand hover text
  assert.ok(
    content.includes('group-hover:text-fnvac-blue-700'),
    'Brand title hover must use group-hover:text-fnvac-blue-700'
  );

  // 4. Login button styles
  assert.ok(
    content.includes('bg-fnvac-blue-50 text-fnvac-blue-700 hover:bg-fnvac-blue-100 border border-fnvac-blue-200'),
    'Desktop login button must use fnvac-blue soft palette'
  );
  assert.ok(
    content.includes('bg-fnvac-blue-600 text-white hover:bg-fnvac-blue-700'),
    'Mobile login button must use fnvac-blue-600 button palette'
  );

  // 5. Preserves emerald ping on Bodega Activa indicator
  assert.ok(
    content.includes('bg-emerald-400') && content.includes('bg-emerald-500'),
    'Bodega Activa indicator must preserve emerald ping for active hardware/local state'
  );
});

test('Task 2: login/page.tsx reflects official FNVAC branding, focus rings, and demo cards', () => {
  const loginPath = path.join(rootDir, 'src', 'app', 'login', 'page.tsx');
  assert.ok(fs.existsSync(loginPath), 'login/page.tsx must exist');
  const content = fs.readFileSync(loginPath, 'utf8');

  // 1. Institutional header logo
  assert.ok(
    content.includes('<img') &&
    content.includes('src="/logo-fnvac.png"') &&
    content.includes('alt="Fundación Nutrición y Vida A.C."') &&
    content.includes('h-16 w-auto mx-auto object-contain'),
    'Login page header must render official FNVAC logo image'
  );

  // 2. Inputs focus ring
  assert.ok(
    content.includes('focus:ring-fnvac-blue-600 focus:border-fnvac-blue-600'),
    'Username and password inputs must use focus:ring-fnvac-blue-600 focus:border-fnvac-blue-600'
  );

  // 3. Submit button
  assert.ok(
    content.includes('bg-fnvac-blue-600') && content.includes('hover:bg-fnvac-blue-700') && content.includes('shadow-md shadow-fnvac-blue-600/25'),
    'Submit button must use bg-fnvac-blue-600 hover:bg-fnvac-blue-700 shadow-md shadow-fnvac-blue-600/25'
  );

  // 4. Coordinador demo button
  assert.ok(
    content.includes('border-fnvac-blue-200 bg-fnvac-blue-50/60 hover:bg-fnvac-blue-100/70 text-fnvac-blue-950'),
    'Coordinador card must use fnvac-blue border, background, and text tokens'
  );
  assert.ok(
    content.includes('text-fnvac-blue-700') && content.includes('text-fnvac-blue-800'),
    'Coordinador card must use text-fnvac-blue-700 and text-fnvac-blue-800 for icons/labels'
  );
});

test('Task 2: DriverManifestModal.tsx reflects official FNVAC branding and print sheet headers', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'DriverManifestModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'DriverManifestModal.tsx must exist');
  const content = fs.readFileSync(modalPath, 'utf8');

  // 1. Modal view top bar includes official logo
  assert.ok(
    content.includes('src="/logo-fnvac.png"') &&
    content.includes('alt="FNVAC"'),
    'DriverManifestModal must render official logo'
  );

  // 2. Printable sheet #driver-manifest-sheet includes official logo
  const sheetIndex = content.indexOf('id="driver-manifest-sheet"');
  assert.ok(sheetIndex > 0, '#driver-manifest-sheet must exist');
  const sheetContent = content.slice(sheetIndex);
  assert.ok(
    sheetContent.includes('<img src="/logo-fnvac.png" alt="FNVAC"'),
    'Printable manifest sheet must contain FNVAC logo image'
  );

  // 3. Buttons & headers in fnvac-blue
  assert.ok(
    content.includes('bg-fnvac-blue-600 hover:bg-fnvac-blue-700'),
    'Print action button must use bg-fnvac-blue-600 hover:bg-fnvac-blue-700'
  );
  assert.ok(
    sheetContent.includes('text-fnvac-blue-800'),
    'Folio and subtitle in sheet must use text-fnvac-blue-800'
  );

  // 4. FEFO critical / cold chain alerts remain in amber
  assert.ok(
    content.includes('bg-amber-50 border-2 border-amber-500 text-amber-950'),
    'Cold chain critical warning banner must stay amber'
  );
});