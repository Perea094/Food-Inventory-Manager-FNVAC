import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GET as getProducts, POST as createProductHandler } from '../src/app/api/products/route.ts';
import { POST as receiveBatchHandler, GET as getInventory } from '../src/app/api/inventory/route.ts';
import { BULK_PRODUCE_SHORTCUTS, generateInternalBarcode } from '../src/lib/produce.ts';
import { calculateDaysRemaining, getFEFOStatus, isAlreadyExpired } from '../src/lib/fefo.ts';
import { getDb, deleteBatch } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('Reception: Bulk Produce Shortcuts are valid and resolvable in catalog', async () => {
  assert.equal(BULK_PRODUCE_SHORTCUTS.length, 4, 'Should have 4 bulk produce shortcuts');

  const names = BULK_PRODUCE_SHORTCUTS.map((s) => s.name);
  assert.ok(names.includes('Brócoli Fresco'));
  assert.ok(names.includes('Zanahoria Fresca'));
  assert.ok(names.includes('Jitomate Bola'));
  assert.ok(names.includes('Lechuga Romana'));

  // Test barcode retrieval for each produce
  for (const item of BULK_PRODUCE_SHORTCUTS) {
    const req = new Request(`http://localhost:3000/api/products?barcode=${item.barcode}`);
    const res = await getProducts(req);
    assert.equal(res.status, 200);
    const prods = await res.json();
    assert.equal(prods.length, 1, `Product with barcode ${item.barcode} (${item.name}) should exist`);
    assert.equal(prods[0].category, 'AGRICOLA_PERECEDERO');
  }
});

test('Reception: Quick product creation + immediate batch reception flow', async () => {
  // 1. Barcode not in catalog
  const unknownBarcode = '7509998887771';
  const checkReq = new Request(`http://localhost:3000/api/products?barcode=${unknownBarcode}`);
  const checkRes = await getProducts(checkReq);
  assert.equal(checkRes.status, 200);
  const checkList = await checkRes.json();
  assert.equal(checkList.length, 0, 'Barcode should not be in catalog initially');

  // 2. QuickProductModal registers new product
  const createProductReq = new Request('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: unknownBarcode,
      name: 'Yogur Griego Fresa 1kg',
      donorType: 'Cuadritos Biotek',
      category: 'LACTEO_FRIO',
      unit: 'piezas',
      storageArea: 'Camara_Fria',
      minStock: 40,
    }),
  });
  const createProductRes = await createProductHandler(createProductReq);
  assert.equal(createProductRes.status, 201);
  const createdProduct = await createProductRes.json();
  assert.equal(createdProduct.barcode, unknownBarcode);
  assert.equal(createdProduct.storageArea, 'Camara_Fria');

  // 3. Receive batch for this newly created product with +7 days expiration (ATENCION)
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + 7);
  const expDateStr = expDate.toISOString().split('T')[0];

  const receiveBatchReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: createdProduct.id,
      lotCode: 'LOT-YG-2026-001',
      expirationDate: expDateStr,
      currentQuantity: 80,
    }),
  });
  const receiveBatchRes = await receiveBatchHandler(receiveBatchReq);
  assert.equal(receiveBatchRes.status, 201);
  const batchData = await receiveBatchRes.json();
  assert.equal(batchData.productId, createdProduct.id);
  assert.equal(batchData.status, 'ATENCION');
  assert.equal(batchData.currentQuantity, 80);
});

test('Reception: Expiration shortcuts and warning handling', async () => {
  // Test expiration calculation helper
  const pastDate = '2020-01-01';
  assert.ok(isAlreadyExpired(pastDate), 'Past date should be recognized as expired');

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  assert.ok(!isAlreadyExpired(futureDateStr), 'Future date should not be expired');
  assert.equal(getFEFOStatus(calculateDaysRemaining(futureDateStr), 50), 'CRITICO');

  // Test API reception of expired batch with forceReject=true
  const rejectReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'prod-001',
      lotCode: 'LOT-REJECT-01',
      expirationDate: pastDate,
      currentQuantity: 10,
      forceReject: true,
    }),
  });
  const rejectRes = await receiveBatchHandler(rejectReq);
  assert.equal(rejectRes.status, 400, 'Expired batch with forceReject should be rejected');

  // Test API reception of expired batch as merma intake (forceReject=false)
  const mermaReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'prod-001',
      lotCode: 'LOT-MERMA-01',
      expirationDate: pastDate,
      currentQuantity: 15,
      forceReject: false,
    }),
  });
  const mermaRes = await receiveBatchHandler(mermaReq);
  assert.equal(mermaRes.status, 201, 'Expired batch recorded as merma intake should succeed with warning');
  const mermaData = await mermaRes.json();
  assert.ok(mermaData.warning, 'Warning property should be included');

  // Clean up merma batch so it does not linger in local database
  if (mermaData.id) {
    deleteBatch(mermaData.id);
  }
});

test('Reception: Action bar includes + Registrar producto inexistente button and wires onAddNewProduct to BarcodeScanner', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'recepcion/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify handleOpenNewProductModal definition and reset logic
  assert.ok(
    content.includes('handleOpenNewProductModal = () => {'),
    'Must define handleOpenNewProductModal'
  );
  assert.ok(
    content.includes('setBarcodeNotFound(null)'),
    'handleOpenNewProductModal must reset barcodeNotFound to null'
  );
  assert.ok(
    content.includes("setSuggestedProductName('')"),
    'handleOpenNewProductModal must reset suggestedProductName to empty string'
  );
  assert.ok(
    content.includes('setIsQuickModalOpen(true)'),
    'handleOpenNewProductModal must set isQuickModalOpen to true'
  );

  // Verify prominent top action bar button
  assert.ok(
    content.includes('+ Registrar producto inexistente'),
    'Action bar must include "+ Registrar producto inexistente" button'
  );
  assert.ok(
    content.includes('onClick={handleOpenNewProductModal}'),
    'Button must wire onClick to handleOpenNewProductModal'
  );
  assert.ok(
    content.includes('bg-fnvac-blue-100/90 hover:bg-fnvac-blue-200 border border-fnvac-blue-300') ||
    content.includes('bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300'),
    'Action button must have institutional highlight classes'
  );

  // Verify BarcodeScanner receives onAddNewProduct
  assert.ok(
    content.includes('onAddNewProduct={handleOpenNewProductModal}'),
    'BarcodeScanner component must receive onAddNewProduct={handleOpenNewProductModal}'
  );

  // Verify QuickProductModal receives scannedBarcode
  assert.ok(
    content.includes("scannedBarcode={barcodeNotFound || ''}"),
    'QuickProductModal must receive scannedBarcode={barcodeNotFound || ""}'
  );
});

test('Reception: Flow for registering uncataloged product with generated internal barcode and receiving batch', async () => {
  // Generate internal barcode
  const internalCode = generateInternalBarcode();
  assert.match(internalCode, /^INT-\d{11}$/, 'Should generate internal code with INT- prefix and 11 digits');

  // Register product in catalog with internal barcode
  const createProductReq = new Request('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: internalCode,
      name: 'Melón Cantaloupe Donación Campo',
      donorType: 'Campo Bajío',
      category: 'AGRICOLA_PERECEDERO',
      unit: 'kilos',
      storageArea: 'Anden',
      minStock: 30,
    }),
  });
  const createProductRes = await createProductHandler(createProductReq);
  assert.equal(createProductRes.status, 201);
  const newProduct = await createProductRes.json();
  assert.equal(newProduct.barcode, internalCode);
  assert.equal(newProduct.category, 'AGRICOLA_PERECEDERO');

  // Receive a batch for this newly registered product
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + 5);
  const expDateStr = expDate.toISOString().split('T')[0];

  const receiveReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: newProduct.id,
      lotCode: 'LOT-MELON-001',
      expirationDate: expDateStr,
      currentQuantity: 120,
    }),
  });
  const receiveRes = await receiveBatchHandler(receiveReq);
  assert.equal(receiveRes.status, 201);
  const receivedBatch = await receiveRes.json();
  assert.equal(receivedBatch.productId, newProduct.id);
  assert.equal(receivedBatch.status, 'ATENCION'); // 5 days is ATENCION (4-7 days)
  assert.equal(receivedBatch.currentQuantity, 120);

  // Clean up created batch
  if (receivedBatch.id) {
    deleteBatch(receivedBatch.id);
  }
});

