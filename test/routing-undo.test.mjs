import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GET as getRouteByIdHandler, DELETE as undoRouteHandler } from '../src/app/api/routes/[id]/route.ts';
import {
  getDb,
  getBatchById,
  createBatch,
  deleteBatch,
  getRouteById,
  dispatchRouteTransaction,
  undoRouteDispatchTransaction,
  deleteRoute,
} from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('DB Transaction: dispatch -> stock deducted -> undo -> stock restored -> route deleted', () => {
  const batchBefore = getBatchById('batch-001');
  assert.ok(batchBefore, 'Seeded batch-001 should exist');
  const initialQty = batchBefore.currentQuantity;
  assert.ok(initialQty >= 30, 'Initial quantity should be at least 30');

  // 1. Dispatch route with 30 units deducted
  const routeId = 'test-route-undo-standard';
  const routeCode = 'RUT-TEST-UNDO-01';
  const dispatchedUnits = 30;

  dispatchRouteTransaction(
    {
      id: routeId,
      routeCode,
      vehicleType: 'Torton_ThermoKing',
      driverName: 'Operador Celaya Test',
      status: 'En_Transito',
      totalDistanceKm: 35.5,
      stops: [
        {
          communityId: 'comm-001',
          name: 'Comunidad San Juan',
          municipality: 'Celaya',
          latitude: 20.6,
          longitude: -100.7,
          order: 1,
        },
      ],
      dispatchedItems: [
        {
          batchId: 'batch-001',
          productId: batchBefore.productId,
          productName: 'Leche Entera UHT',
          quantity: dispatchedUnits,
          unit: 'litros',
          lotCode: batchBefore.lotCode,
          expirationDate: batchBefore.expirationDate,
        },
      ],
    },
    [{ batchId: 'batch-001', quantity: dispatchedUnits }]
  );

  // Verify stock was deducted
  const batchAfterDispatch = getBatchById('batch-001');
  assert.equal(
    batchAfterDispatch.currentQuantity,
    initialQty - dispatchedUnits,
    'Stock must be reduced by 30 units after dispatch'
  );

  // Verify route exists in DB
  const createdRoute = getRouteById(routeId);
  assert.ok(createdRoute, 'Route must exist in database after dispatch');
  assert.equal(createdRoute.routeCode, routeCode);

  // 2. Undo route dispatch transaction
  const undoResult = undoRouteDispatchTransaction(routeId);

  assert.equal(undoResult.success, true);
  assert.equal(undoResult.routeId, routeId);
  assert.equal(undoResult.routeCode, routeCode);
  assert.equal(undoResult.restoredItemsCount, 1);
  assert.equal(undoResult.restoredUnits, dispatchedUnits);

  // Verify stock is restored completely
  const batchAfterUndo = getBatchById('batch-001');
  assert.equal(
    batchAfterUndo.currentQuantity,
    initialQty,
    'Stock must be restored to original quantity after undoing dispatch'
  );

  // Verify route is deleted from database
  const routeAfterUndo = getRouteById(routeId);
  assert.equal(routeAfterUndo, null, 'Route must be removed from dispatch_routes table after undo');
});

test('DB Transaction: deleted batch recreation on undo', () => {
  // 1. Create a dedicated batch
  const tempBatchId = 'batch-will-be-deleted';
  const tempLotCode = 'LOT-DISAPPEARED-123';
  const tempExpDate = '2026-11-30';
  const initialQty = 45;

  createBatch({
    id: tempBatchId,
    productId: 'prod-001',
    lotCode: tempLotCode,
    expirationDate: tempExpDate,
    currentQuantity: initialQty,
  });

  assert.ok(getBatchById(tempBatchId), 'Temporary batch must exist before dispatch');

  // 2. Dispatch all units of this batch
  const routeId = 'test-route-recreate-batch';
  const routeCode = 'RUT-RECREATE-01';

  dispatchRouteTransaction(
    {
      id: routeId,
      routeCode,
      vehicleType: 'Camioneta_3_5T',
      driverName: 'Chofer Auxiliar',
      status: 'En_Transito',
      totalDistanceKm: 18.0,
      stops: [],
      dispatchedItems: [
        {
          batchId: tempBatchId,
          productId: 'prod-001',
          productName: 'Producto a Restaurar',
          quantity: initialQty,
          unit: 'piezas',
          lotCode: tempLotCode,
          expirationDate: tempExpDate,
        },
      ],
    },
    [{ batchId: tempBatchId, quantity: initialQty }]
  );

  // 3. Simulate accidental/external deletion of the exhausted batch from inventory_batches
  deleteBatch(tempBatchId);
  assert.equal(getBatchById(tempBatchId), null, 'Batch must be deleted from table');

  // 4. Undo the dispatch route
  const undoResult = undoRouteDispatchTransaction(routeId);
  assert.equal(undoResult.success, true);
  assert.equal(undoResult.restoredUnits, initialQty);

  // 5. Verify batch was recreated with product and quantities intact
  const recreatedBatch = getBatchById(tempBatchId);
  assert.ok(recreatedBatch, 'Batch must be recreated when undoing route dispatch');
  assert.equal(recreatedBatch.id, tempBatchId);
  assert.equal(recreatedBatch.productId, 'prod-001');
  assert.equal(recreatedBatch.lotCode, tempLotCode);
  assert.equal(recreatedBatch.expirationDate, tempExpDate);
  assert.equal(recreatedBatch.currentQuantity, initialQty);

  // Verify route is deleted
  assert.equal(getRouteById(routeId), null);
});

test('DB Transaction: invalid routeId throws error and rolls back', () => {
  assert.throws(
    () => {
      undoRouteDispatchTransaction('route-id-does-not-exist');
    },
    {
      message: /no encontrada/,
    }
  );
});

test('API GET /api/routes/[id]: returns route when found and 404 when not found', async () => {
  // 1. Create a route
  const routeId = 'api-get-test-route';
  const routeCode = 'RUT-API-GET-001';

  dispatchRouteTransaction(
    {
      id: routeId,
      routeCode,
      vehicleType: 'Torton_ThermoKing',
      driverName: 'Conductor API Test',
      status: 'En_Transito',
      totalDistanceKm: 50,
      stops: [],
      dispatchedItems: [
        {
          batchId: 'batch-001',
          productId: 'prod-001',
          productName: 'Producto Test',
          quantity: 5,
          unit: 'piezas',
        },
      ],
    },
    [{ batchId: 'batch-001', quantity: 5 }]
  );

  // 2. GET existing route -> 200 OK
  const reqOk = new Request(`http://localhost:3000/api/routes/${routeId}`);
  const resOk = await getRouteByIdHandler(reqOk, { params: { id: routeId } });
  assert.equal(resOk.status, 200, 'GET should return 200 OK');
  const bodyOk = await resOk.json();
  assert.equal(bodyOk.id, routeId);
  assert.equal(bodyOk.routeCode, routeCode);

  // 3. GET non-existent route -> 404
  const req404 = new Request('http://localhost:3000/api/routes/route-non-existent-999');
  const res404 = await getRouteByIdHandler(req404, { params: { id: 'route-non-existent-999' } });
  assert.equal(res404.status, 404, 'GET should return 404 Not Found');
  const body404 = await res404.json();
  assert.ok(body404.error.includes('no encontrada'));
});

test('API DELETE /api/routes/[id]: undoes route dispatch, restores inventory, and returns 404 for missing route', async () => {
  const batch = getBatchById('batch-002');
  const initialQty = batch.currentQuantity;
  const deductQty = 20;

  const routeId = 'api-delete-undo-route';
  const routeCode = 'RUT-API-DEL-001';

  // 1. Dispatch route
  dispatchRouteTransaction(
    {
      id: routeId,
      routeCode,
      vehicleType: 'Camioneta_3_5T',
      driverName: 'Operador DELETE Test',
      status: 'En_Transito',
      totalDistanceKm: 25.5,
      stops: [],
      dispatchedItems: [
        {
          batchId: 'batch-002',
          productId: batch.productId,
          productName: 'Frijol Negro',
          quantity: deductQty,
          unit: 'kilos',
        },
      ],
    },
    [{ batchId: 'batch-002', quantity: deductQty }]
  );

  assert.equal(getBatchById('batch-002').currentQuantity, initialQty - deductQty);

  // 2. Call DELETE endpoint
  const reqDelete = new Request(`http://localhost:3000/api/routes/${routeId}`, {
    method: 'DELETE',
  });
  const resDelete = await undoRouteHandler(reqDelete, { params: { id: routeId } });

  assert.equal(resDelete.status, 200, 'DELETE should return 200 OK');
  const bodyDelete = await resDelete.json();
  assert.equal(bodyDelete.success, true);
  assert.equal(bodyDelete.routeCode, routeCode);
  assert.equal(bodyDelete.restoredUnits, deductQty);
  assert.equal(bodyDelete.restoredItemsCount, 1);
  assert.ok(bodyDelete.message.includes('deshecha con éxito'));

  // 3. Verify stock in DB is restored and route deleted
  assert.equal(getBatchById('batch-002').currentQuantity, initialQty);
  assert.equal(getRouteById(routeId), null);

  // 4. Calling DELETE again returns 404
  const resDeleteAgain = await undoRouteHandler(reqDelete, { params: { id: routeId } });
  assert.equal(resDeleteAgain.status, 404, 'DELETE should return 404 when route no longer exists');
  const body404 = await resDeleteAgain.json();
  assert.ok(body404.error.includes('no encontrada'));
});

test('UI Integration: rutas/page.tsx includes RotateCcw, Modal, undo handlers, and confirmation dialog', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'rutas', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'rutas/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify RotateCcw import
  assert.ok(content.includes('RotateCcw'), 'rutas/page.tsx must import RotateCcw from lucide-react');

  // Verify Modal component import
  assert.ok(content.includes("import Modal from '../../components/Modal.tsx'"), 'rutas/page.tsx must import Modal');

  // Verify state variables
  assert.ok(content.includes('routeToUndo'), 'rutas/page.tsx must track routeToUndo state');
  assert.ok(content.includes('isUndoModalOpen'), 'rutas/page.tsx must track isUndoModalOpen state');
  assert.ok(content.includes('isUndoing'), 'rutas/page.tsx must track isUndoing state');
  assert.ok(content.includes('undoError'), 'rutas/page.tsx must track undoError state');

  // Verify memos
  assert.ok(content.includes('undoDispatchedItems'), 'rutas/page.tsx must compute undoDispatchedItems memo');
  assert.ok(content.includes('undoTotalUnits'), 'rutas/page.tsx must compute undoTotalUnits memo');

  // Verify handlers
  assert.ok(content.includes('handleOpenUndoModal'), 'rutas/page.tsx must have handleOpenUndoModal handler');
  assert.ok(content.includes('handleCloseUndoModal'), 'rutas/page.tsx must have handleCloseUndoModal handler');
  assert.ok(content.includes('handleConfirmUndoRoute'), 'rutas/page.tsx must have handleConfirmUndoRoute handler');

  // Verify API call in handler
  assert.ok(
    content.includes("fetch(`/api/routes/${routeToUndo.id}`") ||
      content.includes('fetch(`/api/routes/${routeToUndo.id}'),
    'Handler must call DELETE /api/routes/[id]'
  );
  assert.ok(content.includes("method: 'DELETE'"), 'API call must use DELETE method');

  // Verify table header updated to "Acciones"
  assert.ok(
    content.includes('<th className="py-3 px-4 text-right">Acciones</th>'),
    'Historical routes table header must be "Acciones"'
  );

  // Verify Deshacer button in table
  assert.ok(content.includes('Deshacer'), 'Historical routes table must render Deshacer button');
  assert.ok(content.includes('text-red-700'), 'Deshacer button must have red styling');
  assert.ok(content.includes('RotateCcw'), 'Deshacer button must display RotateCcw icon');
  assert.ok(
    content.includes('aria-label={`Deshacer ruta ${route.routeCode}`}'),
    'Deshacer button must have accessible aria-label'
  );

  // Verify Modal content
  assert.ok(content.includes('Deshacer Ruta Despachada'), 'Modal must have title "Deshacer Ruta Despachada"');
  assert.ok(content.includes('Confirmar y Devolver Stock'), 'Modal must have confirm button "Confirmar y Devolver Stock"');
  assert.ok(content.includes('Cancelar'), 'Modal must have cancel button');
});
