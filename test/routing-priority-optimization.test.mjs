import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CEDIS_CELAYA,
  calculateHaversineDistanceKm,
  optimizeStopsPriorityAndProximity,
} from '../src/lib/routing.ts';

test('Routing Priority: Empty stops and single stop edge cases', () => {
  // Empty stops array
  const emptyResult = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, []);
  assert.deepEqual(emptyResult, []);

  // Single stop
  const singleStop = {
    id: 'comm-1',
    name: 'San Juan de la Vega',
    latitude: 20.6278,
    longitude: -100.7634,
    beneficiariesCount: 350,
    order: 5,
  };

  const singleInput = [singleStop];
  const singleResult = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, singleInput);

  assert.equal(singleResult.length, 1);
  assert.equal(singleResult[0].id, 'comm-1');
  assert.equal(singleResult[0].order, 1);
  // Immutability: original array and original stop object must not be mutated
  assert.equal(singleInput[0].order, 5);
  assert.notEqual(singleResult[0], singleStop);
});

test('Routing Priority: Identical distances with different beneficiaries (Priority dominates)', () => {
  // Two equidistant stops from CEDIS Celaya:
  // CEDIS: 20.595, -100.816
  // Stop North is +0.10 deg lat (~11.12 km)
  // Stop South is -0.10 deg lat (~11.12 km)
  const stopNorth = {
    id: 'north',
    name: 'Comunidad Norte',
    latitude: 20.695,
    longitude: -100.816,
    beneficiariesCount: 80, // Lower priority
  };

  const stopSouth = {
    id: 'south',
    name: 'Comunidad Sur',
    latitude: 20.495,
    longitude: -100.816,
    beneficiariesCount: 650, // Higher priority: 650 families
  };

  // Input provided with North first
  const stops = [stopNorth, stopSouth];
  const optimized = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, stops);

  assert.equal(optimized.length, 2);
  // South has significantly more families needing food, so South should be visited FIRST
  assert.equal(optimized[0].id, 'south', 'Higher priority community must be visited first');
  assert.equal(optimized[0].order, 1);
  assert.equal(optimized[1].id, 'north', 'Lower priority community visited second');
  assert.equal(optimized[1].order, 2);

  // Immutability check
  assert.equal(stops[0].id, 'north');
  assert.equal(stops[1].id, 'south');
});

test('Routing Priority: Natural corridor progression (Proximity with priority alignment)', () => {
  // 3 communities along a northward transit corridor
  const stop1 = {
    id: 'comm-km5',
    name: 'Parada Km 5',
    latitude: 20.645,
    longitude: -100.816,
    beneficiariesCount: 60,
  };
  const stop2 = {
    id: 'comm-km14',
    name: 'Parada Km 14',
    latitude: 20.725,
    longitude: -100.816,
    beneficiariesCount: 180,
  };
  const stop3 = {
    id: 'comm-km24',
    name: 'Parada Km 24',
    latitude: 20.815,
    longitude: -100.816,
    beneficiariesCount: 90,
  };

  // Provide out of order
  const stops = [stop3, stop1, stop2];
  const optimized = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, stops);

  // The sequential corridor [stop1 -> stop2 -> stop3] avoids unnecessary backtracking
  assert.equal(optimized[0].id, 'comm-km5');
  assert.equal(optimized[0].order, 1);
  assert.equal(optimized[1].id, 'comm-km14');
  assert.equal(optimized[1].order, 2);
  assert.equal(optimized[2].id, 'comm-km24');
  assert.equal(optimized[2].order, 3);
});

test('Routing Priority: Anti-absurd-detour test (Distance prevents excessive detour for minor priority gains)', () => {
  // Near cluster (within 1-4 km)
  const near1 = {
    id: 'near-1',
    name: 'Comunidad Cercana 1',
    latitude: 20.605,
    longitude: -100.816,
    beneficiariesCount: 100,
  };
  const near2 = {
    id: 'near-2',
    name: 'Comunidad Cercana 2',
    latitude: 20.625,
    longitude: -100.816,
    beneficiariesCount: 100,
  };
  // Distant community (110+ km away) with only slightly higher beneficiaries (105 vs 100)
  const far = {
    id: 'far-outlier',
    name: 'Comunidad Lejana Outlier',
    latitude: 21.595,
    longitude: -100.816,
    beneficiariesCount: 105,
  };

  const stops = [far, near1, near2];
  const optimized = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, stops);

  // Visiting the 110km outlier first would add over 200 km to the arrival distance of both near communities.
  // The algorithm must serve the near cluster first.
  assert.notEqual(optimized[0].id, 'far-outlier', 'Should not detour 110+ km first for a tiny priority difference');
  assert.equal(optimized[2].id, 'far-outlier');
  assert.equal(optimized[2].order, 3);
});

test('Routing Priority: N > 8 greedy fallback test', () => {
  // Create 10 stops across Guanajuato
  const tenStops = [
    { id: 's1', name: 'Stop 1', latitude: 20.61, longitude: -100.80, beneficiariesCount: 120 },
    { id: 's2', name: 'Stop 2', latitude: 20.63, longitude: -100.78, beneficiariesCount: 80 },
    { id: 's3', name: 'Stop 3', latitude: 20.65, longitude: -100.75, beneficiariesCount: 400 },
    { id: 's4', name: 'Stop 4', latitude: 20.58, longitude: -100.85, beneficiariesCount: 50 },
    { id: 's5', name: 'Stop 5', latitude: 20.55, longitude: -100.88, beneficiariesCount: 220 },
    { id: 's6', name: 'Stop 6', latitude: 20.52, longitude: -100.90, beneficiariesCount: 110 },
    { id: 's7', name: 'Stop 7', latitude: 20.67, longitude: -100.72, beneficiariesCount: 300 },
    { id: 's8', name: 'Stop 8', latitude: 20.50, longitude: -100.95, beneficiariesCount: 95 },
    { id: 's9', name: 'Stop 9', latitude: 20.48, longitude: -100.97, beneficiariesCount: 150 },
    { id: 's10', name: 'Stop 10', latitude: 20.46, longitude: -100.99, beneficiariesCount: 75 },
  ];

  const startTime = Date.now();
  const optimized = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, tenStops);
  const elapsedMs = Date.now() - startTime;

  // Performance check: greedy fallback should execute in under 100ms
  assert.ok(elapsedMs < 200, `Execution took ${elapsedMs}ms, should be fast via greedy fallback`);

  // Preserves all 10 stops
  assert.equal(optimized.length, 10);

  // Each stop has correct sequential order 1..10
  optimized.forEach((s, idx) => {
    assert.equal(s.order, idx + 1);
  });

  // Unique stop IDs preserved
  const ids = new Set(optimized.map((s) => s.id));
  assert.equal(ids.size, 10);
  for (const s of tenStops) {
    assert.ok(ids.has(s.id), `Stop ${s.id} must be in result`);
  }

  // Explicit maxPermutationStops override test:
  // With 4 stops and maxPermutationStops: 3, it should invoke the greedy branch
  const fourStops = tenStops.slice(0, 4);
  const greedyOverride = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, fourStops, {
    maxPermutationStops: 3,
  });
  assert.equal(greedyOverride.length, 4);
  assert.equal(greedyOverride[0].order, 1);
  assert.equal(greedyOverride[3].order, 4);
});

test('Routing Priority: Zero or undefined beneficiaries defaults to distance minimization', () => {
  const stopsWithoutBeneficiaries = [
    { id: 'far', name: 'Lejana', latitude: 20.80, longitude: -100.80 },
    { id: 'close', name: 'Cercana', latitude: 20.60, longitude: -100.81 },
  ];

  const optimized = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, stopsWithoutBeneficiaries);
  assert.equal(optimized.length, 2);
  // Pure distance: Cercana must be visited first
  assert.equal(optimized[0].id, 'close');
  assert.equal(optimized[0].order, 1);
  assert.equal(optimized[1].id, 'far');
  assert.equal(optimized[1].order, 2);
});

test('Routing Priority: UI Integration verification in rutas/page.tsx', () => {
  const filePath = path.resolve('src/app/rutas/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 1. Imports optimizeStopsPriorityAndProximity
  assert.ok(
    content.includes('optimizeStopsPriorityAndProximity'),
    'rutas/page.tsx must import optimizeStopsPriorityAndProximity'
  );

  // 2. Defines handleOptimizeProposedRoute
  assert.ok(
    content.includes('handleOptimizeProposedRoute'),
    'rutas/page.tsx must define handleOptimizeProposedRoute'
  );

  // 3. Guards against fewer than 2 stops
  assert.ok(
    content.includes('selectedStops.length < 2'),
    'rutas/page.tsx must check selectedStops.length < 2'
  );
  assert.ok(
    content.includes('Agrega al menos 2 comunidades al itinerario para optimizar la secuencia.'),
    'rutas/page.tsx must display validation message for < 2 stops'
  );

  // 4. Card 3 button renders "Optimizar Secuencia (Prioridades y Distancia)"
  assert.ok(
    content.includes('Optimizar Secuencia (Prioridades y Distancia)'),
    'rutas/page.tsx must render Optimizar Secuencia button text'
  );
  assert.ok(
    content.includes('onClick={handleOptimizeProposedRoute}'),
    'Card 3 button must trigger handleOptimizeProposedRoute'
  );

  // 5. Old handleSuggestNearest is completely removed
  assert.ok(
    !content.includes('handleSuggestNearest'),
    'rutas/page.tsx must not contain obsolete handleSuggestNearest'
  );

  // 6. Empty state text mentions Optimizar Secuencia
  assert.ok(
    content.includes('Optimizar Secuencia'),
    'rutas/page.tsx empty state text must reference Optimizar Secuencia'
  );
});
