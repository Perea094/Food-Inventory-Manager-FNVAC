import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import { calculateDaysRemaining, getFEFOStatus, sortBatchesFEFO } from './fefo.ts';
import type { ProductCategory, UnitType, StorageArea } from '../types/index';

const VALID_CATEGORIES: ProductCategory[] = [
  'LACTEO_FRIO',
  'AGRICOLA_PERECEDERO',
  'SECO_ABARROTE',
  'NO_ALIMENTARIO',
];

const VALID_UNITS: UnitType[] = ['piezas', 'kilos', 'cajas', 'litros'];

const VALID_STORAGE_AREAS: StorageArea[] = ['Camara_Fria', 'Nave_Secos', 'Anden'];

export interface ParsedInventoryRow {
  barcode: string;
  name: string;
  donorType: string;
  category: ProductCategory;
  unit: UnitType;
  storageArea: StorageArea;
  lotCode: string;
  expirationDate: string; // YYYY-MM-DD
  quantity: number;
}

export interface ParseResult {
  validRows: ParsedInventoryRow[];
  errors: string[];
}

/**
 * Generates official 3-sheet Excel report:
 * 1. Inventario Actual
 * 2. Alertas de Caducidad (Critical and Warning batches sorted by FEFO)
 * 3. Historial de Rutas
 */
export function generateInventoryWorkbook(
  products: any[],
  batches: any[],
  routes: any[] = []
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Inventario Actual
  const inventoryRows = batches.map((b) => {
    const prod = b.product || products.find((p) => p.id === b.productId) || {};
    const days = calculateDaysRemaining(b.expirationDate);
    const status = getFEFOStatus(days, b.currentQuantity);

    return {
      'Código de Barras': prod.barcode || '',
      Producto: prod.name || '',
      Donante: prod.donorType || '',
      Categoría: prod.category || '',
      Unidad: prod.unit || '',
      'Área Bodega': prod.storageArea || '',
      Lote: b.lotCode,
      'Fecha Caducidad': b.expirationDate,
      'Días Restantes': days,
      'Estado FEFO': status,
      'Cantidad Actual': b.currentQuantity,
    };
  });

  const wsInventory = XLSX.utils.json_to_sheet(
    inventoryRows.length > 0 ? inventoryRows : [{ 'Sin datos': 'No hay lotes en inventario' }]
  );
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario Actual');

  // 2. Alertas de Caducidad (Sorted by earliest expiration)
  const sortedBatches = sortBatchesFEFO(batches);
  const alertBatches = sortedBatches.filter((b) => {
    const days = calculateDaysRemaining(b.expirationDate);
    const status = getFEFOStatus(days, b.currentQuantity);
    return status === 'CRITICO' || status === 'ATENCION';
  });

  const alertRows = alertBatches.map((b) => {
    const prod = b.product || products.find((p) => p.id === b.productId) || {};
    const days = calculateDaysRemaining(b.expirationDate);
    const status = getFEFOStatus(days, b.currentQuantity);

    return {
      'Estado FEFO': status,
      'Días Restantes': days,
      Producto: prod.name || '',
      Lote: b.lotCode,
      'Fecha Caducidad': b.expirationDate,
      Cantidad: b.currentQuantity,
      Unidad: prod.unit || '',
      'Área de Almacén': prod.storageArea || '',
      'Código de Barras': prod.barcode || '',
    };
  });

  const wsAlerts = XLSX.utils.json_to_sheet(
    alertRows.length > 0 ? alertRows : [{ 'Sin Alertas': 'No hay lotes con vencimiento próximo' }]
  );
  XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alertas de Caducidad');

  // 3. Historial de Rutas
  const routeRows = routes.map((r) => {
    const stops = typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops || [];
    const items = typeof r.dispatchedItems === 'string' ? JSON.parse(r.dispatchedItems) : r.dispatchedItems || [];
    const totalDispatched = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);

    return {
      'Código de Ruta': r.routeCode,
      'Fecha Creación': r.createdAt,
      Vehículo: r.vehicleType,
      Chofer: r.driverName,
      Estado: r.status,
      'Distancia Total (km)': r.totalDistanceKm,
      'Número de Paradas': stops.length,
      'Total Unidades Despachadas': totalDispatched,
    };
  });

  const wsRoutes = XLSX.utils.json_to_sheet(
    routeRows.length > 0 ? routeRows : [{ 'Sin Rutas': 'No hay rutas de despacho registradas' }]
  );
  XLSX.utils.book_append_sheet(wb, wsRoutes, 'Historial de Rutas');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

/**
 * Generates standard Excel template for bulk inventory upload.
 */
export function generateTemplateWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const templateRows = [
    {
      Codigo_Barras: '7501020522222',
      Producto: 'Queso Panela 400g Cuadritos',
      Donante: 'Cuadritos',
      Categoria: 'LACTEO_FRIO',
      Unidad: 'piezas',
      Area_Bodega: 'Camara_Fria',
      Lote: 'LT-QP-2601',
      Fecha_Caducidad_YYYY_MM_DD: '2026-09-25',
      Cantidad: 50,
    },
    {
      Codigo_Barras: '7501020577777',
      Producto: 'Arroz Grano Grueso 1kg',
      Donante: 'Donación Central',
      Categoria: 'SECO_ABARROTE',
      Unidad: 'kilos',
      Area_Bodega: 'Nave_Secos',
      Lote: 'LT-AR-2601',
      Fecha_Caducidad_YYYY_MM_DD: '2026-12-30',
      Cantidad: 300,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Inventario');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

/**
 * Formats a Date object or string to standard 'YYYY-MM-DD'.
 */
function normalizeDateString(dateVal: any): string | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getUTCFullYear();
    const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateVal).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Parses and validates Excel workbook from uploaded buffer or Uint8Array.
 */
export function parseInventoryFile(buffer: ArrayBuffer | Uint8Array): ParseResult {
  const errors: string[] = [];
  const validRows: ParsedInventoryRow[] = [];

  let wb: WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (err: any) {
    return {
      validRows: [],
      errors: [`Error al procesar el archivo Excel: ${err.message || 'Formato no soportado'}`],
    };
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return { validRows: [], errors: ['El archivo Excel no contiene hojas de datos.'] };
  }

  const sheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[sheetName];
  if (!worksheet) {
    return { validRows: [], errors: ['La hoja de cálculo está vacía o dañada.'] };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    return { validRows: [], errors: ['La hoja de cálculo no contiene filas de datos para procesar.'] };
  }

  // Column name normalization helper
  const findValue = (row: Record<string, any>, keys: string[]): any => {
    for (const k of Object.keys(row)) {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const target of keys) {
        if (cleanKey === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          return row[k];
        }
      }
    }
    return undefined;
  };

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // Row number in typical Excel file (Header is Row 1)
    const rowErrors: string[] = [];

    const barcode = String(findValue(row, ['Codigo_Barras', 'CodigoBarras', 'Código de Barras', 'barcode']) || '').trim();
    const name = String(findValue(row, ['Producto', 'Nombre', 'name']) || '').trim();
    const donorType = String(findValue(row, ['Donante', 'donorType']) || '').trim();
    const rawCategory = String(findValue(row, ['Categoria', 'Categoría', 'category']) || '').trim().toUpperCase();
    const rawUnit = String(findValue(row, ['Unidad', 'unit']) || '').trim().toLowerCase();
    const rawArea = String(findValue(row, ['Area_Bodega', 'AreaBodega', 'Área Bodega', 'storageArea']) || '').trim();
    const lotCode = String(findValue(row, ['Lote', 'lotCode']) || '').trim();
    const rawExpDate = findValue(row, ['Fecha_Caducidad_YYYY_MM_DD', 'Fecha_Caducidad', 'FechaCaducidad', 'expirationDate']);
    const rawQty = findValue(row, ['Cantidad', 'currentQuantity', 'qty']);

    if (!barcode) {
      rowErrors.push('Código de barras vacío');
    }
    if (!name) {
      rowErrors.push('Nombre de producto vacío');
    }
    if (!donorType) {
      rowErrors.push('Tipo o nombre de donante vacío');
    }

    if (!VALID_CATEGORIES.includes(rawCategory as ProductCategory)) {
      rowErrors.push(
        `Categoría inválida "${rawCategory}". Permitidas: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    if (!VALID_UNITS.includes(rawUnit as UnitType)) {
      rowErrors.push(`Unidad inválida "${rawUnit}". Permitidas: ${VALID_UNITS.join(', ')}`);
    }

    if (!VALID_STORAGE_AREAS.includes(rawArea as StorageArea)) {
      rowErrors.push(
        `Área de almacenamiento inválida "${rawArea}". Permitidas: ${VALID_STORAGE_AREAS.join(', ')}`
      );
    }

    if (!lotCode) {
      rowErrors.push('Código de lote vacío');
    }

    const normalizedDate = normalizeDateString(rawExpDate);
    if (!normalizedDate) {
      rowErrors.push(`Fecha de caducidad inválida: "${rawExpDate}". Use formato YYYY-MM-DD`);
    }

    const quantity = parseFloat(rawQty);
    if (isNaN(quantity) || quantity <= 0) {
      rowErrors.push(`Cantidad inválida: "${rawQty}". Debe ser un número mayor a 0`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Fila ${rowNum}: ${rowErrors.join('; ')}.`);
    } else {
      validRows.push({
        barcode,
        name,
        donorType,
        category: rawCategory as ProductCategory,
        unit: rawUnit as UnitType,
        storageArea: rawArea as StorageArea,
        lotCode,
        expirationDate: normalizedDate!,
        quantity,
      });
    }
  });

  return { validRows, errors };
}
