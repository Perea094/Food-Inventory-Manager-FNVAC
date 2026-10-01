import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GET as getProductsHandler, POST as createProductHandler } from '../src/app/api/products/route.ts';
import { POST as receiveBatchHandler, GET as getInventoryHandler } from '../src/app/api/inventory/route.ts';
import { DELETE as deleteBatchHandler } from '../src/app/api/inventory/[id]/route.ts';
import {
  getDb,
  getBatchById,
  createBatch,
  getProductByBarcode,
  createProduct,
} from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('Navbar: contains desktop and mobile links to /operador with accessible labels and ScanLine icon', () => {
  const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.tsx');
  assert.ok(fs.existsSync(navbarPath), 'Navbar.tsx must exist');
  const content = fs.readFileSync(navbarPath, 'utf8');

  // Must import ScanLine from lucide-react
  assert.ok(content.includes('ScanLine'), 'Navbar.tsx must import ScanLine from lucide-react');

  // Must link to /operador
  assert.ok(content.includes('href="/operador"'), 'Navbar.tsx must contain links to /operador');

  // Must have accessible label for operator mode
  assert.ok(
    content.includes('aria-label="Abrir Modo Operador de Almacén"') ||
      content.includes('aria-label="Modo Operador de Almacén"'),
    'Navbar.tsx must have accessible aria-label for Modo Operador'
  );

  // Must display Modo Operador text
  assert.ok(content.includes('Modo Operador'), 'Navbar.tsx must display "Modo Operador"');
});

test('UI Component: operador/page.tsx exists and defines warehouse operator UI elements', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'operador', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'operador/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Client component
  assert.ok(content.includes("'use client'"), 'Must be a client component');

  // Header navigation link to home
  assert.ok(content.includes('Volver al Tablero Principal'), 'Must have "Volver al Tablero Principal"');
  assert.ok(content.includes('href="/"'), 'Back button must link to "/"');

  // Title and shift counter
  assert.ok(content.includes('Modo Operador de Almacén'), 'Must have title "Modo Operador de Almacén"');
  assert.ok(content.includes('Terminal de Registro Rápido CEDIS Celaya'), 'Must have subtitle "Terminal de Registro Rápido CEDIS Celaya"');
  assert.ok(content.includes('Registros del Turno'), 'Must have "Registros del Turno" counter');

  // Audio synthesize & toggle
  assert.ok(content.includes('Volume2'), 'Must have Volume2 audio toggle');
  assert.ok(content.includes('VolumeX'), 'Must have VolumeX audio toggle');
  assert.ok(content.includes('playBeep'), 'Must have playBeep synthesizer');

  // Barcode gun & scanner
  assert.ok(content.includes('barcode-gun-input'), 'Must have barcode-gun-input for handheld scanner');
  assert.ok(content.includes('BarcodeScanner'), 'Must integrate BarcodeScanner component');

  // Produce shortcuts & quick modal
  assert.ok(content.includes('BULK_PRODUCE_SHORTCUTS'), 'Must include BULK_PRODUCE_SHORTCUTS');
  assert.ok(content.includes('+ Registrar producto inexistente'), 'Must have button "+ Registrar producto inexistente"');
  assert.ok(content.includes('QuickProductModal'), 'Must integrate QuickProductModal');

  // Tactile touch steppers
  assert.ok(content.includes('+1'), 'Must have +1 stepper button');
  assert.ok(content.includes('+5'), 'Must have +5 stepper button');
  assert.ok(content.includes('+10'), 'Must have +10 stepper button');
  assert.ok(content.includes('+50'), 'Must have +50 stepper button');
  assert.ok(content.includes('+100'), 'Must have +100 stepper button');
  assert.ok(content.includes('-1'), 'Must have -1 decrement button');
  assert.ok(content.includes('-5'), 'Must have -5 decrement button');
  assert.ok(content.includes('Reset'), 'Must have Reset button');

  // Expiration date chips
  assert.ok(content.includes('+7d'), 'Must have +7d expiration chip');
  assert.ok(content.includes('+15d'), 'Must have +15d expiration chip');
  assert.ok(content.includes('+30d'), 'Must have +30d expiration chip');
  assert.ok(content.includes('+60d'), 'Must have +60d expiration chip');
  assert.ok(content.includes('+90d'), 'Must have +90d expiration chip');
  assert.ok(content.includes('+1 año'), 'Must have +1 año expiration chip');

  // Real-time StatusBadge
  assert.ok(content.includes('StatusBadge'), 'Must display real-time StatusBadge');

  // Big confirmation button
  assert.ok(content.includes('CONFIRMAR ENTRADA A BODEGA'), 'Must have prominent "CONFIRMAR ENTRADA A BODEGA" button');

  // Duplicate collision handling
  assert.ok(content.includes('duplicateCollisionModal'), 'Must handle duplicateCollisionModal');
  assert.ok(content.includes('Consolidar Existencias'), 'Must offer Consolidar Existencias option');

  // Mis Registros Recientes & delete modal
  assert.ok(content.includes('Mis Registros Recientes'), 'Must have "Mis Registros Recientes" section');
  assert.ok(content.includes('deletingBatch'), 'Must have delete / undo batch confirmation');
  assert.ok(content.includes('Deshacer'), 'Must have Deshacer button in shift table');
});

test('API Integration Workflow: Operator looks up product, registers batch, handles duplicate conflict and undoes entry', async () => {
  // 1. Operator scans an existing product barcode (e.g. 7501020511111 - Leche Entera UHT 1L Cuadritos)
  const lookupReq = new Request('http://localhost:3000/api/products?barcode=7501020511111');
  const lookupRes = await getProductsHandler(lookupReq);
  assert.equal(lookupRes.status, 200);
  const products = await lookupRes.json();
  assert.ok(products.length > 0);
  const scannedProduct = products[0];
  assert.equal(scannedProduct.name, 'Leche Entera UHT 1L Cuadritos');

  // 2. Operator registers a new batch for this product
  const intakeLot = 'LOT-OPERATOR-TEST-001';
  const intakeReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: scannedProduct.id,
      lotCode: intakeLot,
      expirationDate: '2026-10-30',
      currentQuantity: 50,
    }),
  });
  const intakeRes = await receiveBatchHandler(intakeReq);
  assert.equal(intakeRes.status, 201);
  const createdBatch = await intakeRes.json();
  assert.ok(createdBatch.id);
  assert.equal(createdBatch.lotCode, intakeLot);
  assert.equal(createdBatch.currentQuantity, 50);

  // Verify created in DB
  const inDb = getBatchById(createdBatch.id);
  assert.ok(inDb);
  assert.equal(inDb.lotCode, intakeLot);

  // 3. Operator attempts to scan the same lot again -> Triggers 409 duplicate conflict
  const dupReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: scannedProduct.id,
      lotCode: intakeLot,
      expirationDate: '2026-10-25',
      currentQuantity: 30,
    }),
  });
  const dupRes = await receiveBatchHandler(dupReq);
  assert.equal(dupRes.status, 409);
  const dupData = await dupRes.json();
  assert.equal(dupData.duplicateDetected, true);
  assert.ok(dupData.existingBatch);

  // 4. Operator chooses to consolidate existences in collision modal
  const consolidateReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: scannedProduct.id,
      lotCode: intakeLot,
      expirationDate: '2026-10-25',
      currentQuantity: 30,
      action: 'consolidate',
      updateExpirationStrategy: 'earliest',
    }),
  });
  const consolidateRes = await receiveBatchHandler(consolidateReq);
  assert.equal(consolidateRes.status, 200);
  const consolidatedData = await consolidateRes.json();
  assert.equal(consolidatedData.consolidated, true);
  assert.equal(consolidatedData.currentQuantity, 80); // 50 + 30
  assert.equal(consolidatedData.expirationDate, '2026-10-25'); // Earliest adopted

  // 5. Operator clicks "Deshacer" to remove this batch if entered by mistake
  const deleteReq = new Request(`http://localhost:3000/api/inventory/${createdBatch.id}`, {
    method: 'DELETE',
  });
  const deleteRes = await deleteBatchHandler(deleteReq, { params: { id: createdBatch.id } });
  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.success, true);

  // Verify removed from database
  assert.equal(getBatchById(createdBatch.id), null);
});

test('API Integration Workflow: Operator registers an uncataloged item on the fly and admits stock', async () => {
  const newBarcode = '7509999888877';

  // 1. Product lookup returns empty
  const lookupReq = new Request(`http://localhost:3000/api/products?barcode=${newBarcode}`);
  const lookupRes = await getProductsHandler(lookupReq);
  const initialProducts = await lookupRes.json();
  assert.equal(initialProducts.length, 0);

  // 2. Operator opens QuickProductModal and creates product on the fly
  const createProductReq = new Request('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: newBarcode,
      name: 'Manzanas Red Delicious Granel',
      donorType: 'Campo Bajío',
      category: 'AGRICOLA_PERECEDERO',
      unit: 'kilos',
      storageArea: 'Anden',
      minStock: 100,
    }),
  });
  const createProductRes = await createProductHandler(createProductReq);
  assert.equal(createProductRes.status, 201);
  const newProduct = await createProductRes.json();
  assert.equal(newProduct.barcode, newBarcode);
  assert.equal(newProduct.name, 'Manzanas Red Delicious Granel');

  // 3. Operator admits batch into storage
  const batchReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: newProduct.id,
      lotCode: 'LOT-MANZANA-01',
      expirationDate: '2026-09-30',
      currentQuantity: 250,
    }),
  });
  const batchRes = await receiveBatchHandler(batchReq);
  assert.equal(batchRes.status, 201);
  const batchData = await batchRes.json();
  assert.equal(batchData.lotCode, 'LOT-MANZANA-01');
  assert.equal(batchData.currentQuantity, 250);

  // Verify in inventory list
  const invReq = new Request('http://localhost:3000/api/inventory');
  const invRes = await getInventoryHandler(invReq);
  const invData = await invRes.json();
  const foundInInventory = invData.batches.find((b) => b.lotCode === 'LOT-MANZANA-01');
  assert.ok(foundInInventory);
  assert.equal(foundInInventory.currentQuantity, 250);
});
