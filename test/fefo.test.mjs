import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDaysRemaining,
  getFEFOStatus,
  isAlreadyExpired,
  sortBatchesFEFO,
  filterByStorageArea,
  calculateInventoryKPIs,
} from '../src/lib/fefo.ts';

test('FEFO: calculateDaysRemaining with fixed base date', () => {
  const base = new Date('2026-09-17T12:00:00Z');

  assert.equal(calculateDaysRemaining('2026-09-19', base), 2);
  assert.equal(calculateDaysRemaining('2026-09-22', base), 5);
  assert.equal(calculateDaysRemaining('2026-09-17', base), 0);
  assert.equal(calculateDaysRemaining('2026-09-14', base), -3);
});

test('FEFO: getFEFOStatus classification rules', () => {
  // Exhausted stock takes absolute priority
  assert.equal(getFEFOStatus(1, 0), 'AGOTADO');
  assert.equal(getFEFOStatus(30, -5), 'AGOTADO');

  // CRITICO: <= 3 days
  assert.equal(getFEFOStatus(1, 10), 'CRITICO');
  assert.equal(getFEFOStatus(2, 50), 'CRITICO');
  assert.equal(getFEFOStatus(3, 100), 'CRITICO');
  assert.equal(getFEFOStatus(-1, 20), 'CRITICO');

  // ATENCION: 4 to 7 days
  assert.equal(getFEFOStatus(4, 15), 'ATENCION');
  assert.equal(getFEFOStatus(5, 45), 'ATENCION');
  assert.equal(getFEFOStatus(7, 30), 'ATENCION');

  // ESTABLE: > 7 days
  assert.equal(getFEFOStatus(8, 80), 'ESTABLE');
  assert.equal(getFEFOStatus(30, 200), 'ESTABLE');
  assert.equal(getFEFOStatus(180, 500), 'ESTABLE');
});

test('FEFO: isAlreadyExpired', () => {
  const base = new Date('2026-09-17T10:00:00Z');

  assert.equal(isAlreadyExpired('2026-09-16', base), true);
  assert.equal(isAlreadyExpired('2026-09-10', base), true);
  assert.equal(isAlreadyExpired('2026-09-17', base), false);
  assert.equal(isAlreadyExpired('2026-09-18', base), false);
});

test('FEFO: sortBatchesFEFO orders earliest expiration first', () => {
  const batches = [
    { id: 'b3', expirationDate: '2026-10-15', currentQuantity: 100 },
    { id: 'b1', expirationDate: '2026-09-19', currentQuantity: 20 },
    { id: 'b4', expirationDate: '2026-12-01', currentQuantity: 50 },
    { id: 'b2', expirationDate: '2026-09-22', currentQuantity: 30 },
  ];

  const sorted = sortBatchesFEFO(batches);

  assert.equal(sorted[0].id, 'b1');
  assert.equal(sorted[1].id, 'b2');
  assert.equal(sorted[2].id, 'b3');
  assert.equal(sorted[3].id, 'b4');

  // Verify immutability
  assert.notEqual(sorted, batches);
  assert.equal(batches[0].id, 'b3');
});

test('FEFO: filterByStorageArea filters correctly', () => {
  const batches = [
    { id: 'b1', product: { storageArea: 'Camara_Fria' } },
    { id: 'b2', product: { storageArea: 'Nave_Secos' } },
    { id: 'b3', product: { storageArea: 'Anden' } },
    { id: 'b4', product: { storageArea: 'Camara_Fria' } },
  ];

  const coldBatches = filterByStorageArea(batches, 'Camara_Fria');
  assert.equal(coldBatches.length, 2);
  assert.equal(coldBatches[0].id, 'b1');
  assert.equal(coldBatches[1].id, 'b4');

  const dryBatches = filterByStorageArea(batches, 'Nave_Secos');
  assert.equal(dryBatches.length, 1);
  assert.equal(dryBatches[0].id, 'b2');
});

test('FEFO: calculateInventoryKPIs provides accurate dashboard metrics', () => {
  const base = new Date('2026-09-17T00:00:00Z');
  const batches = [
    {
      id: 'b1',
      expirationDate: '2026-09-19', // 2 days -> CRITICO
      currentQuantity: 50,
      product: { storageArea: 'Camara_Fria' },
    },
    {
      id: 'b2',
      expirationDate: '2026-09-22', // 5 days -> ATENCION
      currentQuantity: 100,
      product: { storageArea: 'Camara_Fria' },
    },
    {
      id: 'b3',
      expirationDate: '2026-10-30', // > 7 days -> ESTABLE
      currentQuantity: 200,
      product: { storageArea: 'Nave_Secos' },
    },
  ];

  const kpis = calculateInventoryKPIs(batches, base);

  assert.equal(kpis.totalQuantity, 350);
  assert.equal(kpis.criticalBatchesCount, 1);
  assert.equal(kpis.warningBatchesCount, 1);
  assert.equal(kpis.stableBatchesCount, 1);
  assert.equal(kpis.coldRoomCount, 150);
  assert.equal(kpis.dryStorageCount, 200);
});
