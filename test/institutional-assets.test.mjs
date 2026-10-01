import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Institutional Assets: public/logo-fnvac.png exists and is a valid PNG file', () => {
  const logoPath = path.join(projectRoot, 'public', 'logo-fnvac.png');
  assert.ok(fs.existsSync(logoPath), 'public/logo-fnvac.png should exist');
  
  const stats = fs.statSync(logoPath);
  assert.ok(stats.size > 1000, 'Logo file size should be substantial (> 1KB)');

  const buffer = fs.readFileSync(logoPath);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buffer.subarray(0, 8).equals(pngHeader), 'File must be a valid PNG');
});

test('Tailwind Config: includes complete fnvac.blue and fnvac.red palette and fefo tokens', () => {
  const tailwindPath = path.join(projectRoot, 'tailwind.config.ts');
  assert.ok(fs.existsSync(tailwindPath));
  const content = fs.readFileSync(tailwindPath, 'utf-8');

  assert.ok(content.includes("'#136793'"), 'Official FNVAC blue (#136793) must be defined');
  assert.ok(content.includes("'#f0f7fb'"), 'Blue-50 must be defined');
  assert.ok(content.includes("'#051e2d'"), 'Blue-950 must be defined');

  assert.ok(content.includes("'#d21e27'"), 'Official FNVAC red (#d21e27) must be defined');
  assert.ok(content.includes("'#fef2f2'"), 'Red-50 must be defined');
  assert.ok(content.includes("'#45070a'"), 'Red-950 must be defined');

  assert.ok(content.includes("'#ef4444'"), 'fefo red must be defined');
  assert.ok(content.includes("'#eab308'"), 'fefo yellow must be defined');
  assert.ok(content.includes("'#22c55e'"), 'fefo green must be defined');
  assert.ok(content.includes("'#6b7280'"), 'fefo gray must be defined');
});

test('Root Layout: applies institutional text selection colors', () => {
  const layoutPath = path.join(projectRoot, 'src', 'app', 'layout.tsx');
  assert.ok(fs.existsSync(layoutPath));
  const content = fs.readFileSync(layoutPath, 'utf-8');

  assert.ok(
    content.includes('selection:bg-fnvac-blue-100 selection:text-fnvac-blue-900'),
    'Root layout must use fnvac-blue selection tokens'
  );
  assert.ok(
    !content.includes('selection:bg-emerald-100'),
    'Previous emerald selection colors must be replaced'
  );
});

test('Global CSS: defines institutional CSS variables and laser sweep styling', () => {
  const cssPath = path.join(projectRoot, 'src', 'app', 'globals.css');
  assert.ok(fs.existsSync(cssPath));
  const content = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(content.includes('--fnvac-blue: #136793;'), 'CSS variable --fnvac-blue must be defined');
  assert.ok(content.includes('--fnvac-red: #d21e27;'), 'CSS variable --fnvac-red must be defined');
  assert.ok(content.includes('.animate-laser-sweep'), 'Laser sweep animation must be present');
});
