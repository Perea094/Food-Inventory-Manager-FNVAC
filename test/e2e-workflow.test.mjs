import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { GET as getInventory, POST as postInventory } from '../src/app/api/inventory/route.ts';
import { GET as getProducts, POST as postProducts } from '../src/app/api/products/route.ts';
import { GET as getRoutes, POST as postRoutes } from '../src/app/api/routes/route.ts';
import { GET as getCommunities } from '../src/app/api/communities/route.ts';
import { GET as getVehicles } from '../src/app/api/vehicles/route.ts';
import { GET as exportExcel } from '../src/app/api/excel/export/route.ts';
import { GET as templateExcel } from '../src/app/api/excel/template/route.ts';
import { POST as importExcel } from '../src/app/api/excel/import/route.ts';
import { POST as seedDatabase } from '../src/app/api/seed/route.ts';
import { CEDIS_CELAYA, calculateHaversineDistanceKm, recommendVehicle, calculateRouteCircuit } from '../src/lib/routing.ts';

test('E2E Operational Flow: Banco de Alimentos FNVAC (CEDIS Celaya)', async (t) => {
  await t.test('Paso 0: Re-sembrar base de datos a estado inicial conocido', async () => {
    const seedReq = new Request('http://localhost:3000/api/seed', { method: 'POST' });
    const seedRes = await seedDatabase(seedReq);
    const seedJson = await seedRes.json();
    assert.equal(seedRes.status, 200);
    assert.equal(seedJson.success, true);
  });

  let newBatchId = '';
  const testLotCode = 'LOT-TEST-E2E-' + Date.now();
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await t.test('Paso 1: Recepción en Andén de Donación Crítica de Cuadritos Biotek', async () => {
    // 1.1 Localizar producto "Leche Entera UHT 1L" por código de barras
    const prodReq = new Request('http://localhost:3000/api/products?barcode=7501020511111');
    const prodRes = await getProducts(prodReq);
    const products = await prodRes.json();
    assert.equal(products.length, 1);
    const product = products[0];
    assert.equal(product.barcode, '7501020511111');
    assert.equal(product.category, 'LACTEO_FRIO');

    // 1.2 Registrar lote de leche con caducidad a 2 días (500 litros)
    const batchReq = new Request('http://localhost:3000/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        lotCode: testLotCode,
        expirationDate: twoDaysFromNow,
        currentQuantity: 500,
      }),
    });
    const batchRes = await postInventory(batchReq);
    assert.equal(batchRes.status, 201);
    const batchJson = await batchRes.json();
    assert.equal(batchJson.currentQuantity, 500);
    newBatchId = batchJson.id;
  });

  await t.test('Paso 2: Inspección en Tablero FEFO y Verificación de Prioridad Crítica', async () => {
    const invReq = new Request('http://localhost:3000/api/inventory');
    const invRes = await getInventory(invReq);
    assert.equal(invRes.status, 200);
    const { batches, kpis } = await invRes.json();

    // El lote debe estar en el inventario
    const foundBatch = batches.find((b) => b.id === newBatchId);
    assert.ok(foundBatch, 'El lote recién recibido debe figurar en el inventario');
    assert.equal(foundBatch.status, 'CRITICO', 'Debe catalogarse con semáforo CRITICO (Rojo)');
    assert.ok(foundBatch.daysRemaining <= 2, 'Los días restantes deben ser <= 2');

    // KPIs deben registrar lotes críticos
    assert.ok(kpis.criticalBatchesCount >= 1, 'Debe haber al menos un lote crítico');
    assert.ok(kpis.totalQuantity > 0, 'La cantidad total debe ser mayor a 0');
  });

  await t.test('Paso 3: Asistente de Carga Crítica y Selección Obligatoria de Thermo King', async () => {
    // Definir carga con el lote crítico lácteo
    const selectedItems = [
      {
        batchId: newBatchId,
        productName: 'Leche Entera UHT 1L Cuadritos',
        category: 'LACTEO_FRIO',
        requiresColdChain: true,
        quantity: 300,
        unit: 'litros',
        weightKg: 300,
      },
    ];

    const recommendation = recommendVehicle(selectedItems);
    assert.equal(
      recommendation.recommendedVehicle,
      'Torton_ThermoKing',
      'Debe recomendar Torton Thermo King debido a que la carga contiene lácteos fríos'
    );
    assert.equal(recommendation.requiresRefrigeration, true);
    assert.ok(recommendation.reason.includes('Thermo King'));

    // Consultar comunidades disponibles
    const commReq = new Request('http://localhost:3000/api/communities');
    const commRes = await getCommunities(commReq);
    const communities = await commRes.json();
    assert.ok(communities.length >= 3);

    // Calcular distancias Haversine desde CEDIS Celaya
    const stopsWithDistance = communities.map((c) => ({
      ...c,
      distanceKm: calculateHaversineDistanceKm(CEDIS_CELAYA.lat, CEDIS_CELAYA.lng, c.latitude, c.longitude),
    }));

    // Ordenar por proximidad
    stopsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    // Seleccionar las 2 paradas más cercanas
    const selectedStops = stopsWithDistance.slice(0, 2);
    assert.ok(selectedStops[0].distanceKm < 20, 'La comunidad más cercana debe estar a menos de 20 km');

    const circuit = calculateRouteCircuit(CEDIS_CELAYA, selectedStops);
    assert.ok(circuit.totalDistanceKm > 0);
    assert.ok(circuit.estimatedDurationMinutes > 0);
  });

  await t.test('Paso 4: Despacho Atómico de Ruta y Descuento de Stock en Bodega', async () => {
    const routeReq = new Request('http://localhost:3000/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleType: 'Torton_ThermoKing',
        driverName: 'Operador de Transporte #1',
        stops: [
          {
            communityId: 'comm-1',
            communityName: 'San Juan de la Vega',
            municipality: 'Celaya',
            latitude: 20.6278,
            longitude: -100.7634,
            representativeName: 'Representante Comunitario San Juan',
            phone: '461-000-0101',
          },
        ],
        dispatchedItems: [
          {
            batchId: newBatchId,
            productName: 'Leche Entera UHT 1L Cuadritos',
            lotCode: testLotCode,
            quantity: 300,
            unit: 'litros',
          },
        ],
        totalDistanceKm: 26.5,
      }),
    });

    const routeRes = await postRoutes(routeReq);
    assert.equal(routeRes.status, 201, 'La ruta debe crearse exitosamente');
    const routeJson = await routeRes.json();
    assert.ok(routeJson.routeCode.startsWith('RUT-'));
    assert.equal(routeJson.status, 'En_Transito');

    // Verificar que el stock en bodega se haya descontado de 500 a 200 litros
    const invReq = new Request('http://localhost:3000/api/inventory');
    const invRes = await getInventory(invReq);
    const { batches } = await invRes.json();
    const updatedBatch = batches.find((b) => b.id === newBatchId);
    assert.ok(updatedBatch, 'El lote debe existir');
    assert.equal(updatedBatch.currentQuantity, 200, 'El stock remanente debe ser exactamente 200 litros');
  });

  await t.test('Paso 5: Exportación a Excel y Verificación de las 3 Hojas de Trabajo', async () => {
    const exportReq = new Request('http://localhost:3000/api/excel/export');
    const exportRes = await exportExcel(exportReq);
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.headers.get('Content-Type').includes('spreadsheetml'));

    const arrayBuffer = await exportRes.arrayBuffer();
    assert.ok(arrayBuffer.byteLength > 0);

    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
    assert.deepEqual(workbook.SheetNames, ['Inventario Actual', 'Alertas de Caducidad', 'Historial de Rutas']);

    const invSheet = workbook.Sheets['Inventario Actual'];
    const invRows = XLSX.utils.sheet_to_json(invSheet);
    const excelBatch = invRows.find((r) => r['Lote'] === testLotCode);
    assert.ok(excelBatch, 'El lote debe figurar en el archivo Excel generado');
    assert.equal(excelBatch['Cantidad Actual'], 200, 'La cantidad en el Excel debe reflejar el descuento a 200 litros');
  });

  await t.test('Paso 6: Descarga de Plantilla e Importación Masiva de Hoja de Cálculo', async () => {
    // 6.1 Plantilla oficial
    const templateReq = new Request('http://localhost:3000/api/excel/template');
    const templateRes = await templateExcel(templateReq);
    assert.equal(templateRes.status, 200);
    const templateBuffer = await templateRes.arrayBuffer();
    const templateWb = XLSX.read(Buffer.from(templateBuffer), { type: 'buffer' });
    assert.ok(templateWb.SheetNames.includes('Plantilla_Inventario'));

    // 6.2 Generar archivo para importación masiva
    const importData = [
      {
        Codigo_Barras: '7500000000999',
        Producto: 'Queso Botanero FNVAC 500g',
        Donante: 'Cuadritos Biotek',
        Categoria: 'LACTEO_FRIO',
        Unidad: 'piezas',
        Area_Bodega: 'Camara_Fria',
        Lote: 'LOT-MASS-01',
        Fecha_Caducidad_YYYY_MM_DD: '2026-10-15',
        Cantidad: 120,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(importData);
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const excelBytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Simular FormData
    const formData = new FormData();
    const blob = new Blob([excelBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'carga_masiva.xlsx');

    const importReq = new Request('http://localhost:3000/api/excel/import', {
      method: 'POST',
      body: formData,
    });
    const importRes = await importExcel(importReq);
    assert.equal(importRes.status, 200);
    const importJson = await importRes.json();
    assert.equal(importJson.success, true);
    assert.equal(importJson.processedCount, 1);
  });
});
