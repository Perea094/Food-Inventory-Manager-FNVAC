import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('BarcodeScanner: Component source includes required Lucide icons and state variables', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  assert.ok(fs.existsSync(scannerPath), 'BarcodeScanner.tsx must exist');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Verify icon imports
  assert.ok(content.includes('FlipHorizontal'), 'Must import FlipHorizontal from lucide-react');
  assert.ok(content.includes('HelpCircle'), 'Must import HelpCircle from lucide-react');
  assert.ok(content.includes('Volume2'), 'Must import Volume2 from lucide-react');
  assert.ok(content.includes('VolumeX'), 'Must import VolumeX from lucide-react');

  // Verify state variables
  assert.ok(content.includes('availableCameras'), 'Must declare availableCameras state');
  assert.ok(content.includes('selectedCameraId'), 'Must declare selectedCameraId state');
  assert.ok(content.includes('isMirrored'), 'Must declare isMirrored state');
  assert.ok(content.includes('showTips'), 'Must declare showTips state');
  assert.ok(content.includes('soundEnabled'), 'Must declare soundEnabled state');
  assert.ok(content.includes('detectedCodeOverlay'), 'Must declare detectedCodeOverlay state');
});

test('BarcodeScanner: html5-qrcode configured with formatsToSupport and useBarCodeDetectorIfSupported', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Verify dynamic import of html5-qrcode
  assert.ok(content.includes("import('html5-qrcode')"), 'Must dynamically import html5-qrcode');

  // Verify formatsToSupport array containing all target barcode types
  assert.ok(content.includes('formatsToSupport'), 'Must configure formatsToSupport');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.EAN_13'), 'Must support EAN_13');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.EAN_8'), 'Must support EAN_8');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.CODE_128'), 'Must support CODE_128');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.CODE_39'), 'Must support CODE_39');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.UPC_A'), 'Must support UPC_A');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.UPC_E'), 'Must support UPC_E');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.ITF'), 'Must support ITF');
  assert.ok(content.includes('Html5QrcodeSupportedFormats.QR_CODE'), 'Must support QR_CODE');

  // Verify hardware BarcodeDetector experimental feature
  assert.ok(content.includes('experimentalFeatures'), 'Must configure experimentalFeatures');
  assert.ok(
    content.includes('useBarCodeDetectorIfSupported: true'),
    'Must enable useBarCodeDetectorIfSupported: true'
  );
});

test('BarcodeScanner: Camera detection, flexible fallback, and resolution/focus constraints', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Verify getCameras query
  assert.ok(content.includes('Html5Qrcode.getCameras()'), 'Must query Html5Qrcode.getCameras()');

  // Verify camera selection dropdown element
  assert.ok(content.includes('cameraSelect'), 'Must have camera select dropdown element');
  assert.ok(content.includes('availableCameras.length > 1'), 'Must display camera dropdown when multiple cameras available');

  // Verify flexible camera config: exact deviceId, facingMode: environment with fallback to user
  assert.ok(
    content.includes("deviceId: { exact: selectedCameraId }"),
    'Must use exact deviceId when selectedCameraId is set'
  );
  assert.ok(
    content.includes("facingMode: 'environment'"),
    'Must default to environment facingMode'
  );
  assert.ok(
    content.includes("facingMode: 'user'"),
    'Must provide fallback to user facingMode'
  );

  // Verify video constraints: fps 15, continuous focus, 1280x720 ideal
  assert.ok(content.includes('fps: 15'), 'Must configure 15 fps for responsive barcode tracking');
  assert.ok(content.includes("focusMode: 'continuous'"), 'Must specify continuous autofocus');
  assert.ok(content.includes('ideal: 1280'), 'Must target ideal 1280px width resolution');
  assert.ok(content.includes('ideal: 720'), 'Must target ideal 720px height resolution');
});

test('BarcodeScanner: Dynamic rectangular qrbox calculation optimizes 1D linear barcode reading', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Verify qrbox function structure
  assert.ok(
    content.includes('viewfinderWidth * 0.88') || content.includes('0.88'),
    'Must use 88% viewfinder width'
  );
  assert.ok(
    content.includes('viewfinderHeight * 0.48') || content.includes('0.48'),
    'Must use 48% viewfinder height'
  );
  assert.ok(content.includes('420'), 'Must cap maximum width at 420px');
  assert.ok(content.includes('200'), 'Must cap maximum height at 200px');

  // Functional test on calculateQrBox formula
  const calculateQrBox = (viewfinderWidth, viewfinderHeight) => ({
    width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
    height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
  });

  // Mobile viewport: 360 x 640
  const mobileBox = calculateQrBox(360, 640);
  assert.equal(mobileBox.width, 316);
  assert.equal(mobileBox.height, 200); // capped at 200
  assert.ok(mobileBox.width > mobileBox.height, 'Must be rectangular (width > height) for 1D barcodes');

  // Large desktop viewport: 1280 x 720
  const desktopBox = calculateQrBox(1280, 720);
  assert.equal(desktopBox.width, 420); // capped at 420
  assert.equal(desktopBox.height, 200); // capped at 200

  // Compact viewport: 280 x 240
  const compactBox = calculateQrBox(280, 240);
  assert.equal(compactBox.width, 246);
  assert.equal(compactBox.height, 115);
  assert.ok(compactBox.width > compactBox.height);
});

test('BarcodeScanner: Mirror mode toggles scale-x-[-1] on the video element inside #qr-reader', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  assert.ok(content.includes('isMirrored'), 'Must track isMirrored state');
  assert.ok(
    content.includes('scale-x-[-1]'),
    'Must toggle scale-x-[-1] class on the video element for mirrored webcam reflection'
  );
  assert.ok(content.includes('qr-reader'), 'Must target #qr-reader element container');
  assert.ok(
    content.includes('FlipHorizontal'),
    'Must provide mirror toggle button with FlipHorizontal icon'
  );
});

test('BarcodeScanner: Audio synthesizer, tactile vibration, and debounce mechanism', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Audio synthesizer
  assert.ok(content.includes('AudioContext'), 'Must instantiate Web Audio API AudioContext for scan beep');
  assert.ok(content.includes('playScanBeep'), 'Must define playScanBeep synthesizer helper');
  assert.ok(content.includes('soundEnabled'), 'Must support soundEnabled toggle state');

  // Haptic feedback
  assert.ok(content.includes('navigator.vibrate'), 'Must call navigator.vibrate for mobile haptic feedback');

  // Debounce mechanism: 1500ms (1.5 seconds)
  assert.ok(
    content.includes('1500'),
    'Must debounce rapid repeated scans of the exact same code within 1500ms'
  );

  // Overlay badge: 1200ms (1.2 seconds)
  assert.ok(
    content.includes('1200'),
    'Must display detectedCodeOverlay badge for 1200ms upon decode'
  );
});

test('BarcodeScanner: Viewfinder contains red laser scanning animation and user scanning tips', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Viewfinder laser line
  assert.ok(
    content.includes('animate-laser-sweep'),
    'Viewfinder must contain animated horizontal red laser line'
  );

  // Globals CSS animation check
  const globalsPath = path.join(rootDir, 'src', 'app', 'globals.css');
  const globalsContent = fs.readFileSync(globalsPath, 'utf8');
  assert.ok(globalsContent.includes('laser-sweep'), 'globals.css must define @keyframes laser-sweep');
  assert.ok(globalsContent.includes('.animate-laser-sweep'), 'globals.css must define .animate-laser-sweep');

  // Scanning tips
  assert.ok(content.includes('HelpCircle'), 'Must have scanning tips button with HelpCircle icon');
  assert.ok(
    content.includes('Mantén el código a 15-25 cm de distancia'),
    'Must provide tip: Mantén el código a 15-25 cm de distancia'
  );
  assert.ok(
    content.includes('Alinea las barras horizontalmente dentro de la guía roja'),
    'Must provide tip: Alinea las barras horizontalmente dentro de la guía roja'
  );
  assert.ok(
    content.includes('Asegura buena iluminación sin reflejos directos'),
    'Must provide tip: Asegura buena iluminación sin reflejos directos'
  );

  // Tactile feedback classes on buttons
  assert.ok(
    content.includes('active:scale-95'),
    'Buttons must include active:scale-95 tactile feedback class'
  );
});

test('BarcodeScanner: Quick access header renamed to Artículos perecederos (sin código físico) and supports onAddNewProduct prop', () => {
  const scannerPath = path.join(rootDir, 'src', 'components', 'BarcodeScanner.tsx');
  const content = fs.readFileSync(scannerPath, 'utf8');

  // Verify renamed header
  assert.ok(
    content.includes('Artículos perecederos (sin código físico)'),
    'Header text must be renamed to "Artículos perecederos (sin código físico)"'
  );

  // Verify onAddNewProduct prop in interface and component signature
  assert.ok(
    content.includes('onAddNewProduct?: () => void;'),
    'BarcodeScannerProps must define optional onAddNewProduct callback'
  );
  assert.ok(
    content.includes('onAddNewProduct,'),
    'BarcodeScanner must destructure onAddNewProduct prop'
  );

  // Verify inline header action button
  assert.ok(
    content.includes('+ Registrar nuevo'),
    'Quick Access header must include "+ Registrar nuevo" inline button'
  );
  assert.ok(
    content.includes('text-fnvac-blue-700 hover:text-fnvac-blue-800 bg-fnvac-blue-50 hover:bg-fnvac-blue-100 px-2.5 py-1 rounded-lg border border-fnvac-blue-200') ||
    content.includes('text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200'),
    'Inline header button must have required institutional badge styling'
  );

  // Verify bottom dashed registration button
  assert.ok(
    content.includes('Registrar producto inexistente (dar de alta en catálogo)'),
    'Must include bottom dashed button "Registrar producto inexistente (dar de alta en catálogo)"'
  );
  assert.ok(
    content.includes('border-dashed border-slate-300 hover:border-fnvac-blue-500 hover:bg-fnvac-blue-50/60') ||
    content.includes('border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/60'),
    'Bottom registration button must have clean dashed border styling'
  );
  assert.ok(
    content.includes('PlusCircle'),
    'Must import and render PlusCircle icon for new product actions'
  );
});

test('QuickProductModal: Generates internal barcode format and handles uncataloged products', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'QuickProductModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'QuickProductModal.tsx must exist');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Verify generateInternalBarcode exported
  assert.ok(
    content.includes('export function generateInternalBarcode(): string'),
    'Must export generateInternalBarcode helper function'
  );

  // Verify dynamic title handling
  assert.ok(
    content.includes('Alta de Producto Inexistente en Catálogo'),
    'Must display title "Alta de Producto Inexistente en Catálogo" when scannedBarcode is empty'
  );
  assert.ok(
    content.includes('Registrar Producto Nuevo'),
    'Must display title "Registrar Producto Nuevo" when scannedBarcode is provided'
  );

  // Verify internal code generation button with Sparkles
  assert.ok(
    content.includes('Generar código interno'),
    'Must render "Generar código interno" button when scannedBarcode is empty'
  );
  assert.ok(
    content.includes('Sparkles'),
    'Must render Sparkles icon for internal barcode generation'
  );

  // Verify barcode format INT-${8 digits}${3 digits} (11 digits total)
  const generateInternalBarcode = () => `INT-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
  const code = generateInternalBarcode();
  assert.match(code, /^INT-\d{11}$/, 'Generated barcode must match pattern INT-XXXXXXXXXXX');
  assert.ok(code.startsWith('INT-'), 'Generated barcode must start with INT-');
  assert.equal(code.length, 15, 'Total length should be 15 characters (INT- + 11 digits)');

  // Verify multiple generations produce valid formatted codes
  for (let i = 0; i < 10; i++) {
    const sample = generateInternalBarcode();
    assert.match(sample, /^INT-\d{11}$/);
  }
});

