import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATCH as updateBatchHandler, DELETE as deleteBatchHandler } from '../src/app/api/inventory/[id]/route.ts';
import { POST as receiveBatchHandler, GET as getInventoryHandler } from '../src/app/api/inventory/route.ts';
import { getDb, getBatchById, createBatch } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('UI Component: recepcion/page.tsx includes 8th Acciones column, Edit3, Trash2, and tactile buttons', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'recepcion/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify icon imports from lucide-react
  assert.ok(content.includes('Edit3'), 'recepcion/page.tsx must import Edit3');
  assert.ok(content.includes('Trash2'), 'recepcion/page.tsx must import Trash2');
  assert.ok(content.includes('Loader2'), 'recepcion/page.tsx must import Loader2');
  assert.ok(content.includes('Save'), 'recepcion/page.tsx must import Save');

  // Verify table header includes 8th Acciones column
  assert.ok(
    content.includes('<th className="py-2.5 px-3 text-center">Acciones</th>'),
    'Header must include 8th Acciones column'
  );

  // Verify table empty state colSpan is 8
  assert.ok(
    content.includes('colSpan={8}'),
    'Empty state must use colSpan={8}'
  );

  // Verify action buttons in table rows
  assert.ok(
    content.includes('handleOpenEditRecentBatch(batch)'),
    'Table row must wire handleOpenEditRecentBatch'
  );
  assert.ok(
    content.includes('handleOpenDeleteRecentBatch(batch)'),
    'Table row must wire handleOpenDeleteRecentBatch'
  );
  assert.ok(
    content.includes('title="Editar entrada"'),
    'Edit button must have title="Editar entrada"'
  );
  assert.ok(
    content.includes('title="Eliminar entrada"'),
    'Delete button must have title="Eliminar entrada"'
  );
  assert.ok(
    content.includes('aria-label={`Editar entrada de lote ${batch.lotCode}}`') ||
      content.includes('aria-label={`Editar entrada de lote ${batch.lotCode}`}'),
    'Edit button must have accessible aria-label with lotCode'
  );
  assert.ok(
    content.includes('aria-label={`Eliminar entrada de lote ${batch.lotCode}}`') ||
      content.includes('aria-label={`Eliminar entrada de lote ${batch.lotCode}`}'),
    'Delete button must have accessible aria-label with lotCode'
  );
  assert.ok(
    content.includes('active:scale-95'),
    'Action buttons must include active:scale-95 tactile feedback class'
  );
});

test('UI Component: recepcion/page.tsx contains edit and delete states and handlers', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // State checks
  assert.ok(content.includes('editingRecentBatch'), 'Must have editingRecentBatch state');
  assert.ok(content.includes('editLotCode'), 'Must have editLotCode state');
  assert.ok(content.includes('editQuantity'), 'Must have editQuantity state');
  assert.ok(content.includes('editExpirationDate'), 'Must have editExpirationDate state');
  assert.ok(content.includes('isSavingEdit'), 'Must have isSavingEdit state');
  assert.ok(content.includes('editError'), 'Must have editError state');

  assert.ok(content.includes('deletingRecentBatch'), 'Must have deletingRecentBatch state');
  assert.ok(content.includes('isDeletingRecent'), 'Must have isDeletingRecent state');
  assert.ok(content.includes('deleteRecentError'), 'Must have deleteRecentError state');

  // Handlers checks
  assert.ok(content.includes('handleOpenEditRecentBatch'), 'Must define handleOpenEditRecentBatch');
  assert.ok(content.includes('handleCloseEditRecentBatch'), 'Must define handleCloseEditRecentBatch');
  assert.ok(content.includes('handleSaveEditRecentBatch'), 'Must define handleSaveEditRecentBatch');
  assert.ok(content.includes('handleOpenDeleteRecentBatch'), 'Must define handleOpenDeleteRecentBatch');
  assert.ok(content.includes('handleCloseDeleteRecentBatch'), 'Must define handleCloseDeleteRecentBatch');
  assert.ok(content.includes('handleConfirmDeleteRecentBatch'), 'Must define handleConfirmDeleteRecentBatch');

  // Notifications
  assert.ok(
    content.includes('Entrada actualizada correctamente'),
    'Must notify "Entrada actualizada correctamente" on successful edit'
  );
  assert.ok(
    content.includes('Entrada eliminada correctamente'),
    'Must notify "Entrada eliminada correctamente" on successful delete'
  );
});

test('UI Component: recepcion/page.tsx defines Edit Modal and Delete Modal with required elements', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Edit Modal
  assert.ok(
    content.includes('title="Editar Entrada de Recepción"'),
    'Edit modal must have title="Editar Entrada de Recepción"'
  );
  assert.ok(
    content.includes('description="Modifica los datos del lote recibido recientemente."'),
    'Edit modal must have description="Modifica los datos del lote recibido recientemente."'
  );
  assert.ok(
    content.includes('+3d') && content.includes('+7d') && content.includes('+15d') && content.includes('+30d'),
    'Edit modal must provide quick date shortcut helper buttons (+3d, +7d, +15d, +30d)'
  );
  assert.ok(
    content.includes('Guardar Cambios'),
    'Edit modal must have "Guardar Cambios" submit button'
  );

  // Delete Modal
  assert.ok(
    content.includes('title="Eliminar Entrada de Recepción"'),
    'Delete modal must have title="Eliminar Entrada de Recepción"'
  );
  assert.ok(
    content.includes('description="¿Estás seguro de eliminar este registro del inventario?"'),
    'Delete modal must have description="¿Estás seguro de eliminar este registro del inventario?"'
  );
  assert.ok(
    content.includes('Atención: Esta acción es irreversible'),
    'Delete modal must display irreversible warning banner'
  );
  assert.ok(
    content.includes('Eliminar Registro'),
    'Delete modal must have "Eliminar Registro" action button'
  );
});

test('API Integration: PATCH /api/inventory/[id] modifies lotCode, currentQuantity, and expirationDate', async () => {
  // 1. Insert a test batch
  const batchId = 'batch-rec-edit-test-01';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-ORIG-001',
    expirationDate: '2026-10-01',
    currentQuantity: 50,
  });

  const existing = getBatchById(batchId);
  assert.ok(existing, 'Test batch should exist initially');

  // 2. PATCH the batch
  const patchReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lotCode: 'LOT-EDITED-999',
      currentQuantity: 120,
      expirationDate: '2026-11-15',
    }),
  });

  const patchRes = await updateBatchHandler(patchReq, { params: { id: batchId } });
  assert.equal(patchRes.status, 200, 'PATCH should return 200 OK');

  const updatedBody = await patchRes.json();
  assert.equal(updatedBody.lotCode, 'LOT-EDITED-999');
  assert.equal(updatedBody.currentQuantity, 120);
  assert.equal(updatedBody.expirationDate, '2026-11-15');
  assert.ok(updatedBody.status, 'Should include updated FEFO status');
  assert.ok(typeof updatedBody.daysRemaining === 'number', 'Should include recalculated daysRemaining');

  // 3. Verify in database
  const inDb = getBatchById(batchId);
  assert.ok(inDb);
  assert.equal(inDb.lotCode, 'LOT-EDITED-999');
  assert.equal(inDb.currentQuantity, 120);
  assert.equal(inDb.expirationDate, '2026-11-15');
});

test('API Integration: PATCH /api/inventory/[id] rejects negative quantity and invalid dates', async () => {
  const batchId = 'batch-rec-edit-test-02';
  createBatch({
    id: batchId,
    productId: 'prod-001',
    lotCode: 'LOT-ORIG-002',
    expirationDate: '2026-10-01',
    currentQuantity: 50,
  });

  // Test negative quantity
  const badQtyReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentQuantity: -5 }),
  });
  const badQtyRes = await updateBatchHandler(badQtyReq, { params: { id: batchId } });
  assert.equal(badQtyRes.status, 400);
  const badQtyBody = await badQtyRes.json();
  assert.ok(badQtyBody.error.includes('mayor o igual a 0'));

  // Test invalid expiration date
  const badDateReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expirationDate: 'not-a-valid-date' }),
  });
  const badDateRes = await updateBatchHandler(badDateReq, { params: { id: batchId } });
  assert.equal(badDateRes.status, 400);
  const badDateBody = await badDateRes.json();
  assert.ok(badDateBody.error.includes('inválido'));
});

test('API Integration: DELETE /api/inventory/[id] deletes recently received batch', async () => {
  // 1. Insert recent batch
  const batchId = 'batch-rec-delete-test-01';
  createBatch({
    id: batchId,
    productId: 'prod-002',
    lotCode: 'LOT-REC-DEL-001',
    expirationDate: '2026-10-10',
    currentQuantity: 40,
  });

  assert.ok(getBatchById(batchId), 'Batch must exist prior to deletion');

  // 2. Call DELETE endpoint
  const delReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'DELETE',
  });
  const delRes = await deleteBatchHandler(delReq, { params: { id: batchId } });
  assert.equal(delRes.status, 200);
  const delBody = await delRes.json();
  assert.equal(delBody.success, true);

  // 3. Confirm deletion in database
  assert.equal(getBatchById(batchId), null, 'Batch must no longer exist in DB');
});
