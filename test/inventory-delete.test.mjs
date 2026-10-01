import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DELETE as deleteBatchHandler, PATCH as updateBatchHandler } from '../src/app/api/inventory/[id]/route.ts';
import { POST as receiveBatchHandler, GET as getInventoryHandler } from '../src/app/api/inventory/route.ts';
import { getDb, getBatchById, createBatch, deleteBatch } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('API Inventory [id]: DELETE removes an existing inventory batch successfully', async () => {
  // 1. Create a test batch
  const testBatch = {
    id: 'test-batch-to-delete',
    productId: 'prod-001',
    lotCode: 'LOT-DEL-001',
    expirationDate: '2026-12-31',
    currentQuantity: 75,
  };
  createBatch(testBatch);
  assert.ok(getBatchById('test-batch-to-delete'), 'Batch should exist in database');

  // 2. Call DELETE endpoint
  const req = new Request('http://localhost:3000/api/inventory/test-batch-to-delete', {
    method: 'DELETE',
  });
  const res = await deleteBatchHandler(req, { params: { id: 'test-batch-to-delete' } });

  assert.equal(res.status, 200, 'DELETE should return 200 OK');
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.message.includes('Lote eliminado'));

  // 3. Verify batch is removed from database
  const inDb = getBatchById('test-batch-to-delete');
  assert.equal(inDb, null, 'Batch should no longer exist in database');
});

test('API Inventory [id]: DELETE returns 404 when batch does not exist', async () => {
  const req = new Request('http://localhost:3000/api/inventory/non-existent-batch-999', {
    method: 'DELETE',
  });
  const res = await deleteBatchHandler(req, { params: { id: 'non-existent-batch-999' } });

  assert.equal(res.status, 404, 'DELETE should return 404 Not Found');
  const body = await res.json();
  assert.ok(body.error, 'Response should contain error property');
  assert.ok(body.error.includes('No se encontró el lote'));
});

test('API Inventory [id]: DELETE safely removes a 6-year expired item (LOT-MERMA)', async () => {
  // 1. Insert a 6-year expired batch (e.g. from 2020)
  const expiredId = 'batch-expired-6yr';
  createBatch({
    id: expiredId,
    productId: 'prod-001',
    lotCode: 'LOT-MERMA-2020',
    expirationDate: '2020-01-01',
    currentQuantity: 15,
  });
  assert.ok(getBatchById(expiredId), 'Expired batch should exist');

  // 2. Safely delete via the DELETE API endpoint
  const req = new Request(`http://localhost:3000/api/inventory/${expiredId}`, {
    method: 'DELETE',
  });
  const res = await deleteBatchHandler(req, { params: { id: expiredId } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // 3. Verify it is completely removed
  assert.equal(getBatchById(expiredId), null);
});

test('UI Component: InventoryTable includes Trash2, onDeleteBatch, tactile classes, and aria-label', () => {
  const tablePath = path.join(rootDir, 'src', 'components', 'InventoryTable.tsx');
  assert.ok(fs.existsSync(tablePath), 'InventoryTable.tsx must exist');
  const content = fs.readFileSync(tablePath, 'utf8');

  // Verify Trash2 icon import
  assert.ok(content.includes('Trash2'), 'InventoryTable.tsx must import Trash2 from lucide-react');

  // Verify onDeleteBatch in props interface
  assert.ok(
    content.includes('onDeleteBatch?: (batch: InventoryBatch) => void;'),
    'InventoryTableProps must define onDeleteBatch prop'
  );

  // Verify onDeleteBatch destructuring
  assert.ok(
    content.includes('onDeleteBatch,'),
    'InventoryTable must destructure onDeleteBatch'
  );

  // Verify action button with tactile classes
  assert.ok(
    content.includes('active:scale-95'),
    'InventoryTable delete button must have active:scale-95 tactile feedback class'
  );
  assert.ok(
    content.includes('hover:text-red-600'),
    'InventoryTable delete button must have hover:text-red-600 red color hover styling'
  );
  assert.ok(
    content.includes('hover:bg-red-50'),
    'InventoryTable delete button must have hover:bg-red-50 hover background'
  );
  assert.ok(
    content.includes('title="Eliminar lote de inventario"'),
    'InventoryTable delete button must have title="Eliminar lote de inventario"'
  );
  assert.ok(
    content.includes('aria-label="Eliminar lote de inventario"'),
    'InventoryTable delete button must have aria-label="Eliminar lote de inventario"'
  );
});

test('UI Component: DashboardPage (page.tsx) includes batch deletion modal, handlers, and tactile feedback', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify state
  assert.ok(content.includes('deletingBatch'), 'page.tsx must contain deletingBatch state');
  assert.ok(content.includes('isDeleting'), 'page.tsx must contain isDeleting state');
  assert.ok(content.includes('deleteError'), 'page.tsx must contain deleteError state');

  // Verify handlers
  assert.ok(content.includes('handleOpenDeleteBatch'), 'page.tsx must contain handleOpenDeleteBatch handler');
  assert.ok(content.includes('handleCloseDeleteBatch'), 'page.tsx must contain handleCloseDeleteBatch handler');
  assert.ok(content.includes('handleConfirmDelete'), 'page.tsx must contain handleConfirmDelete handler');

  // Verify passing onDeleteBatch to InventoryTable
  assert.ok(
    content.includes('onDeleteBatch={handleOpenDeleteBatch}'),
    'page.tsx must pass onDeleteBatch to InventoryTable'
  );

  // Verify modal elements and copy
  assert.ok(
    content.includes('title="Confirmar Eliminación de Registro de Inventario"'),
    'page.tsx must define delete confirmation modal with correct title'
  );
  assert.ok(
    content.includes('Esta acción eliminará permanentemente este registro de lote de la base de datos.'),
    'page.tsx must define delete confirmation modal with correct description'
  );
  assert.ok(
    content.includes('Atención: Esta acción es irreversible'),
    'page.tsx must display irreversible action warning banner'
  );
  assert.ok(
    content.includes('Eliminar Registro'),
    'page.tsx modal must have "Eliminar Registro" submit button'
  );
  assert.ok(
    content.includes('Cancelar'),
    'page.tsx modal must have "Cancelar" dismiss button'
  );
  assert.ok(
    content.includes('active:scale-[0.98]'),
    'page.tsx modal buttons must have active:scale-[0.98] tactile feedback'
  );
  assert.ok(
    content.includes('bg-red-600'),
    'page.tsx modal confirm button must have bg-red-600 styling'
  );
});
