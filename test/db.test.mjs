import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDatabase,
  getAllProducts,
  getProductByBarcode,
  getProductById,
  createProduct,
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatchQuantity,
  getAllCommunities,
  createCommunity,
  getAllVehicles,
  createVehicle,
  getAllRoutes,
  getRouteById,
  dispatchRouteTransaction,
} from '../src/lib/db.ts';

test('Database: Schema Initialization and In-Memory Instance', () => {
  const db = createDatabase(':memory:');
  
  // Verify required tables exist
  const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;");
  const tableNames = tablesStmt.all().map((r) => r.name);

  assert.ok(tableNames.includes('products'), 'Table products must exist');
  assert.ok(tableNames.includes('inventory_batches'), 'Table inventory_batches must exist');
  assert.ok(tableNames.includes('communities'), 'Table communities must exist');
  assert.ok(tableNames.includes('dispatch_routes'), 'Table dispatch_routes must exist');
  assert.ok(tableNames.includes('vehicles'), 'Table vehicles must exist');

  // Verify indexes exist
  const indexStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='index';");
  const indexNames = indexStmt.all().map((r) => r.name);
  assert.ok(indexNames.includes('idx_products_barcode'), 'Barcode index must exist');
  assert.ok(indexNames.includes('idx_batches_expiration'), 'Batch expiration index must exist');
  assert.ok(indexNames.includes('idx_batches_product'), 'Batch product index must exist');
});

test('Database: Product & Inventory Batch Operations', () => {
  const db = createDatabase(':memory:');

  const testProduct = {
    id: 'prod-test-01',
    barcode: '750000000001',
    name: 'Leche Deslactosada 1L',
    donorType: 'Cuadritos',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 50,
  };

  createProduct(testProduct, db);

  const fetchedByBarcode = getProductByBarcode('750000000001', db);
  assert.ok(fetchedByBarcode, 'Should find product by barcode');
  assert.equal(fetchedByBarcode.name, 'Leche Deslactosada 1L');
  assert.equal(fetchedByBarcode.category, 'LACTEO_FRIO');

  const fetchedById = getProductById('prod-test-01', db);
  assert.ok(fetchedById, 'Should find product by id');
  assert.equal(fetchedById.id, 'prod-test-01');

  // Duplicate barcode constraint check
  assert.throws(() => {
    createProduct({ ...testProduct, id: 'prod-test-02' }, db);
  }, /UNIQUE constraint failed/);

  // Batch creation
  const testBatch = {
    id: 'batch-test-01',
    productId: 'prod-test-01',
    lotCode: 'LOTE-TEST-99',
    expirationDate: '2026-09-25',
    currentQuantity: 100,
  };

  createBatch(testBatch, db);

  const batches = getAllBatches(db);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].id, 'batch-test-01');
  assert.equal(batches[0].product?.name, 'Leche Deslactosada 1L');
  assert.equal(batches[0].currentQuantity, 100);

  const batchById = getBatchById('batch-test-01', db);
  assert.ok(batchById);
  assert.equal(batchById.currentQuantity, 100);

  // Update batch quantity
  updateBatchQuantity('batch-test-01', 85, db);
  const updatedBatch = getBatchById('batch-test-01', db);
  assert.equal(updatedBatch.currentQuantity, 85);
});

test('Database: Communities and Vehicles Management', () => {
  const db = createDatabase(':memory:');

  const comm = {
    id: 'comm-t-01',
    name: 'San Juan de la Vega',
    municipality: 'Celaya',
    latitude: 20.6278,
    longitude: -100.7634,
    representativeName: 'Elena Ramírez',
    phone: '461-123-4567',
    beneficiariesCount: 400,
  };
  createCommunity(comm, db);

  const communities = getAllCommunities(db);
  assert.equal(communities.length, 1);
  assert.equal(communities[0].name, 'San Juan de la Vega');

  const veh = {
    id: 'veh-t-01',
    name: 'Torton Thermo King #1',
    plate: 'GT-4821-C',
    vehicleType: 'Torton_ThermoKing',
    maxCapacityKg: 12000,
    hasRefrigeration: true,
  };
  createVehicle(veh, db);

  const vehicles = getAllVehicles(db);
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].hasRefrigeration, true);
  assert.equal(vehicles[0].maxCapacityKg, 12000);
});

test('Database: Atomic Dispatch Transaction & Stock Deduction', () => {
  const db = createDatabase(':memory:');

  // Setup product and batches
  createProduct({
    id: 'p-1',
    barcode: '111111111111',
    name: 'Yogur Fresa 1L',
    donorType: 'Cuadritos',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 20,
  }, db);

  createBatch({
    id: 'b-1',
    productId: 'p-1',
    lotCode: 'LT-01',
    expirationDate: '2026-09-20',
    currentQuantity: 50,
  }, db);

  createBatch({
    id: 'b-2',
    productId: 'p-1',
    lotCode: 'LT-02',
    expirationDate: '2026-09-22',
    currentQuantity: 30,
  }, db);

  // 1. Successful dispatch
  const routeInput = {
    routeCode: 'RT-2026-001',
    vehicleType: 'Torton_ThermoKing',
    driverName: 'Carlos Mendoza',
    status: 'Planificada',
    totalDistanceKm: 34.5,
    stops: [
      {
        communityId: 'c-1',
        name: 'San Juan de la Vega',
        municipality: 'Celaya',
        latitude: 20.6278,
        longitude: -100.7634,
        order: 1,
      },
    ],
    dispatchedItems: [
      {
        batchId: 'b-1',
        productId: 'p-1',
        productName: 'Yogur Fresa 1L',
        quantity: 20,
        unit: 'litros',
      },
      {
        batchId: 'b-2',
        productId: 'p-1',
        productName: 'Yogur Fresa 1L',
        quantity: 10,
        unit: 'litros',
      },
    ],
  };

  const result = dispatchRouteTransaction(
    routeInput,
    [
      { batchId: 'b-1', quantity: 20 },
      { batchId: 'b-2', quantity: 10 },
    ],
    db
  );

  assert.ok(result.success);
  assert.ok(result.routeId);

  // Check deducted quantities
  const updatedB1 = getBatchById('b-1', db);
  const updatedB2 = getBatchById('b-2', db);
  assert.equal(updatedB1.currentQuantity, 30); // 50 - 20 = 30
  assert.equal(updatedB2.currentQuantity, 20); // 30 - 10 = 20

  // Verify route is stored
  const routes = getAllRoutes(db);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].routeCode, 'RT-2026-001');
  assert.equal(routes[0].stops.length, 1);
  assert.equal(routes[0].dispatchedItems.length, 2);

  // 2. Failed dispatch due to insufficient stock -> Must rollback atomically
  assert.throws(() => {
    dispatchRouteTransaction(
      {
        routeCode: 'RT-FAIL-001',
        vehicleType: 'Torton_ThermoKing',
        driverName: 'Carlos Mendoza',
        status: 'Planificada',
        totalDistanceKm: 12,
        stops: [],
        dispatchedItems: [{ batchId: 'b-1', productId: 'p-1', productName: 'Yogur', quantity: 100, unit: 'litros' }],
      },
      [{ batchId: 'b-1', quantity: 100 }], // only 30 available
      db
    );
  }, /Stock insuficiente/);

  // Verify that b-1 stock was NOT changed after failed transaction rollback
  const b1AfterFail = getBatchById('b-1', db);
  assert.equal(b1AfterFail.currentQuantity, 30, 'Quantity should remain unchanged after rollback');

  // Verify failed route was NOT inserted
  const routesAfterFail = getAllRoutes(db);
  assert.equal(routesAfterFail.length, 1, 'No new route should have been committed');

  // 3. Failed dispatch due to non-existent batch
  assert.throws(() => {
    dispatchRouteTransaction(
      {
        routeCode: 'RT-FAIL-002',
        vehicleType: 'Torton_ThermoKing',
        driverName: 'Carlos Mendoza',
        status: 'Planificada',
        totalDistanceKm: 12,
        stops: [],
        dispatchedItems: [{ batchId: 'b-non-existent', productId: 'p-1', productName: 'Yogur', quantity: 5, unit: 'litros' }],
      },
      [{ batchId: 'b-non-existent', quantity: 5 }],
      db
    );
  }, /no existe/);
});
