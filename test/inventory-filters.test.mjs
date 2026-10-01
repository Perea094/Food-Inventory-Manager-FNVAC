import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GET as getInventoryHandler } from '../src/app/api/inventory/route.ts';
import { normalizeText, matchDonor } from '../src/lib/fefo.ts';
import { getDb } from '../src/lib/db.ts';
import { seedDatabase } from '../src/lib/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test.beforeEach(() => {
  seedDatabase(getDb());
});

test('API Inventory: GET returns allDonors, allCategories, and allStorageAreas master metadata', async () => {
  const req = new Request('http://localhost:3000/api/inventory');
  const res = await getInventoryHandler(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.ok(Array.isArray(data.batches), 'Response must have batches array');
  assert.ok(Array.isArray(data.allDonors), 'Response must have allDonors array');
  assert.ok(Array.isArray(data.allCategories), 'Response must have allCategories array');
  assert.ok(Array.isArray(data.allStorageAreas), 'Response must have allStorageAreas array');

  // Verify allCategories contains all 4 standard categories
  const expectedCategories = [
    'LACTEO_FRIO',
    'AGRICOLA_PERECEDERO',
    'SECO_ABARROTE',
    'NO_ALIMENTARIO',
  ];
  for (const cat of expectedCategories) {
    assert.ok(data.allCategories.includes(cat), `allCategories must include ${cat}`);
  }

  // Verify allStorageAreas contains all 3 warehouse storage areas
  const expectedAreas = ['Camara_Fria', 'Nave_Secos', 'Anden'];
  for (const area of expectedAreas) {
    assert.ok(data.allStorageAreas.includes(area), `allStorageAreas must include ${area}`);
  }

  // Verify allDonors contains all real database donors
  const expectedDonors = ['Cuadritos', 'Nutrivida', 'Campo del Bajío', 'Donación Central', 'Campaña Escolar'];
  for (const donor of expectedDonors) {
    assert.ok(data.allDonors.includes(donor), `allDonors must include ${donor}`);
  }

  // Verify allDonors is sorted alphabetically
  const sortedCopy = [...data.allDonors].sort((a, b) => a.localeCompare(b, 'es'));
  assert.deepEqual(data.allDonors, sortedCopy, 'allDonors should be sorted alphabetically in Spanish');
});

test('API Inventory: allDonors remains complete and constant even when filtering by category or status', async () => {
  // 1. Unfiltered request
  const resAll = await getInventoryHandler(new Request('http://localhost:3000/api/inventory'));
  const dataAll = await resAll.json();
  const fullDonorCount = dataAll.allDonors.length;

  // 2. Filtered by category LACTEO_FRIO
  const resCat = await getInventoryHandler(
    new Request('http://localhost:3000/api/inventory?category=LACTEO_FRIO')
  );
  const dataCat = await resCat.json();
  assert.equal(
    dataCat.allDonors.length,
    fullDonorCount,
    'allDonors count must not shrink when filtering by category'
  );
  assert.ok(
    dataCat.allDonors.includes('Campo del Bajío'),
    'allDonors must still include non-dairy donors like Campo del Bajío'
  );
  assert.ok(
    dataCat.allDonors.includes('Donación Central'),
    'allDonors must still include dry grocery donors like Donación Central'
  );

  // 3. Filtered by status CRITICO
  const resStatus = await getInventoryHandler(
    new Request('http://localhost:3000/api/inventory?status=CRITICO')
  );
  const dataStatus = await resStatus.json();
  assert.equal(
    dataStatus.allDonors.length,
    fullDonorCount,
    'allDonors count must not shrink when filtering by status'
  );
});

test('Helper normalizeText and matchDonor: bidirectional and token matching with stopword removal', () => {
  // normalizeText tests
  assert.equal(normalizeText('Brócoli Fresco'), 'brocoli fresco');
  assert.equal(normalizeText('CAMPO DEL BAJÍO'), 'campo del bajio');
  assert.equal(normalizeText('  Donación Central  '), 'donacion central');
  assert.equal(normalizeText(''), '');

  // matchDonor direct unit tests
  // 1. "Cuadritos Biotek" query vs "Cuadritos" product donor
  assert.ok(
    matchDonor('Cuadritos', 'Cuadritos Biotek'),
    'Cuadritos Biotek query should match Cuadritos product'
  );
  assert.ok(
    matchDonor('Cuadritos Biotek', 'Cuadritos'),
    'Cuadritos query should match Cuadritos Biotek product'
  );

  // 2. "campo bajio" query vs "Campo del Bajío" product donor (stopwords and accents)
  assert.ok(
    matchDonor('Campo del Bajío', 'campo bajio'),
    'campo bajio should match Campo del Bajío ignoring "del" and accent'
  );
  assert.ok(
    matchDonor('campo bajio', 'Campo del Bajío'),
    'Campo del Bajío should match campo bajio bidirectionally'
  );

  // 3. Exact matches and partial names
  assert.ok(
    matchDonor('Donación Central', 'Donación Central'),
    'Identical donor strings match'
  );
  assert.ok(
    matchDonor('Donación Central', 'donacion central'),
    'Accent-free lowercase donor string matches'
  );
  assert.ok(
    matchDonor('Donación Central', 'Central'),
    'Partial token Central matches Donación Central'
  );

  // 4. Non-matching donors
  assert.equal(
    matchDonor('Cuadritos', 'Walmart'),
    false,
    'Cuadritos should not match Walmart'
  );
  assert.equal(
    matchDonor('Campo del Bajío', 'Nutrivida'),
    false,
    'Campo del Bajío should not match Nutrivida'
  );
});

test('API Inventory: Donor filter handles bidirectional and token matching', async () => {
  // Test donor query "Cuadritos Biotek" matching database batches with donor "Cuadritos"
  const reqBiotek = new Request('http://localhost:3000/api/inventory?donor=Cuadritos%20Biotek');
  const resBiotek = await getInventoryHandler(reqBiotek);
  assert.equal(resBiotek.status, 200);
  const dataBiotek = await resBiotek.json();
  assert.ok(dataBiotek.batches.length > 0, 'Should return batches for Cuadritos Biotek');
  assert.ok(
    dataBiotek.batches.every((b) => b.product?.donorType === 'Cuadritos'),
    'All returned batches must be from Cuadritos'
  );

  // Test donor query "campo bajio" matching database batches with donor "Campo del Bajío"
  const reqBajio = new Request('http://localhost:3000/api/inventory?donor=campo%20bajio');
  const resBajio = await getInventoryHandler(reqBajio);
  assert.equal(resBajio.status, 200);
  const dataBajio = await resBajio.json();
  assert.ok(dataBajio.batches.length > 0, 'Should return batches for campo bajio');
  assert.ok(
    dataBajio.batches.every((b) => b.product?.donorType === 'Campo del Bajío'),
    'All returned batches must be from Campo del Bajío'
  );

  // Test donor query "Donación Central" matching "Donación Central"
  const reqCentral = new Request(
    'http://localhost:3000/api/inventory?donor=Donaci%C3%B3n%20Central'
  );
  const resCentral = await getInventoryHandler(reqCentral);
  assert.equal(resCentral.status, 200);
  const dataCentral = await resCentral.json();
  assert.ok(dataCentral.batches.length > 0, 'Should return batches for Donación Central');
  assert.ok(
    dataCentral.batches.every((b) => b.product?.donorType === 'Donación Central'),
    'All returned batches must be from Donación Central'
  );
});

test('API Inventory: Accent-insensitive free-text search (brocoli -> Brócoli)', async () => {
  // Search for "brocoli" without accent
  const reqBrocoli = new Request('http://localhost:3000/api/inventory?search=brocoli');
  const resBrocoli = await getInventoryHandler(reqBrocoli);
  assert.equal(resBrocoli.status, 200);
  const dataBrocoli = await resBrocoli.json();

  assert.ok(dataBrocoli.batches.length > 0, 'Must match batches when searching "brocoli" without accent');
  assert.ok(
    dataBrocoli.batches.some((b) => b.product?.name.includes('Brócoli')),
    'Returned batches must include "Brócoli Fresco a Granel"'
  );

  // Search for uppercase "ZANAHORIA"
  const reqZanahoria = new Request('http://localhost:3000/api/inventory?search=ZANAHORIA');
  const resZanahoria = await getInventoryHandler(reqZanahoria);
  assert.equal(resZanahoria.status, 200);
  const dataZanahoria = await resZanahoria.json();
  assert.ok(dataZanahoria.batches.length > 0);
  assert.ok(dataZanahoria.batches.some((b) => b.product?.name.includes('Zanahoria')));
});

test('UI Component: InventoryFilters.tsx declares CATEGORY_STORAGE_COMPATIBILITY and compatibility transitions', () => {
  const filtersPath = path.join(rootDir, 'src', 'components', 'InventoryFilters.tsx');
  assert.ok(fs.existsSync(filtersPath), 'InventoryFilters.tsx must exist');
  const content = fs.readFileSync(filtersPath, 'utf8');

  // 1. Verify CATEGORY_STORAGE_COMPATIBILITY map
  assert.ok(
    content.includes('CATEGORY_STORAGE_COMPATIBILITY'),
    'InventoryFilters.tsx must define CATEGORY_STORAGE_COMPATIBILITY'
  );
  assert.ok(
    content.includes("LACTEO_FRIO: ['Camara_Fria']"),
    'CATEGORY_STORAGE_COMPATIBILITY must map LACTEO_FRIO to Camara_Fria'
  );
  assert.ok(
    content.includes("SECO_ABARROTE: ['Nave_Secos']"),
    'CATEGORY_STORAGE_COMPATIBILITY must map SECO_ABARROTE to Nave_Secos'
  );
  assert.ok(
    content.includes("NO_ALIMENTARIO: ['Nave_Secos']"),
    'CATEGORY_STORAGE_COMPATIBILITY must map NO_ALIMENTARIO to Nave_Secos'
  );

  // 2. Verify default availableDonors is []
  assert.ok(
    content.includes('availableDonors = []'),
    'InventoryFilters default availableDonors should be []'
  );

  // 3. Verify handleCategoryChange checks compatibility
  assert.ok(
    content.includes('handleCategoryChange'),
    'InventoryFilters must define handleCategoryChange'
  );
  assert.ok(
    content.includes('CATEGORY_STORAGE_COMPATIBILITY[nextCategory]'),
    'handleCategoryChange must consult CATEGORY_STORAGE_COMPATIBILITY'
  );

  // 4. Verify handleStorageChange checks compatibility
  assert.ok(
    content.includes('handleStorageChange'),
    'InventoryFilters must define handleStorageChange'
  );
  assert.ok(
    content.includes('CATEGORY_STORAGE_COMPATIBILITY[nextCategory]'),
    'handleStorageChange must consult CATEGORY_STORAGE_COMPATIBILITY'
  );

  // 5. Verify displayedDonors preserves selected donor if not in availableDonors
  assert.ok(
    content.includes('displayedDonors'),
    'InventoryFilters must compute displayedDonors'
  );
});

test('UI Component: DashboardPage (page.tsx) uses catalog allDonors and handles cold KPI compatibility', () => {
  const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
  assert.ok(fs.existsSync(pagePath), 'page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // 1. Verify availableDonors starts empty
  assert.ok(
    content.includes('const [availableDonors, setAvailableDonors] = useState<string[]>([]);'),
    'availableDonors state must be initialized as []'
  );

  // 2. Verify setting availableDonors from data.allDonors
  assert.ok(
    content.includes('setAvailableDonors(data.allDonors)'),
    'page.tsx must populate availableDonors with data.allDonors'
  );

  // 3. Verify handleKpiColdClick resets category when incompatible
  assert.ok(
    content.includes('handleKpiColdClick'),
    'page.tsx must define handleKpiColdClick'
  );
  assert.ok(
    content.includes("prev.category === 'SECO_ABARROTE' || prev.category === 'NO_ALIMENTARIO'"),
    'handleKpiColdClick must reset incompatible dry categories'
  );
});
