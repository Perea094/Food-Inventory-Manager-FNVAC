import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDatabase,
  getDb,
  createProduct,
  createBatch,
  getFrequentProducts,
} from '../src/lib/db.ts';
import { GET as getProductsHandler } from '../src/app/api/products/route.ts';
import {
  RECENT_PRODUCTS_KEY,
  MAX_RECENT_PRODUCTS,
  getRecentProductsFromStorage,
  saveRecentProductToStorage,
  clearRecentProductsFromStorage,
  extractRecentProductsFromBatches,
  getCategoryBadgeClasses,
  getCategoryLabel,
} from '../src/lib/recent-products.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('Database: getFrequentProducts calculates batchCount, totalQuantity and respects ordering and limit', () => {
  const memDb = createDatabase(':memory:');

  const prodA = {
    id: 'p-a',
    barcode: '111111',
    name: 'Avena Molida',
    donorType: 'Donante A',
    category: 'SECO_ABARROTE',
    unit: 'kilos',
    storageArea: 'Nave_Secos',
    minStock: 10,
  };
  const prodB = {
    id: 'p-b',
    barcode: '222222',
    name: 'Brócoli Fresco',
    donorType: 'Donante B',
    category: 'AGRICOLA_PERECEDERO',
    unit: 'kilos',
    storageArea: 'Anden',
    minStock: 20,
  };
  const prodC = {
    id: 'p-c',
    barcode: '333333',
    name: 'Crema Ácida',
    donorType: 'Donante C',
    category: 'LACTEO_FRIO',
    unit: 'litros',
    storageArea: 'Camara_Fria',
    minStock: 15,
  };
  const prodD = {
    id: 'p-d',
    barcode: '444444',
    name: 'Detergente Industrial',
    donorType: 'Donante D',
    category: 'NO_ALIMENTARIO',
    unit: 'piezas',
    storageArea: 'Nave_Secos',
    minStock: 5,
  };

  createProduct(prodA, memDb);
  createProduct(prodB, memDb);
  createProduct(prodC, memDb);
  createProduct(prodD, memDb);

  // prodB gets 3 batches (highest batch count)
  createBatch({ id: 'b-b1', productId: 'p-b', lotCode: 'LOT-B1', expirationDate: '2026-10-01', currentQuantity: 20 }, memDb);
  createBatch({ id: 'b-b2', productId: 'p-b', lotCode: 'LOT-B2', expirationDate: '2026-10-02', currentQuantity: 30 }, memDb);
  createBatch({ id: 'b-b3', productId: 'p-b', lotCode: 'LOT-B3', expirationDate: '2026-10-03', currentQuantity: 50 }, memDb);

  // prodA gets 2 batches (total quantity = 150)
  createBatch({ id: 'b-a1', productId: 'p-a', lotCode: 'LOT-A1', expirationDate: '2026-11-01', currentQuantity: 50 }, memDb);
  createBatch({ id: 'b-a2', productId: 'p-a', lotCode: 'LOT-A2', expirationDate: '2026-11-02', currentQuantity: 100 }, memDb);

  // prodC gets 2 batches (total quantity = 40)
  createBatch({ id: 'b-c1', productId: 'p-c', lotCode: 'LOT-C1', expirationDate: '2026-09-25', currentQuantity: 20 }, memDb);
  createBatch({ id: 'b-c2', productId: 'p-c', lotCode: 'LOT-C2', expirationDate: '2026-09-26', currentQuantity: 20 }, memDb);

  // prodD gets 0 batches

  const results = getFrequentProducts(10, memDb);
  assert.equal(results.length, 4);

  // Order expectation: prodB (3 batches), prodA (2 batches, qty 150), prodC (2 batches, qty 40), prodD (0 batches)
  assert.equal(results[0].id, 'p-b');
  assert.equal(results[0].batchCount, 3);
  assert.equal(results[0].totalQuantity, 100);

  assert.equal(results[1].id, 'p-a');
  assert.equal(results[1].batchCount, 2);
  assert.equal(results[1].totalQuantity, 150);

  assert.equal(results[2].id, 'p-c');
  assert.equal(results[2].batchCount, 2);
  assert.equal(results[2].totalQuantity, 40);

  assert.equal(results[3].id, 'p-d');
  assert.equal(results[3].batchCount, 0);
  assert.equal(results[3].totalQuantity, 0);

  // Test limit
  const top2 = getFrequentProducts(2, memDb);
  assert.equal(top2.length, 2);
  assert.equal(top2[0].id, 'p-b');
  assert.equal(top2[1].id, 'p-a');
});

test('API Products: GET /api/products?frequent=true returns warehouse frequent products', async () => {
  // Default limit = 8
  const req = new Request('http://localhost:3000/api/products?frequent=true');
  const res = await getProductsHandler(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0 && data.length <= 8);

  for (const item of data) {
    assert.ok(item.id);
    assert.ok(item.name);
    assert.ok(typeof item.batchCount === 'number');
    assert.ok(typeof item.totalQuantity === 'number');
  }

  // Custom limit = 3
  const reqLimit = new Request('http://localhost:3000/api/products?frequent=true&limit=3');
  const resLimit = await getProductsHandler(reqLimit);
  assert.equal(resLimit.status, 200);
  const dataLimit = await resLimit.json();
  assert.equal(dataLimit.length, 3);
});

test('API Products: GET /api/products?q=... performs accent-insensitive search on name, barcode, donor, and category', async () => {
  // 1. Accent-insensitive product name: "brocoli" -> "Brócoli Fresco a Granel"
  const reqBrocoli = new Request('http://localhost:3000/api/products?q=brocoli');
  const resBrocoli = await getProductsHandler(reqBrocoli);
  assert.equal(resBrocoli.status, 200);
  const dataBrocoli = await resBrocoli.json();
  assert.ok(dataBrocoli.length > 0);
  assert.ok(dataBrocoli.some((p) => p.name.includes('Brócoli')));

  // 2. Accent-insensitive donor name: "bajio" -> "Campo del Bajío"
  const reqBajio = new Request('http://localhost:3000/api/products?q=bajio');
  const resBajio = await getProductsHandler(reqBajio);
  assert.equal(resBajio.status, 200);
  const dataBajio = await resBajio.json();
  assert.ok(dataBajio.length > 0);
  assert.ok(dataBajio.every((p) => p.donorType.toLowerCase().includes('bajío') || p.name.toLowerCase().includes('bajio')));

  // 3. Category match: "lacteo frio" or "lacteo" -> LACTEO_FRIO
  const reqLacteo = new Request('http://localhost:3000/api/products?q=lacteo+frio');
  const resLacteo = await getProductsHandler(reqLacteo);
  assert.equal(resLacteo.status, 200);
  const dataLacteo = await resLacteo.json();
  assert.ok(dataLacteo.length > 0);
  assert.ok(dataLacteo.every((p) => p.category === 'LACTEO_FRIO' || p.name.toLowerCase().includes('lacteo')));

  // 4. Exact barcode match via q: "7501020511111"
  const reqBarcode = new Request('http://localhost:3000/api/products?q=7501020511111');
  const resBarcode = await getProductsHandler(reqBarcode);
  assert.equal(resBarcode.status, 200);
  const dataBarcode = await resBarcode.json();
  assert.equal(dataBarcode.length, 1);
  assert.equal(dataBarcode[0].barcode, '7501020511111');

  // 5. Query with no match returns empty array
  const reqEmpty = new Request('http://localhost:3000/api/products?q=inexistente999xyz');
  const resEmpty = await getProductsHandler(reqEmpty);
  assert.equal(resEmpty.status, 200);
  const dataEmpty = await resEmpty.json();
  assert.equal(dataEmpty.length, 0);
});

test('Recent Products: Helper functions, constants, and category badges', () => {
  assert.equal(RECENT_PRODUCTS_KEY, 'fnvac_recent_products');
  assert.equal(MAX_RECENT_PRODUCTS, 8);

  // Category Badges & Labels
  assert.ok(getCategoryBadgeClasses('LACTEO_FRIO').includes('cyan'));
  assert.ok(getCategoryBadgeClasses('AGRICOLA_PERECEDERO').includes('emerald'));
  assert.ok(getCategoryBadgeClasses('SECO_ABARROTE').includes('amber'));
  assert.ok(getCategoryBadgeClasses('NO_ALIMENTARIO').includes('purple'));
  assert.ok(getCategoryBadgeClasses('UNKNOWN').includes('slate'));

  assert.equal(getCategoryLabel('LACTEO_FRIO'), 'Lácteo Frío');
  assert.equal(getCategoryLabel('AGRICOLA_PERECEDERO'), 'Agrícola Perecedero');
  assert.equal(getCategoryLabel('SECO_ABARROTE'), 'Seco / Abarrote');
  assert.equal(getCategoryLabel('NO_ALIMENTARIO'), 'No Alimentario');

  // extractRecentProductsFromBatches
  const dummyBatches = [
    {
      id: 'b1',
      productId: 'p1',
      lotCode: 'L1',
      expirationDate: '2026-10-01',
      currentQuantity: 10,
      receivedAt: '2026-09-17T10:00:00Z',
      product: { id: 'p1', barcode: '111', name: 'Prod 1', category: 'SECO_ABARROTE', donorType: 'D1', unit: 'kilos', storageArea: 'Nave_Secos', minStock: 0, createdAt: '' },
    },
    {
      id: 'b2',
      productId: 'p1', // duplicate product
      lotCode: 'L2',
      expirationDate: '2026-10-02',
      currentQuantity: 20,
      receivedAt: '2026-09-17T11:00:00Z',
      product: { id: 'p1', barcode: '111', name: 'Prod 1', category: 'SECO_ABARROTE', donorType: 'D1', unit: 'kilos', storageArea: 'Nave_Secos', minStock: 0, createdAt: '' },
    },
    {
      id: 'b3',
      productId: 'p2',
      lotCode: 'L3',
      expirationDate: '2026-10-03',
      currentQuantity: 30,
      receivedAt: '2026-09-17T09:00:00Z',
      product: { id: 'p2', barcode: '222', name: 'Prod 2', category: 'LACTEO_FRIO', donorType: 'D2', unit: 'litros', storageArea: 'Camara_Fria', minStock: 0, createdAt: '' },
    },
  ];

  const extracted = extractRecentProductsFromBatches(dummyBatches, 5);
  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].id, 'p1'); // Received at 11:00 (latest)
  assert.equal(extracted[1].id, 'p2'); // Received at 09:00

  // extract with limit 1
  const extracted1 = extractRecentProductsFromBatches(dummyBatches, 1);
  assert.equal(extracted1.length, 1);
  assert.equal(extracted1[0].id, 'p1');

  // empty or invalid input
  assert.deepEqual(extractRecentProductsFromBatches([]), []);
});

test('Recent Products: Browser localStorage simulation (SSR safety & CRUD)', () => {
  // 1. SSR safety: without global window/localStorage, returns [] without throwing
  const initialSSR = getRecentProductsFromStorage();
  assert.deepEqual(initialSSR, []);

  // 2. Setup mock localStorage
  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  const originalWindow = global.window;
  const originalStorage = global.localStorage;

  try {
    global.window = {};
    global.localStorage = mockLocalStorage;

    // Initial empty
    assert.deepEqual(getRecentProductsFromStorage(), []);

    const p1 = { id: 'p1', barcode: '111', name: 'P1', donorType: 'D1', category: 'SECO_ABARROTE', unit: 'kilos', storageArea: 'Nave_Secos', minStock: 0, createdAt: '' };
    const p2 = { id: 'p2', barcode: '222', name: 'P2', donorType: 'D2', category: 'LACTEO_FRIO', unit: 'litros', storageArea: 'Camara_Fria', minStock: 0, createdAt: '' };

    // Save p1
    saveRecentProductToStorage(p1);
    let items = getRecentProductsFromStorage();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'p1');

    // Save p2 -> p2 comes first
    saveRecentProductToStorage(p2);
    items = getRecentProductsFromStorage();
    assert.equal(items.length, 2);
    assert.equal(items[0].id, 'p2');
    assert.equal(items[1].id, 'p1');

    // Re-save p1 -> moves to front without duplicating
    saveRecentProductToStorage(p1);
    items = getRecentProductsFromStorage();
    assert.equal(items.length, 2);
    assert.equal(items[0].id, 'p1');
    assert.equal(items[1].id, 'p2');

    // Test limit truncation
    for (let i = 3; i <= 12; i++) {
      saveRecentProductToStorage({ id: `p${i}`, barcode: `code-${i}`, name: `Prod ${i}`, donorType: 'D', category: 'SECO_ABARROTE', unit: 'kilos', storageArea: 'Nave_Secos', minStock: 0, createdAt: '' }, 4);
    }
    items = getRecentProductsFromStorage();
    assert.equal(items.length, 4);

    // Clear storage
    clearRecentProductsFromStorage();
    assert.deepEqual(getRecentProductsFromStorage(), []);
  } finally {
    global.window = originalWindow;
    global.localStorage = originalStorage;
  }
});

test('UI Component: CatalogSearchModal contains recent history, frequent products, tactile classes, and quick-add actions', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'CatalogSearchModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'CatalogSearchModal.tsx must exist');

  const content = fs.readFileSync(modalPath, 'utf8');

  // Verify sections
  assert.ok(content.includes('Historial Reciente'), 'Must contain "Historial Reciente" section');
  assert.ok(content.includes('Artículos Más Comunes del Almacén'), 'Must contain "Artículos Más Comunes del Almacén" section');
  assert.ok(content.includes('/api/products?frequent=true'), 'Must fetch frequent products from /api/products?frequent=true');

  // Verify quick action buttons
  assert.ok(
    content.includes('+ Registrar producto inexistente'),
    'Must contain "+ Registrar producto inexistente" quick action button'
  );
  assert.ok(
    content.includes('como nuevo producto'),
    'Must allow registering non-existent query as a new product in empty state'
  );

  // Verify tactile styling
  assert.ok(content.includes('active:scale-95'), 'Must contain active:scale-95 tactile press feedback');
  assert.ok(content.includes('cursor-pointer'), 'Must contain cursor-pointer');

  // Verify search debounce and clear button
  assert.ok(content.includes('debouncedQuery'), 'Must debounce search query');
  assert.ok(content.includes('Limpiar búsqueda') || content.includes('handleClearInput'), 'Must provide clear button for search input');

  // Verify keyboard navigation
  assert.ok(content.includes('Enter'), 'Must support Enter key shortcut for selecting first search result');
});

test('UI Integration: recepcion/page.tsx integrates CatalogSearchModal and stores recent products', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'recepcion', 'page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify import and usage of CatalogSearchModal
  assert.ok(content.includes("import CatalogSearchModal from '../../components/CatalogSearchModal.tsx'"), 'Must import CatalogSearchModal');
  assert.ok(content.includes('<CatalogSearchModal'), 'Must render CatalogSearchModal');

  // Verify import and invocation of saveRecentProductToStorage
  assert.ok(content.includes("import { saveRecentProductToStorage } from '../../lib/recent-products.ts'"), 'Must import saveRecentProductToStorage');
  assert.ok(content.includes('saveRecentProductToStorage('), 'Must invoke saveRecentProductToStorage');
});
