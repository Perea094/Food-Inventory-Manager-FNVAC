import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sortInventoryBatches,
  calculateDaysRemaining,
  getFEFOStatus,
} from '../src/lib/fefo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Sample test batches with various statuses, days, products, lots, quantities, donors, locations
function createSampleBatches() {
  return [
    {
      id: 'b-1',
      productId: 'p-1',
      lotCode: 'LOT-C',
      expirationDate: '2026-09-20',
      daysRemaining: 2,
      status: 'CRITICO',
      currentQuantity: 100,
      receivedAt: '2026-09-01',
      product: {
        id: 'p-1',
        barcode: '111',
        name: 'Zanahorias Frescas',
        donorType: 'Cuadritos',
        category: 'AGRICOLA_PERECEDERO',
        unit: 'kilos',
        storageArea: 'Camara_Fria',
        minStock: 20,
        createdAt: '2026-01-01',
      },
    },
    {
      id: 'b-2',
      productId: 'p-2',
      lotCode: 'LOT-A',
      expirationDate: '2026-09-22',
      daysRemaining: 4,
      status: 'ATENCION',
      currentQuantity: 50,
      receivedAt: '2026-09-01',
      product: {
        id: 'p-2',
        barcode: '222',
        name: 'Arroz Grano Fino',
        donorType: 'Nutrivida',
        category: 'SECO_ABARROTE',
        unit: 'kilos',
        storageArea: 'Nave_Secos',
        minStock: 50,
        createdAt: '2026-01-01',
      },
    },
    {
      id: 'b-3',
      productId: 'p-3',
      lotCode: 'LOT-B',
      expirationDate: '2026-10-15',
      daysRemaining: 27,
      status: 'ESTABLE',
      currentQuantity: 300,
      receivedAt: '2026-09-01',
      product: {
        id: 'p-3',
        barcode: '333',
        name: 'Leche Entera UHT',
        donorType: 'Campo del Bajío',
        category: 'LACTEO_FRIO',
        unit: 'litros',
        storageArea: 'Anden',
        minStock: 100,
        createdAt: '2026-01-01',
      },
    },
    {
      id: 'b-4',
      productId: 'p-4',
      lotCode: 'LOT-D',
      expirationDate: '2026-09-19',
      daysRemaining: 1,
      status: 'CRITICO',
      currentQuantity: 20,
      receivedAt: '2026-09-01',
      product: {
        id: 'p-4',
        barcode: '444',
        name: 'Manzanas Rojas',
        donorType: 'Donación Central',
        category: 'AGRICOLA_PERECEDERO',
        unit: 'kilos',
        storageArea: 'Camara_Fria',
        minStock: 10,
        createdAt: '2026-01-01',
      },
    },
    {
      id: 'b-5',
      productId: 'p-5',
      lotCode: 'LOT-E',
      expirationDate: '2026-09-10',
      daysRemaining: -8,
      status: 'AGOTADO',
      currentQuantity: 0,
      receivedAt: '2026-09-01',
      product: {
        id: 'p-5',
        barcode: '555',
        name: 'Frijol Negro',
        donorType: 'Campaña Escolar',
        category: 'SECO_ABARROTE',
        unit: 'kilos',
        storageArea: 'Nave_Secos',
        minStock: 10,
        createdAt: '2026-01-01',
      },
    },
  ];
}

// -------------------------------------------------------------
// Unit Tests: sortInventoryBatches logic
// -------------------------------------------------------------

test('sortInventoryBatches: defaults to fefo asc (critical priority, then days)', () => {
  const batches = createSampleBatches();
  const sorted = sortInventoryBatches(batches);

  // CRITICO batches: b-4 (1 day), b-1 (2 days)
  // ATENCION: b-2 (4 days)
  // ESTABLE: b-3 (27 days)
  // AGOTADO: b-5 (0 qty)
  assert.equal(sorted[0].id, 'b-4');
  assert.equal(sorted[1].id, 'b-1');
  assert.equal(sorted[2].id, 'b-2');
  assert.equal(sorted[3].id, 'b-3');
  assert.equal(sorted[4].id, 'b-5');
});

test('sortInventoryBatches: fefo desc inverts order for available stock while exhausted batches stay at bottom', () => {
  const batches = createSampleBatches();
  const sorted = sortInventoryBatches(batches, 'fefo', 'desc');

  // Available batches inverted: ESTABLE rank 3, ATENCION rank 2, CRITICO rank 1. Exhausted batch always last.
  assert.equal(sorted[0].id, 'b-3');
  assert.equal(sorted[1].id, 'b-2');
  assert.equal(sorted[2].id, 'b-1');
  assert.equal(sorted[3].id, 'b-4');
  assert.equal(sorted[4].id, 'b-5');
});

test('sortInventoryBatches: days asc sorts by daysRemaining ascending (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sorted = sortInventoryBatches(batches, 'days', 'asc');

  assert.equal(sorted[0].id, 'b-4'); // 1 day
  assert.equal(sorted[1].id, 'b-1'); // 2 days
  assert.equal(sorted[2].id, 'b-2'); // 4 days
  assert.equal(sorted[3].id, 'b-3'); // 27 days
  assert.equal(sorted[4].id, 'b-5'); // -8 days (exhausted at bottom)
});

test('sortInventoryBatches: days desc sorts by daysRemaining descending (farthest expiring first)', () => {
  const batches = createSampleBatches();
  const sorted = sortInventoryBatches(batches, 'days', 'desc');

  assert.equal(sorted[0].id, 'b-3'); // 27 days
  assert.equal(sorted[1].id, 'b-2'); // 4 days
  assert.equal(sorted[2].id, 'b-1'); // 2 days
  assert.equal(sorted[3].id, 'b-4'); // 1 day
  assert.equal(sorted[4].id, 'b-5'); // -8 days (exhausted at bottom)
});

test('sortInventoryBatches: product asc and desc sorts alphabetically with Spanish collation (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sortedAsc = sortInventoryBatches(batches, 'product', 'asc');
  assert.equal(sortedAsc[0].product.name, 'Arroz Grano Fino');
  assert.equal(sortedAsc[1].product.name, 'Leche Entera UHT');
  assert.equal(sortedAsc[2].product.name, 'Manzanas Rojas');
  assert.equal(sortedAsc[3].product.name, 'Zanahorias Frescas');
  assert.equal(sortedAsc[4].product.name, 'Frijol Negro'); // exhausted batch at bottom

  const sortedDesc = sortInventoryBatches(batches, 'product', 'desc');
  assert.equal(sortedDesc[0].product.name, 'Zanahorias Frescas');
  assert.equal(sortedDesc[1].product.name, 'Manzanas Rojas');
  assert.equal(sortedDesc[2].product.name, 'Leche Entera UHT');
  assert.equal(sortedDesc[3].product.name, 'Arroz Grano Fino');
  assert.equal(sortedDesc[4].product.name, 'Frijol Negro'); // exhausted batch at bottom
});

test('sortInventoryBatches: lot asc and desc sorts alphanumerically (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sortedAsc = sortInventoryBatches(batches, 'lot', 'asc');
  assert.equal(sortedAsc[0].lotCode, 'LOT-A');
  assert.equal(sortedAsc[1].lotCode, 'LOT-B');
  assert.equal(sortedAsc[2].lotCode, 'LOT-C');
  assert.equal(sortedAsc[3].lotCode, 'LOT-D');
  assert.equal(sortedAsc[4].lotCode, 'LOT-E'); // exhausted at bottom

  const sortedDesc = sortInventoryBatches(batches, 'lot', 'desc');
  assert.equal(sortedDesc[0].lotCode, 'LOT-D');
  assert.equal(sortedDesc[1].lotCode, 'LOT-C');
  assert.equal(sortedDesc[2].lotCode, 'LOT-B');
  assert.equal(sortedDesc[3].lotCode, 'LOT-A');
  assert.equal(sortedDesc[4].lotCode, 'LOT-E'); // exhausted at bottom
});

test('sortInventoryBatches: quantity asc and desc sorts numeric stock amounts (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sortedAsc = sortInventoryBatches(batches, 'quantity', 'asc');
  assert.equal(sortedAsc[0].currentQuantity, 20);  // b-4
  assert.equal(sortedAsc[1].currentQuantity, 50);  // b-2
  assert.equal(sortedAsc[2].currentQuantity, 100); // b-1
  assert.equal(sortedAsc[3].currentQuantity, 300); // b-3
  assert.equal(sortedAsc[4].currentQuantity, 0);   // b-5 exhausted at bottom

  const sortedDesc = sortInventoryBatches(batches, 'quantity', 'desc');
  assert.equal(sortedDesc[0].currentQuantity, 300);
  assert.equal(sortedDesc[1].currentQuantity, 100);
  assert.equal(sortedDesc[2].currentQuantity, 50);
  assert.equal(sortedDesc[3].currentQuantity, 20);
  assert.equal(sortedDesc[4].currentQuantity, 0);   // b-5 exhausted at bottom
});

test('sortInventoryBatches: donor asc and desc sorts donorType (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sortedAsc = sortInventoryBatches(batches, 'donor', 'asc');
  assert.equal(sortedAsc[0].product.donorType, 'Campo del Bajío');
  assert.equal(sortedAsc[1].product.donorType, 'Cuadritos');
  assert.equal(sortedAsc[2].product.donorType, 'Donación Central');
  assert.equal(sortedAsc[3].product.donorType, 'Nutrivida');
  assert.equal(sortedAsc[4].product.donorType, 'Campaña Escolar'); // exhausted at bottom

  const sortedDesc = sortInventoryBatches(batches, 'donor', 'desc');
  assert.equal(sortedDesc[0].product.donorType, 'Nutrivida');
  assert.equal(sortedDesc[1].product.donorType, 'Donación Central');
  assert.equal(sortedDesc[2].product.donorType, 'Cuadritos');
  assert.equal(sortedDesc[3].product.donorType, 'Campo del Bajío');
  assert.equal(sortedDesc[4].product.donorType, 'Campaña Escolar'); // exhausted at bottom
});

test('sortInventoryBatches: location asc and desc sorts warehouse storageArea (exhausted at bottom)', () => {
  const batches = createSampleBatches();
  const sortedAsc = sortInventoryBatches(batches, 'location', 'asc');
  assert.equal(sortedAsc[0].product.storageArea, 'Anden'); // b-3
  assert.equal(sortedAsc[4].id, 'b-5'); // exhausted at bottom

  const sortedDesc = sortInventoryBatches(batches, 'location', 'desc');
  assert.equal(sortedDesc[0].product.storageArea, 'Nave_Secos'); // b-2
  assert.equal(sortedDesc[3].product.storageArea, 'Anden'); // b-3
  assert.equal(sortedDesc[4].id, 'b-5'); // exhausted at bottom
});

test('sortInventoryBatches: universal tie-break applies daysRemaining asc, then quantity desc, then lotCode', () => {
  // Items with identical product names
  const tieBatches = [
    {
      id: 'tie-1',
      productId: 'p-1',
      lotCode: 'LOT-Z',
      expirationDate: '2026-10-01',
      daysRemaining: 10,
      currentQuantity: 50,
      product: { name: 'Manzana' },
    },
    {
      id: 'tie-2',
      productId: 'p-1',
      lotCode: 'LOT-A',
      expirationDate: '2026-09-25',
      daysRemaining: 5,
      currentQuantity: 50,
      product: { name: 'Manzana' },
    },
    {
      id: 'tie-3',
      productId: 'p-1',
      lotCode: 'LOT-M',
      expirationDate: '2026-10-01',
      daysRemaining: 10,
      currentQuantity: 100, // higher quantity
      product: { name: 'Manzana' },
    },
    {
      id: 'tie-4',
      productId: 'p-1',
      lotCode: 'LOT-B',
      expirationDate: '2026-10-01',
      daysRemaining: 10,
      currentQuantity: 50,
      product: { name: 'Manzana' },
    },
  ];

  const sorted = sortInventoryBatches(tieBatches, 'product', 'asc');

  // tie-2 has earliest expiration (5 days)
  assert.equal(sorted[0].id, 'tie-2');
  // tie-3 has higher quantity (100 vs 50) at 10 days
  assert.equal(sorted[1].id, 'tie-3');
  // tie-4 and tie-1 have same days and quantity, so tie-4 (LOT-B) comes before tie-1 (LOT-Z)
  assert.equal(sorted[2].id, 'tie-4');
  assert.equal(sorted[3].id, 'tie-1');
});

test('sortInventoryBatches: immutability check - does not mutate original array', () => {
  const original = createSampleBatches();
  const originalOrder = original.map((b) => b.id);
  const result = sortInventoryBatches(original, 'quantity', 'desc');

  assert.notEqual(result, original, 'Must return a new array');
  assert.deepEqual(original.map((b) => b.id), originalOrder, 'Original array must not be mutated');
});

// -------------------------------------------------------------
// UI Component Structure & Accessibility Tests: InventoryTable.tsx
// -------------------------------------------------------------

test('UI Component: InventoryTable.tsx has accessible Sort Bar, select options, and reset button', () => {
  const filePath = path.join(rootDir, 'src', 'components', 'InventoryTable.tsx');
  assert.ok(fs.existsSync(filePath), 'InventoryTable.tsx must exist');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify imports
  assert.ok(code.includes('ArrowUpDown'), 'InventoryTable must import ArrowUpDown');
  assert.ok(code.includes('ArrowUp'), 'InventoryTable must import ArrowUp');
  assert.ok(code.includes('ArrowDown'), 'InventoryTable must import ArrowDown');
  assert.ok(code.includes('SlidersHorizontal'), 'InventoryTable must import SlidersHorizontal');
  assert.ok(code.includes('RotateCcw'), 'InventoryTable must import RotateCcw');
  assert.ok(code.includes('sortInventoryBatches'), 'InventoryTable must import sortInventoryBatches');

  // Verify state
  assert.ok(code.includes('sortField'), 'InventoryTable must manage sortField state');
  assert.ok(code.includes('sortDirection'), 'InventoryTable must manage sortDirection state');
  assert.ok(code.includes('sortedBatches'), 'InventoryTable must compute sortedBatches via useMemo');

  // Verify Sort Bar and select
  assert.ok(code.includes('Ordenar por:'), 'InventoryTable must render "Ordenar por:" label');
  assert.ok(code.includes('inventory-sort-select'), 'InventoryTable select must have id="inventory-sort-select"');

  // Verify all required select options
  const requiredOptions = [
    'value="fefo-asc"',
    'Semáforo FEFO (Prioridad Crítica)',
    'value="fefo-desc"',
    'Semáforo FEFO (Inverso - Estables primero)',
    'value="days-asc"',
    'Caducidad (Próximos a vencer)',
    'value="days-desc"',
    'Caducidad (Más lejanos)',
    'value="product-asc"',
    'Producto (A → Z)',
    'value="product-desc"',
    'Producto (Z → A)',
    'value="quantity-desc"',
    'Existencia (Mayor a menor)',
    'value="quantity-asc"',
    'Existencia (Menor a mayor)',
    'value="lot-asc"',
    'Código de Lote (A → Z)',
  ];
  for (const opt of requiredOptions) {
    assert.ok(code.includes(opt), `InventoryTable select must contain option: ${opt}`);
  }

  // Verify toggle direction button and tactile feedback
  assert.ok(code.includes('active:scale-95 cursor-pointer'), 'InventoryTable buttons must have tactile active:scale-95');
  assert.ok(code.includes('Restablecer orden FEFO'), 'InventoryTable must render "Restablecer orden FEFO" button');

  // Verify column headers with aria-sort, role="button", and tactile classes
  assert.ok(code.includes('role="button"'), 'Headers must include role="button"');
  assert.ok(code.includes('tabIndex={0}'), 'Headers must include tabIndex={0}');
  assert.ok(code.includes('aria-sort'), 'Headers must include aria-sort');
  assert.ok(
    code.includes('cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all'),
    'Headers must include tactile interactive classes'
  );

  // Verify mapped rows use sortedBatches
  assert.ok(code.includes('sortedBatches.map'), 'InventoryTable must render sortedBatches.map');

  // Verify footer shows count and active sort label
  assert.ok(code.includes('Orden activo:'), 'InventoryTable footer must display "Orden activo:"');
});
