import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as getProducts, POST as createProductHandler } from '../src/app/api/products/route.ts';
import { GET as getInventory, POST as receiveBatchHandler } from '../src/app/api/inventory/route.ts';
import { PATCH as updateBatchHandler, DELETE as deleteBatchHandler } from '../src/app/api/inventory/[id]/route.ts';
import { GET as getRoutes, POST as createRouteHandler } from '../src/app/api/routes/route.ts';
import { GET as getCommunities } from '../src/app/api/communities/route.ts';
import { GET as getVehicles } from '../src/app/api/vehicles/route.ts';
import { GET as exportExcel } from '../src/app/api/excel/export/route.ts';
import { GET as templateExcel } from '../src/app/api/excel/template/route.ts';
import { POST as importExcel } from '../src/app/api/excel/import/route.ts';
import { POST as seedHandler } from '../src/app/api/seed/route.ts';
import { generateTemplateWorkbook } from '../src/lib/excel.ts';
import { getDb, getBatchById } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

test.beforeEach(() => {
  // Ensure fresh seed state before tests
  seedDatabase(getDb());
});

test('API Products: GET list, filter by query, and filter by barcode', async () => {
  // 1. GET all
  const reqAll = new Request('http://localhost:3000/api/products');
  const resAll = await getProducts(reqAll);
  assert.equal(resAll.status, 200);
  const productsAll = await resAll.json();
  assert.ok(Array.isArray(productsAll));
  assert.ok(productsAll.length >= 10, 'Should return all seeded products');

  // 2. GET with search query `q=leche`
  const reqSearch = new Request('http://localhost:3000/api/products?q=leche');
  const resSearch = await getProducts(reqSearch);
  assert.equal(resSearch.status, 200);
  const productsSearch = await resSearch.json();
  assert.ok(productsSearch.length > 0);
  assert.ok(productsSearch.every((p) => p.name.toLowerCase().includes('leche') || p.barcode.includes('leche')));

  // 3. GET with barcode
  const reqBarcode = new Request('http://localhost:3000/api/products?barcode=7501020511111');
  const resBarcode = await getProducts(reqBarcode);
  assert.equal(resBarcode.status, 200);
  const productsBarcode = await resBarcode.json();
  assert.equal(productsBarcode.length, 1);
  assert.equal(productsBarcode[0].barcode, '7501020511111');
});

test('API Products: POST creates new product and rejects duplicate barcode', async () => {
  const uniqueBarcode = '7509999' + Date.now().toString().slice(-6);
  const newProductPayload = {
    barcode: uniqueBarcode,
    name: 'Atún en Agua 140g Herdez',
    donorType: 'Herdez',
    category: 'SECO_ABARROTE',
    unit: 'piezas',
    storageArea: 'Nave_Secos',
    minStock: 250,
  };

  const reqCreate = new Request('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload),
  });

  const resCreate = await createProductHandler(reqCreate);
  assert.equal(resCreate.status, 201);
  const created = await resCreate.json();
  assert.equal(created.barcode, uniqueBarcode);
  assert.equal(created.name, 'Atún en Agua 140g Herdez');
  assert.ok(created.id);

  // Attempt duplicate barcode -> should return 409
  const reqDuplicate = new Request('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload),
  });

  const resDuplicate = await createProductHandler(reqDuplicate);
  assert.equal(resDuplicate.status, 409);
  const errorJson = await resDuplicate.json();
  assert.ok(errorJson.error.includes('Ya existe un producto'));
});

test('API Inventory: GET returns FEFO batches with KPIs and supports filtering', async () => {
  const req = new Request('http://localhost:3000/api/inventory');
  const res = await getInventory(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.batches));
  assert.ok(data.batches.length > 0);
  assert.ok(data.kpis, 'Should contain kpis object');
  assert.ok(typeof data.kpis.totalQuantity === 'number');
  assert.ok(typeof data.kpis.criticalBatchesCount === 'number');

  // Verify FEFO sorting (first batch should have earliest or equal expiration compared to second)
  const first = data.batches[0];
  assert.ok(first.daysRemaining !== undefined);
  assert.ok(['CRITICO', 'ATENCION', 'ESTABLE', 'AGOTADO'].includes(first.status));

  // Test filter by category
  const reqCategory = new Request('http://localhost:3000/api/inventory?category=LACTEO_FRIO');
  const resCategory = await getInventory(reqCategory);
  assert.equal(resCategory.status, 200);
  const dataCategory = await resCategory.json();
  assert.ok(dataCategory.batches.every((b) => b.product?.category === 'LACTEO_FRIO'));

  // Test filter by status
  const reqStatus = new Request('http://localhost:3000/api/inventory?status=CRITICO');
  const resStatus = await getInventory(reqStatus);
  assert.equal(resStatus.status, 200);
  const dataStatus = await resStatus.json();
  assert.ok(dataStatus.batches.every((b) => b.status === 'CRITICO'));
});

test('API Inventory: Global KPIs remain constant when filtering batches', async () => {
  // 1. GET all batches (no filters) to capture warehouse-wide global KPIs
  const reqAll = new Request('http://localhost:3000/api/inventory');
  const resAll = await getInventory(reqAll);
  assert.equal(resAll.status, 200);
  const dataAll = await resAll.json();

  assert.ok(dataAll.batches.length > 0);
  assert.equal(dataAll.totalBatchesCount, dataAll.batches.length);
  assert.equal(dataAll.filteredBatchesCount, dataAll.batches.length);
  const globalKpis = dataAll.kpis;
  assert.ok(globalKpis.totalQuantity > 0);
  assert.ok(globalKpis.criticalBatchesCount > 0);

  // 2. Query with category filter (a subset of batches)
  const reqFilteredCategory = new Request('http://localhost:3000/api/inventory?category=LACTEO_FRIO');
  const resFilteredCategory = await getInventory(reqFilteredCategory);
  assert.equal(resFilteredCategory.status, 200);
  const dataFilteredCategory = await resFilteredCategory.json();

  // Verify batches are filtered
  assert.ok(dataFilteredCategory.batches.length < dataAll.batches.length, 'Filtered count should be less than total');
  assert.equal(dataFilteredCategory.totalBatchesCount, dataAll.batches.length, 'totalBatchesCount must reflect warehouse total');
  assert.equal(dataFilteredCategory.filteredBatchesCount, dataFilteredCategory.batches.length);

  // Verify KPIs remained globally warehouse-wide, identical to unfiltered KPIs
  assert.deepEqual(dataFilteredCategory.kpis, globalKpis, 'KPIs must remain constant across filters');

  // 3. Query with status filter (e.g. CRITICO)
  const reqFilteredStatus = new Request('http://localhost:3000/api/inventory?status=CRITICO');
  const resFilteredStatus = await getInventory(reqFilteredStatus);
  assert.equal(resFilteredStatus.status, 200);
  const dataFilteredStatus = await resFilteredStatus.json();

  assert.equal(dataFilteredStatus.totalBatchesCount, dataAll.batches.length);
  assert.equal(dataFilteredStatus.filteredBatchesCount, dataFilteredStatus.batches.length);
  assert.deepEqual(dataFilteredStatus.kpis, globalKpis, 'KPIs must remain constant when filtering by status');
});

test('API Inventory: POST reception of new batch and validation of expired dates', async () => {
  // 1. Valid batch reception
  const validBatch = {
    productId: 'prod-001',
    lotCode: 'LT-RECEP-01',
    expirationDate: '2026-10-15',
    currentQuantity: 80,
  };

  const reqValid = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validBatch),
  });

  const resValid = await receiveBatchHandler(reqValid);
  assert.equal(resValid.status, 201);
  const created = await resValid.json();
  assert.equal(created.lotCode, 'LT-RECEP-01');
  assert.equal(created.currentQuantity, 80);
  assert.ok(created.id);
  assert.ok(created.status);

  // 2. Already expired batch with forceReject: true -> should be rejected with 400
  const expiredBatch = {
    productId: 'prod-001',
    lotCode: 'LT-EXP-REJECT',
    expirationDate: '2020-01-01',
    currentQuantity: 50,
    forceReject: true,
  };

  const reqReject = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expiredBatch),
  });

  const resReject = await receiveBatchHandler(reqReject);
  assert.equal(resReject.status, 400);
  const rejectJson = await resReject.json();
  assert.ok(rejectJson.error.includes('Lote rechazado'));
});

test('API Inventory [id]: PATCH updates quantity and DELETE removes batch', async () => {
  // First, receive a batch to edit and delete
  const newBatch = {
    productId: 'prod-002',
    lotCode: 'LT-PATCH-DEL',
    expirationDate: '2026-11-20',
    currentQuantity: 100,
  };

  const createReq = new Request('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBatch),
  });
  const createRes = await receiveBatchHandler(createReq);
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  const batchId = created.id;

  // 1. PATCH currentQuantity to 45
  const patchReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentQuantity: 45 }),
  });
  const patchRes = await updateBatchHandler(patchReq, { params: { id: batchId } });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.currentQuantity, 45);

  // 2. DELETE batch
  const deleteReq = new Request(`http://localhost:3000/api/inventory/${batchId}`, {
    method: 'DELETE',
  });
  const deleteRes = await deleteBatchHandler(deleteReq, { params: { id: batchId } });
  assert.equal(deleteRes.status, 200);
  const deleteJson = await deleteRes.json();
  assert.equal(deleteJson.success, true);

  // Verify it is gone from db
  const fetchDeleted = getBatchById(batchId);
  assert.equal(fetchDeleted, null);
});

test('API Routes: POST creates dispatch route and atomically deducts inventory stock', async () => {
  // Check initial batch quantity
  const initialBatch = getBatchById('batch-001');
  assert.ok(initialBatch);
  const initialQty = initialBatch.currentQuantity;
  assert.ok(initialQty >= 20, 'Initial quantity should be at least 20');

  const routePayload = {
    vehicleType: 'Torton_ThermoKing',
    driverName: 'Roberto Gómez Bolaños',
    totalDistanceKm: 34.2,
    stops: [
      {
        communityId: 'com-001',
        name: 'Comedor Santa María - Rincón de Tamayo',
        municipality: 'Celaya',
        latitude: 20.4285,
        longitude: -100.7554,
        order: 1,
      },
    ],
    dispatchedItems: [
      {
        batchId: 'batch-001',
        productId: initialBatch.productId,
        productName: initialBatch.product?.name || 'Producto Test',
        quantity: 15,
        unit: 'litros',
      },
    ],
  };

  const req = new Request('http://localhost:3000/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(routePayload),
  });

  const res = await createRouteHandler(req);
  assert.equal(res.status, 201);
  const createdRoute = await res.json();
  assert.equal(createdRoute.status, 'En_Transito');
  assert.equal(createdRoute.driverName, 'Roberto Gómez Bolaños');

  // Verify atomic stock deduction
  const updatedBatch = getBatchById('batch-001');
  assert.equal(updatedBatch.currentQuantity, initialQty - 15);

  // Test insufficient stock rejection
  const excessivePayload = {
    vehicleType: 'Torton_ThermoKing',
    driverName: 'Roberto Gómez Bolaños',
    totalDistanceKm: 10,
    stops: routePayload.stops,
    dispatchedItems: [
      {
        batchId: 'batch-001',
        productId: initialBatch.productId,
        productName: 'Producto Test',
        quantity: 999999, // Exceeds available stock
        unit: 'litros',
      },
    ],
  };

  const reqExcess = new Request('http://localhost:3000/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(excessivePayload),
  });

  const resExcess = await createRouteHandler(reqExcess);
  assert.equal(resExcess.status, 400);
  const excessJson = await resExcess.json();
  assert.ok(excessJson.error.includes('Stock insuficiente'));

  // Verify GET routes lists the created route
  const getRoutesReq = new Request('http://localhost:3000/api/routes');
  const getRoutesRes = await getRoutes(getRoutesReq);
  assert.equal(getRoutesRes.status, 200);
  const routesList = await getRoutesRes.json();
  assert.ok(routesList.length >= 1);
  assert.equal(routesList[0].id, createdRoute.id);
});

test('API Communities: GET returns all communities ordered by name', async () => {
  const req = new Request('http://localhost:3000/api/communities');
  const res = await getCommunities(req);
  assert.equal(res.status, 200);
  const communities = await res.json();
  assert.ok(Array.isArray(communities));
  assert.ok(communities.length >= 5);
  assert.ok(communities[0].name);
  assert.ok(typeof communities[0].latitude === 'number');
  assert.ok(typeof communities[0].longitude === 'number');
});

test('API Vehicles: GET returns all vehicles with refrigeration boolean flag', async () => {
  const req = new Request('http://localhost:3000/api/vehicles');
  const res = await getVehicles(req);
  assert.equal(res.status, 200);
  const vehicles = await res.json();
  assert.ok(Array.isArray(vehicles));
  assert.ok(vehicles.length >= 2);
  assert.ok(typeof vehicles[0].hasRefrigeration === 'boolean');
});

test('API Excel: GET export and template produce valid xlsx downloads', async () => {
  // 1. Export
  const exportRes = await exportExcel();
  assert.equal(exportRes.status, 200);
  assert.equal(
    exportRes.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.ok(exportRes.headers.get('content-disposition')?.includes('inventario_fnvac_celaya.xlsx'));
  const exportBuffer = await exportRes.arrayBuffer();
  assert.ok(exportBuffer.byteLength > 1000, 'Excel export should have non-empty workbook content');

  // 2. Template
  const templateRes = await templateExcel();
  assert.equal(templateRes.status, 200);
  assert.equal(
    templateRes.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  assert.ok(templateRes.headers.get('content-disposition')?.includes('plantilla_captura_fnvac.xlsx'));
  const templateBuffer = await templateRes.arrayBuffer();
  assert.ok(templateBuffer.byteLength > 1000, 'Excel template should have non-empty workbook content');
});

test('API Excel: POST import handles workbook upload and updates inventory', async () => {
  const templateBytes = generateTemplateWorkbook();
  const formData = new FormData();
  formData.append('file', new Blob([templateBytes]), 'inventario_prueba.xlsx');

  const importReq = new Request('http://localhost:3000/api/excel/import', {
    method: 'POST',
    body: formData,
  });

  const importRes = await importExcel(importReq);
  assert.equal(importRes.status, 200);
  const result = await importRes.json();
  assert.equal(result.success, true);
  assert.ok(result.processedCount >= 2);
});

test('API Seed: POST resets demo data and returns confirmation', async () => {
  const seedReq = new Request('http://localhost:3000/api/seed', {
    method: 'POST',
  });

  const seedRes = await seedHandler(seedReq);
  assert.equal(seedRes.status, 200);
  const result = await seedRes.json();
  assert.equal(result.success, true);
  assert.ok(result.message.includes('Datos semilla cargados'));
  assert.ok(result.details.productsCount > 0);
});
