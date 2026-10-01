import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Print Isolation: globals.css defines complete unrolling and media print isolation', () => {
  const cssPath = path.join(rootDir, 'src', 'app', 'globals.css');
  assert.ok(fs.existsSync(cssPath), 'globals.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify @page margins and letter portrait format
  assert.ok(css.includes('@page'), 'Must include @page directive');
  assert.ok(css.includes('margin: 1.5cm;'), 'Must specify 1.5cm standard print margin');
  assert.ok(css.includes('size: letter portrait;'), 'Must specify letter portrait page size');

  // Verify html, body reset
  assert.ok(css.includes('html,'), 'Must target html');
  assert.ok(css.includes('body {'), 'Must target body');
  assert.ok(css.includes('background: #ffffff !important;'), 'Must set background to white !important');
  assert.ok(css.includes('color: #000000 !important;'), 'Must set font color to black !important');
  assert.ok(css.includes('font-size: 10pt;'), 'Must set font-size to 10pt');
  assert.ok(css.includes('line-height: 1.35;'), 'Must set readable line-height 1.35');
  assert.ok(css.includes('overflow: visible !important;'), 'Must set overflow visible !important');

  // Verify no-print chrome hiding
  assert.ok(css.includes('.no-print'), 'Must hide .no-print');
  assert.ok(css.includes('.print\\:hidden'), 'Must hide .print:hidden');
  assert.ok(css.includes('header,'), 'Must hide header');
  assert.ok(css.includes('footer,'), 'Must hide footer');
  assert.ok(css.includes('nav {'), 'Must hide nav');

  // Verify main container expansion
  assert.ok(css.includes('main {'), 'Must target main element');
  assert.ok(css.includes('max-width: 100% !important;'), 'Must expand main to max-width: 100% !important');
  assert.ok(css.includes('width: 100% !important;'), 'Must expand main to width: 100% !important');

  // Verify modal unrolling classes
  assert.ok(css.includes('.manifest-modal-overlay'), 'Must define .manifest-modal-overlay');
  assert.ok(css.includes('.manifest-modal-dialog'), 'Must define .manifest-modal-dialog');
  assert.ok(css.includes('.manifest-modal-scroll'), 'Must define .manifest-modal-scroll');
  assert.ok(css.includes('position: static !important;'), 'Must convert fixed/sticky containers to static');
  assert.ok(css.includes('max-height: none !important;'), 'Must uncap max-height: none !important');

  // Verify #driver-manifest-sheet styling
  assert.ok(css.includes('#driver-manifest-sheet {'), 'Must style #driver-manifest-sheet in print');

  // Verify print break utilities
  assert.ok(css.includes('.print-break-inside-avoid'), 'Must include .print-break-inside-avoid');
  assert.ok(css.includes('.print\\:break-inside-avoid'), 'Must include .print:break-inside-avoid');
  assert.ok(css.includes('.print-break-after'), 'Must include .print-break-after');
  assert.ok(css.includes('.print-break-before'), 'Must include .print-break-before');

  // Verify print-table repeating headers and row break prevention
  assert.ok(css.includes('.print-table'), 'Must include .print-table class');
  assert.ok(css.includes('display: table-header-group !important;'), 'Must set thead to table-header-group');
  assert.ok(css.includes('break-inside: avoid !important;'), 'Must prevent table rows from splitting across pages');
});

test('Print Isolation: DriverManifestModal.tsx has clean styling without buggy inline visibility hacks', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'DriverManifestModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'DriverManifestModal.tsx must exist');
  const modal = fs.readFileSync(modalPath, 'utf8');

  // Bug prevention: NO inline <style jsx global>
  assert.ok(!modal.includes('<style jsx global>'), 'Must NOT contain buggy inline <style jsx global>');
  assert.ok(!modal.includes('body * {'), 'Must NOT contain body * visibility hidden hack');
  assert.ok(!modal.includes('visibility: hidden'), 'Must NOT contain visibility: hidden');
  assert.ok(!modal.includes('position: absolute !important;'), 'Must NOT contain absolute top 0 sheet placement');

  // Verify useEffect toggles manifest-modal-open on body
  assert.ok(modal.includes("document.body.classList.add('manifest-modal-open')"), 'Must add manifest-modal-open on open');
  assert.ok(modal.includes("document.body.classList.remove('manifest-modal-open')"), 'Must remove manifest-modal-open on cleanup');

  // Verify unroll classes on modal components
  assert.ok(modal.includes('manifest-modal-overlay'), 'Overlay must have manifest-modal-overlay class');
  assert.ok(modal.includes('manifest-modal-dialog'), 'Dialog must have manifest-modal-dialog class');
  assert.ok(modal.includes('manifest-modal-scroll'), 'Scroll container must have manifest-modal-scroll class');
  assert.ok(modal.includes('no-print print:hidden'), 'Top control bar must have no-print print:hidden');

  // Verify #driver-manifest-sheet container
  assert.ok(modal.includes('id="driver-manifest-sheet"'), 'Must contain id="driver-manifest-sheet"');

  // Verify cold chain banner print safety
  assert.ok(modal.includes('isColdChainRequired'), 'Must handle cold chain alert');
  assert.ok(
    modal.includes('print-break-inside-avoid') && modal.includes('print:break-inside-avoid'),
    'Cold chain banner must prevent print page breaks'
  );

  // Verify tables use .print-table
  assert.ok(modal.includes('className="print-table'), 'Tables must use .print-table class');

  // Verify Section 3 signatures and 3 official operational roles
  assert.ok(modal.includes('3. Firmas de Conformidad y Salida'), 'Must define Section 3: Firmas de Conformidad y Salida');
  assert.ok(modal.includes('1. Despachó'), 'Role 1 must be Despachó');
  assert.ok(modal.includes('Almacén &amp; Control FEFO CEDIS Celaya'), 'Role 1 entity must be Almacén & Control FEFO CEDIS Celaya');
  assert.ok(modal.includes('2. Conductor / Recibió Carga'), 'Role 2 must be Conductor / Recibió Carga');
  assert.ok(modal.includes('3. Responsable de CEDIS'), 'Role 3 must be Responsable de CEDIS');
  assert.ok(modal.includes('Supervisión Logística FNVAC'), 'Role 3 entity must be Supervisión Logística FNVAC');
});

test('Print Isolation: rutas/page.tsx wraps screen UI and isolates DriverManifestModal for print', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'rutas', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'rutas/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify screen wrapper has print:hidden and no-print
  assert.ok(
    content.includes('<div className="space-y-6 print:hidden no-print">'),
    'Entire screen planner UI must be wrapped in print:hidden no-print div'
  );

  // Verify DriverManifestModal is placed outside the print:hidden container
  const modalCallIndex = content.indexOf('<DriverManifestModal');
  const screenWrapperIndex = content.indexOf('<div className="space-y-6 print:hidden no-print">');
  const screenWrapperCloseIndex = content.indexOf('</div>\n      </div>\n\n      {/* Printable Driver Manifest Modal */}');

  assert.ok(modalCallIndex > 0, 'DriverManifestModal must be rendered');
  assert.ok(screenWrapperIndex > 0, 'Screen wrapper must exist');
  assert.ok(modalCallIndex > screenWrapperIndex, 'DriverManifestModal must be placed after screen wrapper');
  assert.ok(
    screenWrapperCloseIndex > 0,
    'Screen wrapper must be closed before DriverManifestModal'
  );
});
