import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Task 5: Planificador de Rutas, Mapa y Módulo de Excel (FNVAC Branding)', () => {
  test('src/app/rutas/page.tsx: migrates emerald to fnvac-blue and fnvac-red', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'rutas', 'page.tsx');
    assert.ok(fs.existsSync(filePath), 'rutas/page.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf8');

    // Zero legacy emerald classes
    assert.ok(!content.includes('emerald'), 'rutas/page.tsx must not contain any emerald class');

    // Spinners: border-fnvac-blue-600 border-r-transparent
    assert.ok(
      content.includes('border-fnvac-blue-600 border-r-transparent'),
      'Spinners must use border-fnvac-blue-600 border-r-transparent'
    );

    // Header badge
    assert.ok(
      content.includes('bg-fnvac-blue-50 border border-fnvac-blue-200 text-fnvac-blue-800'),
      'Header badge must use fnvac-blue soft palette'
    );

    // Capacity progress bar
    assert.ok(
      content.includes("isOverweight ? 'bg-fnvac-red-600' : capacityPercentage > 80 ? 'bg-amber-500' : 'bg-fnvac-blue-600'"),
      'Capacity progress bar must use fnvac-red-600 and fnvac-blue-600'
    );

    // Critical batch assistant button: bg-fnvac-red-600 hover:bg-fnvac-red-700 text-white
    assert.ok(
      content.includes('bg-fnvac-red-600 hover:bg-fnvac-red-700 text-white'),
      'Critical batch button must use bg-fnvac-red-600 hover:bg-fnvac-red-700 text-white'
    );

    // Calculate & optimize route button: bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white
    assert.ok(
      content.includes('bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white'),
      'Optimize sequence button must use bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white'
    );

    // Origin CEDIS Celaya: bg-fnvac-blue-50 border-fnvac-blue-200 text-fnvac-blue-950 with pill bg-fnvac-blue-700
    assert.ok(
      content.includes('bg-fnvac-blue-50 border border-fnvac-blue-200') &&
      content.includes('bg-fnvac-blue-700 text-white') &&
      content.includes('text-fnvac-blue-950'),
      'Origin CEDIS Celaya box must use fnvac-blue tokens'
    );

    // Route summary box
    assert.ok(
      content.includes('bg-fnvac-blue-50 rounded-xl border border-fnvac-blue-100') &&
      content.includes('text-fnvac-blue-950 font-mono'),
      'Route summary box must use bg-fnvac-blue-50 border-fnvac-blue-100 text-fnvac-blue-950'
    );

    // Dispatch button
    assert.ok(
      content.includes('bg-fnvac-blue-700 hover:bg-fnvac-blue-800') &&
      content.includes('Despachar y Generar Manifiesto'),
      'Dispatch button must use bg-fnvac-blue-700 hover:bg-fnvac-blue-800 and label Despachar y Generar Manifiesto'
    );

    // History and undo dialogs
    assert.ok(
      content.includes('text-fnvac-blue-800') && content.includes('text-fnvac-blue-700'),
      'History table and undo dialogs must use fnvac-blue'
    );
  });

  test('src/components/MapRouteView.tsx: styles CEDIS Celaya origin pin and polyline with FNVAC colors', () => {
    const filePath = path.join(rootDir, 'src', 'components', 'MapRouteView.tsx');
    assert.ok(fs.existsSync(filePath), 'MapRouteView.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf8');

    // Zero legacy emerald classes
    assert.ok(!content.includes('emerald'), 'MapRouteView.tsx must not contain any emerald class');

    // Origin CEDIS Celaya pin: #136793 and red accent
    assert.ok(
      content.includes('background: #136793;') && content.includes('#d21e27'),
      'CEDIS origin marker must be styled with #136793 and red accent (#d21e27)'
    );

    // Outbound delivery route polyline: #136793
    assert.ok(
      content.includes("color: '#136793'"),
      'Delivery route polyline must use FNVAC blue (#136793)'
    );

    // Legend overlay
    assert.ok(
      content.includes('bg-fnvac-blue-600'),
      'Legend overlay must use bg-fnvac-blue-600'
    );
  });

  test('src/app/excel/page.tsx: styles badges, banner, buttons, and specs with fnvac-blue', () => {
    const filePath = path.join(rootDir, 'src', 'app', 'excel', 'page.tsx');
    assert.ok(fs.existsSync(filePath), 'excel/page.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf8');

    // Zero legacy emerald classes
    assert.ok(!content.includes('emerald'), 'excel/page.tsx must not contain any emerald class');

    // Header badge: text-fnvac-blue-800 bg-fnvac-blue-100 border-fnvac-blue-200
    assert.ok(
      content.includes('text-fnvac-blue-800') &&
      content.includes('bg-fnvac-blue-100 border border-fnvac-blue-200'),
      'Header badge must use text-fnvac-blue-800 bg-fnvac-blue-100 border-fnvac-blue-200'
    );

    // Banner: from-fnvac-blue-50 via-slate-50 to-white, icon bg-fnvac-blue-600 text-white
    assert.ok(
      content.includes('from-fnvac-blue-50 via-slate-50 to-white') &&
      content.includes('bg-fnvac-blue-600 text-white'),
      'Context banner must use from-fnvac-blue-50 and bg-fnvac-blue-600 icon'
    );

    // Active tab indicator: border-fnvac-blue-600 text-fnvac-blue-700
    assert.ok(
      content.includes('border-fnvac-blue-600 text-fnvac-blue-700'),
      'Active tab indicator must use border-fnvac-blue-600 text-fnvac-blue-700'
    );

    // Download buttons: bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white
    assert.ok(
      content.includes('bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white'),
      'Download template and export inventory buttons must use bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white'
    );

    // Table column specs: text-fnvac-blue-800
    assert.ok(
      content.includes('text-fnvac-blue-800 font-mono">Codigo_Barras</td>'),
      'Table column specs must use text-fnvac-blue-800'
    );

    // Re-seed confirmation banner: bg-fnvac-blue-50 border-fnvac-blue-200 with button bg-fnvac-blue-700 hover:bg-fnvac-blue-800
    assert.ok(
      content.includes('bg-fnvac-blue-50 border border-fnvac-blue-200') &&
      content.includes('bg-fnvac-blue-700 hover:bg-fnvac-blue-800'),
      'Re-seed modal banner and confirm button must use fnvac-blue'
    );
  });

  test('src/components/ExcelDropzone.tsx: dropzone states, icons, import button and success banner', () => {
    const filePath = path.join(rootDir, 'src', 'components', 'ExcelDropzone.tsx');
    assert.ok(fs.existsSync(filePath), 'ExcelDropzone.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf8');

    // Zero legacy emerald classes
    assert.ok(!content.includes('emerald'), 'ExcelDropzone.tsx must not contain any emerald class');

    // Active drag state: border-fnvac-blue-500 bg-fnvac-blue-50/70
    assert.ok(
      content.includes('border-fnvac-blue-500 bg-fnvac-blue-50/70'),
      'Active drag state must use border-fnvac-blue-500 bg-fnvac-blue-50/70'
    );

    // Inactive dropzone hover: hover:border-fnvac-blue-500
    assert.ok(
      content.includes('hover:border-fnvac-blue-500'),
      'Dropzone hover state must use hover:border-fnvac-blue-500'
    );

    // Dropzone icons & chips: bg-fnvac-blue-100 text-fnvac-blue-700
    assert.ok(
      content.includes('bg-fnvac-blue-100 text-fnvac-blue-700'),
      'Dropzone icons must use bg-fnvac-blue-100 text-fnvac-blue-700'
    );

    // Import button: bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white focus:ring-fnvac-blue-500
    assert.ok(
      content.includes('bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white') &&
      content.includes('focus:ring-fnvac-blue-500'),
      'Import button must use bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white focus:ring-fnvac-blue-500'
    );

    // Success import notification banner: bg-fnvac-blue-50 border-fnvac-blue-200 text-fnvac-blue-950 with icon bg-fnvac-blue-600 text-white
    assert.ok(
      content.includes('bg-fnvac-blue-50 border border-fnvac-blue-200 text-fnvac-blue-950') &&
      content.includes('bg-fnvac-blue-600 text-white'),
      'Success banner must use bg-fnvac-blue-50 border-fnvac-blue-200 text-fnvac-blue-950 with icon bg-fnvac-blue-600 text-white'
    );
  });

  test('src/components/UserManagementTab.tsx: header, button, coordinator badge, and modal save button', () => {
    const filePath = path.join(rootDir, 'src', 'components', 'UserManagementTab.tsx');
    assert.ok(fs.existsSync(filePath), 'UserManagementTab.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf8');

    // Zero legacy emerald classes
    assert.ok(!content.includes('emerald'), 'UserManagementTab.tsx must not contain any emerald class');

    // Header and "+ Nuevo Usuario" button: bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white
    assert.ok(
      content.includes('bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white') &&
      content.includes('+ Nuevo Usuario'),
      'Add user button must use bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white and label + Nuevo Usuario'
    );

    // Coordinator role badge: bg-fnvac-blue-100 text-fnvac-blue-800 border-fnvac-blue-200
    assert.ok(
      content.includes('bg-fnvac-blue-100 text-fnvac-blue-800 border border-fnvac-blue-200') &&
      content.includes('Coordinador / Administrador'),
      'Coordinator role badge must use bg-fnvac-blue-100 text-fnvac-blue-800 border-fnvac-blue-200'
    );

    // Modal save button: bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white
    assert.ok(
      content.includes('type="submit"') &&
      content.includes('bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white'),
      'Modal save button must use bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white'
    );
  });
});
