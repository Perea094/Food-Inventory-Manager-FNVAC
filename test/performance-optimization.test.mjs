import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Performance: next.config.mjs configures optimizePackageImports for lucide-react', async () => {
  const nextConfigPath = path.join(rootDir, 'next.config.mjs');
  assert.ok(fs.existsSync(nextConfigPath), 'next.config.mjs must exist');

  const configModule = await import(`file://${nextConfigPath}?t=${Date.now()}`);
  const nextConfig = configModule.default;

  assert.ok(nextConfig, 'next.config.mjs should default-export a configuration object');
  assert.ok(nextConfig.experimental, 'nextConfig should define experimental options');
  assert.ok(
    Array.isArray(nextConfig.experimental.optimizePackageImports),
    'optimizePackageImports must be an array'
  );
  assert.ok(
    nextConfig.experimental.optimizePackageImports.includes('lucide-react'),
    'optimizePackageImports must include "lucide-react"'
  );
});

test('Performance: ExcelDropzone does not use top-level static xlsx import and uses dynamic import', () => {
  const dropzonePath = path.join(rootDir, 'src', 'components', 'ExcelDropzone.tsx');
  assert.ok(fs.existsSync(dropzonePath), 'ExcelDropzone.tsx must exist');

  const content = fs.readFileSync(dropzonePath, 'utf8');

  // Must not have top-level static import of xlsx
  const staticImportRegex = /^import\s+.*?\s+from\s+['"]xlsx['"];?/m;
  assert.equal(
    staticImportRegex.test(content),
    false,
    'ExcelDropzone.tsx must not contain a static top-level import of xlsx'
  );

  // Must contain dynamic import inside processFile
  assert.ok(
    content.includes("import('xlsx')") || content.includes('import("xlsx")'),
    'ExcelDropzone.tsx must dynamically import xlsx'
  );
});

test('Tactile feedback: Component interactive elements contain active feedback classes', () => {
  const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert.ok(navbarContent.includes('active:scale-[0.97]'), 'Navbar must have tactile active:scale-[0.97]');
  assert.ok(navbarContent.includes('active:scale-95'), 'Navbar reset button must have active:scale-95');
  assert.ok(navbarContent.includes('prefetch={true}'), 'Navbar links must enable prefetching');

  const kpiPath = path.join(rootDir, 'src', 'components', 'KPICard.tsx');
  const kpiContent = fs.readFileSync(kpiPath, 'utf8');
  assert.ok(kpiContent.includes('active:scale-[0.98]'), 'KPICard must have active:scale-[0.98]');

  const filtersPath = path.join(rootDir, 'src', 'components', 'InventoryFilters.tsx');
  const filtersContent = fs.readFileSync(filtersPath, 'utf8');
  assert.ok(filtersContent.includes('active:scale-95'), 'InventoryFilters must have active:scale-95');

  const tablePath = path.join(rootDir, 'src', 'components', 'InventoryTable.tsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');
  assert.ok(tableContent.includes('active:scale-95'), 'InventoryTable must have active:scale-95');
  assert.ok(tableContent.includes('prefetch={true}'), 'InventoryTable dispatch link must enable prefetch');

  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const scannerContent = fs.readFileSync(scannerPath, 'utf8');
  assert.ok(scannerContent.includes('active:scale-95'), 'BarcodeScanner must have active:scale-95');

  const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('active:scale-[0.98]'), 'page.tsx must have active:scale-[0.98]');
});
