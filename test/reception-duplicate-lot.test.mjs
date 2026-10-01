import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { POST as receiveBatchHandler, GET as getInventoryHandler } from '../src/app/api/inventory/route.ts';
import {
  getDb,
  getBatchById,
  createBatch,
  getBatchByProductAndLot,
  consolidateBatch,
} from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('DB: getBatchByProductAndLot retrieves batch by product and lotCode, case-insensitively with trimming', () => {
  const batchId = 'batch-dup-db-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-LECHE-ALPHA',
    expirationDate: '2026-10-15',
    currentQuantity: 100,
  });

  // Non-existent product or lot returns null
  assert.equal(getBatchByProductAndLot('non-existent-prod', 'LOT-LECHE-ALPHA'), null);
  assert.equal(getBatchByProductAndLot('prod-001', 'LOT-NOT-REAL'), null);

  // Exact match
  const exact = getBatchByProductAndLot('prod-001', 'LOT-LECHE-ALPHA');
  assert.ok(exact, 'Should find batch by exact match');
  assert.equal(exact.id, batchId);
  assert.equal(exact.currentQuantity, 100);
  assert.equal(exact.product?.name, 'Leche Entera UHT 1L Cuadritos');

  // Case-insensitive match and leading/trailing whitespace handling
  const lowercasePadded = getBatchByProductAndLot('prod-001', '   lot-leche-alpha   ');
  assert.ok(lowercasePadded, 'Should find batch case-insensitively and trimmed');
  assert.equal(lowercasePadded.id, batchId);
});

test('DB: consolidateBatch sums quantity and resolves earliest expiration date by default', () => {
  const batchId = 'batch-dup-consolidate-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-FEFO-CONSOLIDATE',
    expirationDate: '2026-10-20',
    currentQuantity: 40,
  });

  // Non-existent batch ID returns null
  assert.equal(consolidateBatch('non-existent-batch-id', 20), null);

  // Consolidate with incoming date earlier than existing (2026-10-10 < 2026-10-20) -> should adopt earlier date
  const updated1 = consolidateBatch(batchId, 35, {
    expirationDate: '2026-10-10',
    updateExpirationStrategy: 'earliest',
  });
  assert.ok(updated1);
  assert.equal(updated1.currentQuantity, 75); // 40 + 35
  assert.equal(updated1.expirationDate, '2026-10-10');

  // Verify in database
  const inDb1 = getBatchById(batchId);
  assert.equal(inDb1?.currentQuantity, 75);
  assert.equal(inDb1?.expirationDate, '2026-10-10');

  // Consolidate with incoming date later than existing (2026-10-25 > 2026-10-10) with 'earliest' -> keeps 2026-10-10
  const updated2 = consolidateBatch(batchId, 25, {
    expirationDate: '2026-10-25',
    updateExpirationStrategy: 'earliest',
  });
  assert.ok(updated2);
  assert.equal(updated2.currentQuantity, 100);
  assert.equal(updated2.expirationDate, '2026-10-10');

  // Strategy 'incoming' forces incoming date
  const updated3 = consolidateBatch(batchId, 10, {
    expirationDate: '2026-11-01',
    updateExpirationStrategy: 'incoming',
  });
  assert.ok(updated3);
  assert.equal(updated3.expirationDate, '2026-11-01');

  // Strategy 'keep' retains existing date
  const updated4 = consolidateBatch(batchId, 5, {
    expirationDate: '2026-09-01',
    updateExpirationStrategy: 'keep',
  });
  assert.ok(updated4);
  assert.equal(updated4.expirationDate, '2026-11-01');
});

test('API POST /api/inventory: Fast pre-check (action: "check") detects existing lot', async () => {
  const batchId = 'batch-precheck-01';
  createBatch({
    id: batchId,
    productId: 'prod-002',
    lotCode: 'LOT-CHECK-001',
    expirationDate: '2026-11-10',
    currentQuantity: 60,
  });

  // Check with existing lot
  const checkReq1 = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check',
      productId: 'prod-002',
      lotCode: 'lot-check-001',
    }),
  });
  const res1 = await receiveBatchHandler(checkReq1);
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.duplicateFound, true);
  assert.ok(data1.existingBatch);
  assert.equal(data1.existingBatch.id, batchId);
  assert.equal(data1.existingBatch.currentQuantity, 60);
  assert.ok(typeof data1.existingBatch.daysRemaining === 'number');
  assert.ok(data1.existingBatch.status);

  // Check with non-existing lot
  const checkReq2 = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check',
      productId: 'prod-002',
      lotCode: 'LOT-COMPLETELY-NEW',
    }),
  });
  const res2 = await receiveBatchHandler(checkReq2);
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.duplicateFound, false);
  assert.equal(data2.existingBatch, null);

  // Check missing required fields
  const badReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check',
      productId: 'prod-002',
    }),
  });
  const badRes = await receiveBatchHandler(badReq);
  assert.equal(badRes.status, 400);
});

test('API POST /api/inventory: Collision detection returns HTTP 409 Conflict when duplicate lot posted without action', async () => {
  const batchId = 'batch-collision-test-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-COLLISION-99',
    expirationDate: '2026-10-30',
    currentQuantity: 50,
  });

  const duplicateReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'prod-001',
      lotCode: 'LOT-COLLISION-99',
      expirationDate: '2026-10-25',
      currentQuantity: 30,
    }),
  });

  const res = await receiveBatchHandler(duplicateReq);
  assert.equal(res.status, 409, 'Duplicate batch entry should return 409 Conflict');

  const data = await res.json();
  assert.equal(data.duplicateDetected, true);
  assert.ok(data.error.includes('Lote existente detectado'));
  assert.ok(data.existingBatch, 'Response must include existingBatch');
  assert.equal(data.existingBatch.id, batchId);
  assert.equal(data.existingBatch.currentQuantity, 50);
  assert.ok(data.message.includes('LOT-COLLISION-99'));
});

test('API POST /api/inventory: Consolidation (action: "consolidate") merges quantity and updates batch', async () => {
  const batchId = 'batch-consolidate-api-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-CONSOLIDATE-API',
    expirationDate: '2026-10-30',
    currentQuantity: 50,
  });

  const consolidateReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'prod-001',
      lotCode: 'LOT-CONSOLIDATE-API',
      expirationDate: '2026-10-20',
      currentQuantity: 35,
      action: 'consolidate',
    }),
  });

  const res = await receiveBatchHandler(consolidateReq);
  assert.equal(res.status, 200, 'Consolidation should return 200 OK');

  const data = await res.json();
  assert.equal(data.consolidated, true);
  assert.equal(data.previousQuantity, 50);
  assert.equal(data.addedQuantity, 35);
  assert.equal(data.currentQuantity, 85);
  assert.equal(data.expirationDate, '2026-10-20'); // Earliest expiration kept
  assert.ok(data.message.includes('Se sumaron 35'));

  // Verify in database
  const inDb = getBatchById(batchId);
  assert.ok(inDb);
  assert.equal(inDb.currentQuantity, 85);
  assert.equal(inDb.expirationDate, '2026-10-20');
});

test('API POST /api/inventory: Independent entry (action: "create_new") creates separate batch row', async () => {
  const batchId = 'batch-independent-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-SEPARATE-API',
    expirationDate: '2026-10-30',
    currentQuantity: 50,
  });

  const separateReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'prod-001',
      lotCode: 'LOT-SEPARATE-API',
      expirationDate: '2026-11-15',
      currentQuantity: 25,
      action: 'create_new',
    }),
  });

  const res = await receiveBatchHandler(separateReq);
  assert.equal(res.status, 201, 'Create separate batch should return 201 Created');

  const data = await res.json();
  assert.notEqual(data.id, batchId, 'New batch must have its own unique ID');
  assert.equal(data.isDuplicateLot, true);
  assert.equal(data.consolidated, false);
  assert.equal(data.currentQuantity, 25);

  // Check original batch was untouched
  const original = getBatchById(batchId);
  assert.equal(original?.currentQuantity, 50);

  // Check newly created batch exists in database
  const separateBatch = getBatchById(data.id);
  assert.ok(separateBatch);
  assert.equal(separateBatch.lotCode, 'LOT-SEPARATE-API');
  assert.equal(separateBatch.currentQuantity, 25);
});

test('UI Component: recepcion/page.tsx integrates collision modal, consolidation handlers, and badges', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'recepcion/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // State checks
  assert.ok(content.includes('duplicateCollisionModal'), 'Must have duplicateCollisionModal state');
  assert.ok(content.includes('isResolvingCollision'), 'Must have isResolvingCollision state');

  // Handlers checks
  assert.ok(content.includes('handleConfirmConsolidate'), 'Must define handleConfirmConsolidate');
  assert.ok(content.includes('handleConfirmCreateSeparate'), 'Must define handleConfirmCreateSeparate');
  assert.ok(content.includes('handleCancelCollision'), 'Must define handleCancelCollision');

  // Modal checks
  assert.ok(
    content.includes('title="Lote Existente Detectado en Almacén"'),
    'Modal must have title "Lote Existente Detectado en Almacén"'
  );
  assert.ok(
    content.includes('Sumar al Lote Existente (Recomendado WMS)'),
    'Modal must include primary button "Sumar al Lote Existente (Recomendado WMS)"'
  );
  assert.ok(
    content.includes('Crear como Lote Separado'),
    'Modal must include secondary button "Crear como Lote Separado"'
  );
  assert.ok(
    content.includes('Cancelar / Corregir Folio'),
    'Modal must include cancel button "Cancelar / Corregir Folio"'
  );

  // Tactile feedback classes
  assert.ok(
    content.includes('active:scale-[0.98]'),
    'Buttons in collision modal must include active:scale-[0.98] tactile feedback'
  );

  // Success Banner checks
  assert.ok(
    content.includes('¡Lote Consolidado en Bodega!'),
    'Must include distinctive banner text "¡Lote Consolidado en Bodega!"'
  );
  assert.ok(
    content.includes('Existencia total en bodega'),
    'Must show total warehouse existence in consolidated banner'
  );
});
