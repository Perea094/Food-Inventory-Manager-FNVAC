import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sortBatchesFEFO,
  sortInventoryBatches,
  calculateInventoryKPIs,
} from '../src/lib/fefo.ts';
import { getDb, createBatch } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';
import { GET as getInventory } from '../src/app/api/inventory/route.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

// -------------------------------------------------------------
// 1. sortBatchesFEFO: stock availability takes absolute priority
// -------------------------------------------------------------

test('FEFO: sortBatchesFEFO places exhausted batches at the bottom even when expiration date is earlier', () => {
  const batches = [
    {
      id: 'exhausted-early',
      lotCode: 'LOT-EXH-1',
      expirationDate: '2026-09-18', // Expiring tomorrow!
      currentQuantity: 0,           // Out of stock
    },
    {
      id: 'instock-later',
      lotCode: 'LOT-STK-1',
      expirationDate: '2026-09-30', // Expiring in 13 days
      currentQuantity: 45,          // Has stock
    },
    {
      id: 'instock-soon',
      lotCode: 'LOT-STK-2',
      expirationDate: '2026-09-20', // Expiring in 3 days
      currentQuantity: 10,          // Has stock
    },
    {
      id: 'exhausted-past',
      lotCode: 'LOT-EXH-2',
      expirationDate: '2026-09-10', // Past expiration
      currentQuantity: 0,           // Out of stock
    },
  ];

  const sorted = sortBatchesFEFO(batches);

  // In-stock batches must come first, ordered by expiration
  assert.equal(sorted[0].id, 'instock-soon');
  assert.equal(sorted[1].id, 'instock-later');

  // Exhausted batches must come last, ordered by expiration
  assert.equal(sorted[2].id, 'exhausted-past');
  assert.equal(sorted[3].id, 'exhausted-early');
});

// -------------------------------------------------------------
// 2. sortInventoryBatches: exhausted batches at the bottom across all sort fields
// -------------------------------------------------------------

test('sortInventoryBatches places exhausted batches at the bottom across all sort fields (fefo, days, quantity, product)', () => {
  const batches = [
    {
      id: 'b-active-1',
      productId: 'p-1',
      lotCode: 'LOT-A1',
      expirationDate: '2026-09-21',
      daysRemaining: 3,
      status: 'CRITICO',
      currentQuantity: 80,
      product: { name: 'Queso Panela', category: 'LACTEO_FRIO' },
    },
    {
      id: 'b-exhausted-0qty',
      productId: 'p-2',
      lotCode: 'LOT-E0',
      expirationDate: '2026-09-18',
      daysRemaining: 0,
      status: 'AGOTADO',
      currentQuantity: 0,
      product: { name: 'Acelga Fresca', category: 'AGRICOLA_PERECEDERO' },
    },
    {
      id: 'b-active-2',
      productId: 'p-3',
      lotCode: 'LOT-A2',
      expirationDate: '2026-10-10',
      daysRemaining: 22,
      status: 'ESTABLE',
      currentQuantity: 15,
      product: { name: 'Zanahorias', category: 'AGRICOLA_PERECEDERO' },
    },
    {
      id: 'b-exhausted-negative',
      productId: 'p-4',
      lotCode: 'LOT-E1',
      expirationDate: '2026-09-12',
      daysRemaining: -6,
      status: 'AGOTADO',
      currentQuantity: -2,
      product: { name: 'Bebida Soya', category: 'LACTEO_FRIO' },
    },
  ];

  const sortFields = ['fefo', 'days', 'quantity', 'product'];
  const directions = ['asc', 'desc'];

  for (const field of sortFields) {
    for (const dir of directions) {
      const sorted = sortInventoryBatches(batches, field, dir);

      // The top 2 elements must always be the active batches
      const topIds = [sorted[0].id, sorted[1].id];
      assert.ok(
        topIds.includes('b-active-1') && topIds.includes('b-active-2'),
        `Field "${field}" ${dir} should place active batches at the top`
      );

      // The bottom 2 elements must always be the exhausted batches
      const bottomIds = [sorted[2].id, sorted[3].id];
      assert.ok(
        bottomIds.includes('b-exhausted-0qty') && bottomIds.includes('b-exhausted-negative'),
        `Field "${field}" ${dir} should place exhausted batches at the bottom`
      );
    }
  }
});

// -------------------------------------------------------------
// 3. calculateInventoryKPIs: tracks exhaustedBatchesCount
// -------------------------------------------------------------

test('FEFO: calculateInventoryKPIs accurately tracks exhaustedBatchesCount', () => {
  const base = new Date('2026-09-17T00:00:00Z');
  const batches = [
    {
      id: 'b1',
      expirationDate: '2026-09-19',
      currentQuantity: 50,
      product: { storageArea: 'Camara_Fria' },
    },
    {
      id: 'b2',
      expirationDate: '2026-09-22',
      currentQuantity: 0, // Exhausted
      product: { storageArea: 'Camara_Fria' },
    },
    {
      id: 'b3',
      expirationDate: '2026-10-30',
      currentQuantity: 0, // Exhausted
      product: { storageArea: 'Nave_Secos' },
    },
  ];

  const kpis = calculateInventoryKPIs(batches, base);
  assert.equal(kpis.exhaustedBatchesCount, 2);
  assert.equal(kpis.criticalBatchesCount, 1);
  assert.equal(kpis.totalQuantity, 50);
});

// -------------------------------------------------------------
// 4. API: GET /api/inventory?hideExhausted=true filters out 0-quantity batches
// -------------------------------------------------------------

test('API Inventory: GET /api/inventory?hideExhausted=true filters out 0-quantity batches', async () => {
  // Add an exhausted batch to the database
  const exhaustedId = 'batch-exh-test-999';
  createBatch({
    id: exhaustedId,
    productId: 'prod-001',
    lotCode: 'LT-EXH-999',
    expirationDate: '2026-09-25',
    currentQuantity: 0,
    receivedAt: new Date().toISOString(),
  });

  // 1. Without hideExhausted (default/false), the exhausted batch is present
  const reqAll = new Request('http://localhost:3000/api/inventory?hideExhausted=false');
  const resAll = await getInventory(reqAll);
  assert.equal(resAll.status, 200);
  const dataAll = await resAll.json();
  const foundInAll = dataAll.batches.some((b) => b.id === exhaustedId);
  assert.equal(foundInAll, true, 'Exhausted batch should be returned when hideExhausted=false');

  // 2. With hideExhausted=true, the exhausted batch must be filtered out
  const reqHidden = new Request('http://localhost:3000/api/inventory?hideExhausted=true');
  const resHidden = await getInventory(reqHidden);
  assert.equal(resHidden.status, 200);
  const dataHidden = await resHidden.json();
  const foundInHidden = dataHidden.batches.some((b) => b.id === exhaustedId);
  assert.equal(foundInHidden, false, 'Exhausted batch must NOT be returned when hideExhausted=true');
  assert.ok(
    dataHidden.batches.every((b) => b.currentQuantity > 0 && b.status !== 'AGOTADO'),
    'All batches returned with hideExhausted=true must have stock'
  );

  // 3. When explicitly requesting status=AGOTADO, hideExhausted does not suppress results
  const reqAgotado = new Request('http://localhost:3000/api/inventory?hideExhausted=true&status=AGOTADO');
  const resAgotado = await getInventory(reqAgotado);
  assert.equal(resAgotado.status, 200);
  const dataAgotado = await resAgotado.json();
  assert.ok(dataAgotado.batches.length >= 1, 'Explicit status=AGOTADO preserves exhausted batches');
});

// -------------------------------------------------------------
// 5. UI Component verification: InventoryTable.tsx and InventoryFilters.tsx
// -------------------------------------------------------------

test('UI Component: InventoryFilters.tsx contains hideExhausted toggle and chip', () => {
  const filePath = path.join(rootDir, 'src', 'components', 'InventoryFilters.tsx');
  assert.ok(fs.existsSync(filePath), 'InventoryFilters.tsx must exist');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('hideExhausted?: boolean'), 'FilterState must declare hideExhausted');
  assert.ok(code.includes('Ocultar lotes agotados (stock 0)'), 'Must include "Ocultar lotes agotados (stock 0)" checkbox label');
  assert.ok(code.includes('active:scale-95'), 'Must contain active:scale-95 for tactile feedback');
  assert.ok(code.includes('Ocultando agotados'), 'Must render chip when hideExhausted is active');
});

test('UI Component: InventoryTable.tsx contains Ocultar agotados toggle, dimmed styling, and disabled dispatch', () => {
  const filePath = path.join(rootDir, 'src', 'components', 'InventoryTable.tsx');
  assert.ok(fs.existsSync(filePath), 'InventoryTable.tsx must exist');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('Ocultar agotados'), 'Sort Toolbar must include "Ocultar agotados" toggle');
  assert.ok(code.includes('opacity-65 bg-slate-50/80 hover:bg-slate-100 hover:opacity-90 transition-all'), 'Must include dimmed row styling');
  assert.ok(code.includes('0 (Sin stock)'), 'Must include "0 (Sin stock)" badge for exhausted rows');
  assert.ok(code.includes('opacity-40 cursor-not-allowed pointer-events-none'), 'Must disable Despachar button with opacity-40 and pointer-events-none');
  assert.ok(code.includes('Lote agotado (sin stock)'), 'Must provide tooltip "Lote agotado (sin stock)" on disabled action');
});
