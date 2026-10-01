import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSXModule from 'xlsx';
import {
  generateTemplateWorkbook,
  generateInventoryWorkbook,
  parseInventoryFile,
} from '../src/lib/excel.ts';

const XLSX = XLSXModule.default || XLSXModule;

test('Excel: generateTemplateWorkbook produces valid template and parses correctly', () => {
  const templateBuffer = generateTemplateWorkbook();
  assert.ok(templateBuffer instanceof Uint8Array, 'Must return Uint8Array');
  assert.ok(templateBuffer.length > 0, 'Buffer must not be empty');

  // Verify it can be parsed back
  const parseResult = parseInventoryFile(templateBuffer);
  assert.equal(parseResult.errors.length, 0, 'Official template should have 0 errors');
  assert.equal(parseResult.validRows.length, 2, 'Official template has 2 sample rows');
  assert.equal(parseResult.validRows[0].barcode, '7501020522222');
  assert.equal(parseResult.validRows[0].category, 'LACTEO_FRIO');
  assert.equal(parseResult.validRows[1].category, 'SECO_ABARROTE');
});

test('Excel: generateInventoryWorkbook creates 3 sheets with expected structure', () => {
  const products = [
    {
      id: 'p1',
      barcode: '7501020511111',
      name: 'Leche UHT',
      donorType: 'Cuadritos',
      category: 'LACTEO_FRIO',
      unit: 'litros',
      storageArea: 'Camara_Fria',
    },
  ];

  const batches = [
    {
      id: 'b1',
      productId: 'p1',
      lotCode: 'LT-01',
      expirationDate: '2026-09-19', // Critical (<= 3 days)
      currentQuantity: 40,
      product: products[0],
    },
    {
      id: 'b2',
      productId: 'p1',
      lotCode: 'LT-02',
      expirationDate: '2026-12-01', // Stable (> 7 days)
      currentQuantity: 100,
      product: products[0],
    },
  ];

  const routes = [
    {
      routeCode: 'RT-001',
      createdAt: '2026-09-17 10:00:00',
      vehicleType: 'Torton_ThermoKing',
      driverName: 'Juan Pérez',
      status: 'Planificada',
      totalDistanceKm: 25.4,
      stops: [{ name: 'San Juan de la Vega' }],
      dispatchedItems: [{ productName: 'Leche UHT', quantity: 20 }],
    },
  ];

  const wbBuffer = generateInventoryWorkbook(products, batches, routes);
  assert.ok(wbBuffer instanceof Uint8Array);

  const readWb = XLSX.read(wbBuffer, { type: 'array' });
  assert.deepEqual(readWb.SheetNames, [
    'Inventario Actual',
    'Alertas de Caducidad',
    'Historial de Rutas',
  ]);

  const inventoryRows = XLSX.utils.sheet_to_json(readWb.Sheets['Inventario Actual']);
  assert.equal(inventoryRows.length, 2);

  const alertRows = XLSX.utils.sheet_to_json(readWb.Sheets['Alertas de Caducidad']);
  // Only batch b1 should be in alerts because b2 expires in December
  assert.equal(alertRows.length, 1);
  assert.equal(alertRows[0]['Lote'], 'LT-01');

  const routeRows = XLSX.utils.sheet_to_json(readWb.Sheets['Historial de Rutas']);
  assert.equal(routeRows.length, 1);
  assert.equal(routeRows[0]['Código de Ruta'], 'RT-001');
});

test('Excel: parseInventoryFile handles validations and errors', () => {
  // 1. Build a test workbook with invalid entries
  const wb = XLSX.utils.book_new();
  const testData = [
    {
      // Row 2: Valid
      Codigo_Barras: '7501020599999',
      Producto: 'Aceite 1L',
      Donante: 'Donación Central',
      Categoria: 'SECO_ABARROTE',
      Unidad: 'litros',
      Area_Bodega: 'Nave_Secos',
      Lote: 'LT-AC-01',
      Fecha_Caducidad_YYYY_MM_DD: '2026-11-20',
      Cantidad: 80,
    },
    {
      // Row 3: Missing barcode and invalid category
      Codigo_Barras: '',
      Producto: 'Carne Congelada',
      Donante: 'Donación',
      Categoria: 'CATEGORIA_INVALIDA',
      Unidad: 'kilos',
      Area_Bodega: 'Camara_Fria',
      Lote: 'LT-XX',
      Fecha_Caducidad_YYYY_MM_DD: '2026-10-10',
      Cantidad: 10,
    },
    {
      // Row 4: Negative quantity and invalid unit
      Codigo_Barras: '7501020588888',
      Producto: 'Frijol',
      Donante: 'Donación',
      Categoria: 'SECO_ABARROTE',
      Unidad: 'toneladas',
      Area_Bodega: 'Nave_Secos',
      Lote: 'LT-FJ',
      Fecha_Caducidad_YYYY_MM_DD: '2026-12-31',
      Cantidad: -15,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  const buffer = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  const result = parseInventoryFile(buffer);

  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].barcode, '7501020599999');
  assert.equal(result.validRows[0].quantity, 80);

  // Errors should be reported for row 3 and row 4
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors[0].includes('Fila 3'));
  assert.ok(result.errors[0].includes('Código de barras vacío'));
  assert.ok(result.errors[0].includes('Categoría inválida'));

  assert.ok(result.errors[1].includes('Fila 4'));
  assert.ok(result.errors[1].includes('Unidad inválida'));
  assert.ok(result.errors[1].includes('Cantidad inválida'));
});

test('Excel: parseInventoryFile handles invalid buffer gracefully', () => {
  const invalidBuffer = new Uint8Array([1, 2, 3, 4, 5]);
  const result = parseInventoryFile(invalidBuffer);
  assert.equal(result.validRows.length, 0);
  assert.ok(result.errors.length > 0);
});
