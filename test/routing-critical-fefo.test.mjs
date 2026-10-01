import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isBatchExpiredForDispatch,
  filterCriticalBatchesForRouting,
} from '../src/lib/routing.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Routing FEFO: isBatchExpiredForDispatch identifies expired batches accurately', () => {
  const baseDate = new Date('2026-09-18T12:00:00Z');

  // 1. Explicit status 'VENCIDO'
  assert.equal(
    isBatchExpiredForDispatch({ status: 'VENCIDO', expirationDate: '2026-09-25' }, baseDate),
    true,
    'Status VENCIDO should always be marked as expired'
  );

  // 2. Negative daysRemaining
  assert.equal(
    isBatchExpiredForDispatch({ daysRemaining: -1, expirationDate: '2026-09-25' }, baseDate),
    true,
    'Negative daysRemaining (-1) must be marked as expired'
  );
  assert.equal(
    isBatchExpiredForDispatch({ daysRemaining: -10 }, baseDate),
    true,
    'Negative daysRemaining (-10) without expirationDate must be marked as expired'
  );

  // 3. Past expirationDate relative to baseDate
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2026-09-17' }, baseDate),
    true,
    'Date prior to baseDate must be marked as expired'
  );
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2020-01-01' }, baseDate),
    true,
    'Date from years ago must be marked as expired'
  );

  // 4. Borderline: expires today (0 days remaining)
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2026-09-18', daysRemaining: 0 }, baseDate),
    false,
    'Batch expiring today (0 days) is not yet expired for dispatch'
  );

  // 5. Active future batches
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2026-09-20', daysRemaining: 2, status: 'CRITICO' }, baseDate),
    false,
    'Critical batch within valid date is not expired'
  );
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2026-09-24', daysRemaining: 6, status: 'ATENCION' }, baseDate),
    false,
    'Warning batch within valid date is not expired'
  );
  assert.equal(
    isBatchExpiredForDispatch({ expirationDate: '2026-10-15', daysRemaining: 27, status: 'ESTABLE' }, baseDate),
    false,
    'Stable batch within valid date is not expired'
  );
});

test('Routing FEFO: filterCriticalBatchesForRouting shields against expired items and selects only valid critical stock', () => {
  const baseDate = new Date('2026-09-18T12:00:00Z');

  const testBatches = [
    // 0 quantity - should be skipped completely
    {
      id: 'batch-zero-stock',
      lotCode: 'LOT-EMPTY',
      currentQuantity: 0,
      expirationDate: '2026-09-20',
      daysRemaining: 2,
      status: 'CRITICO',
    },
    // Expired by negative daysRemaining (-2 days)
    {
      id: 'batch-exp-neg-days',
      lotCode: 'LOT-EXP-1',
      currentQuantity: 15,
      expirationDate: '2026-09-16',
      daysRemaining: -2,
      status: 'CRITICO',
    },
    // Expired by past date ('2026-09-10')
    {
      id: 'batch-exp-past-date',
      lotCode: 'LOT-EXP-2',
      currentQuantity: 50,
      expirationDate: '2026-09-10',
      status: 'ATENCION',
    },
    // Expired by explicit status 'VENCIDO'
    {
      id: 'batch-exp-vencido-status',
      lotCode: 'LOT-EXP-3',
      currentQuantity: 30,
      expirationDate: '2026-09-19',
      daysRemaining: 1,
      status: 'VENCIDO',
    },
    // Valid Critical: 0 days remaining (expires today)
    {
      id: 'batch-valid-today',
      lotCode: 'LOT-TODAY',
      currentQuantity: 25,
      expirationDate: '2026-09-18',
      daysRemaining: 0,
      status: 'CRITICO',
    },
    // Valid Critical: 2 days remaining
    {
      id: 'batch-valid-crit-2d',
      lotCode: 'LOT-CRIT-2D',
      currentQuantity: 80,
      expirationDate: '2026-09-20',
      daysRemaining: 2,
      status: 'CRITICO',
    },
    // Valid Attention: 6 days remaining
    {
      id: 'batch-valid-atn-6d',
      lotCode: 'LOT-ATN-6D',
      currentQuantity: 120,
      expirationDate: '2026-09-24',
      daysRemaining: 6,
      status: 'ATENCION',
    },
    // Stable: 14 days remaining - should be excluded from critical load, NOT counted as expired
    {
      id: 'batch-valid-stable-14d',
      lotCode: 'LOT-STABLE-14D',
      currentQuantity: 200,
      expirationDate: '2026-10-02',
      daysRemaining: 14,
      status: 'ESTABLE',
    },
  ];

  const result = filterCriticalBatchesForRouting(testBatches, baseDate);

  // Exactly 3 expired batches should be omitted
  assert.equal(result.expiredExcludedCount, 3, 'Should count exactly 3 expired batches in critical window');

  // Exactly 3 eligible batches should be included: LOT-TODAY, LOT-CRIT-2D, LOT-ATN-6D
  assert.equal(result.eligibleBatches.length, 3, 'Should include exactly 3 eligible critical batches');

  const eligibleIds = result.eligibleBatches.map((b) => b.id);
  assert.ok(eligibleIds.includes('batch-valid-today'));
  assert.ok(eligibleIds.includes('batch-valid-crit-2d'));
  assert.ok(eligibleIds.includes('batch-valid-atn-6d'));

  // Ensure no expired batches leak in
  assert.ok(!eligibleIds.includes('batch-exp-neg-days'));
  assert.ok(!eligibleIds.includes('batch-exp-past-date'));
  assert.ok(!eligibleIds.includes('batch-exp-vencido-status'));
  assert.ok(!eligibleIds.includes('batch-zero-stock'));
  assert.ok(!eligibleIds.includes('batch-valid-stable-14d'));
});

test('Routing FEFO: filterCriticalBatchesForRouting handles all-expired edge case', () => {
  const baseDate = new Date('2026-09-18T12:00:00Z');

  const allExpiredBatches = [
    {
      id: 'b-exp-1',
      lotCode: 'EXP-1',
      currentQuantity: 10,
      expirationDate: '2026-09-15',
      daysRemaining: -3,
      status: 'CRITICO',
    },
    {
      id: 'b-exp-2',
      lotCode: 'EXP-2',
      currentQuantity: 20,
      expirationDate: '2026-09-14',
      daysRemaining: -4,
      status: 'ATENCION',
    },
  ];

  const result = filterCriticalBatchesForRouting(allExpiredBatches, baseDate);
  assert.equal(result.eligibleBatches.length, 0, 'No batches should be eligible');
  assert.equal(result.expiredExcludedCount, 2, 'All 2 expired batches must be tracked');
});

test('Routing FEFO: filterCriticalBatchesForRouting handles no-critical batches edge case', () => {
  const baseDate = new Date('2026-09-18T12:00:00Z');

  const stableBatches = [
    {
      id: 'b-stb-1',
      lotCode: 'STB-1',
      currentQuantity: 50,
      expirationDate: '2026-10-30',
      daysRemaining: 42,
      status: 'ESTABLE',
    },
  ];

  const result = filterCriticalBatchesForRouting(stableBatches, baseDate);
  assert.equal(result.eligibleBatches.length, 0);
  assert.equal(result.expiredExcludedCount, 0);
});

test('Routing FEFO UI Integration: rutas/page.tsx enforces expiration shielding across all interaction points', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'rutas', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'rutas/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // 1. Correct imports from routing.ts
  assert.ok(
    content.includes('isBatchExpiredForDispatch'),
    'rutas/page.tsx must import isBatchExpiredForDispatch'
  );
  assert.ok(
    content.includes('filterCriticalBatchesForRouting'),
    'rutas/page.tsx must import filterCriticalBatchesForRouting'
  );

  // 2. loadCriticalBatches uses filterCriticalBatchesForRouting and reports omitted batches
  assert.ok(
    content.includes('filterCriticalBatchesForRouting(batchList)'),
    'loadCriticalBatches must call filterCriticalBatchesForRouting'
  );
  assert.ok(
    content.includes('inocuidad alimentaria'),
    'Feedback message must communicate food safety compliance when expired items are omitted'
  );

  // 3. handleAddBatch blocks expired batches
  assert.ok(
    content.includes('isBatchExpiredForDispatch(found)'),
    'handleAddBatch must check isBatchExpiredForDispatch for individual batch addition'
  );
  assert.ok(
    content.includes('el producto ya expiró y no es apto para donación o distribución'),
    'handleAddBatch must display explanatory rejection message'
  );

  // 4. Batch select dropdown disables expired items and shows visual warning
  assert.ok(
    content.includes('const isExpired = isBatchExpiredForDispatch(b);'),
    'Batch select dropdown must compute isBatchExpiredForDispatch for each option'
  );
  assert.ok(
    content.includes('disabled={isExpired}'),
    'Expired options in select dropdown must have disabled={isExpired}'
  );
  assert.ok(
    content.includes('🚫 [VENCIDO - NO DESPACHAR]'),
    'Expired options must display warning prefix in select label'
  );

  // 5. handleConfirmDispatch safety shield against expired items in cargo
  assert.ok(
    content.includes('cargoItems.some((item) => isBatchExpiredForDispatch(item))'),
    'handleConfirmDispatch must verify no expired items exist in cargo before dispatch'
  );
  assert.ok(
    content.includes('La carga contiene lotes expirados. Retíralos antes de despachar.'),
    'handleConfirmDispatch must show error message when expired items are present'
  );

  // 6. initialBatchId query param guard
  assert.ok(
    content.includes('isBatchExpiredForDispatch(targetBatch)'),
    'Initial batch query param must verify batch is not expired before adding to cargo'
  );
  assert.ok(
    content.includes('El lote solicitado ya expiró y no es apto para distribución.'),
    'Initial batch query param must set error message if expired'
  );
});
