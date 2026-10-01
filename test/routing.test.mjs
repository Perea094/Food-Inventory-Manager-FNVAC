import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CEDIS_CELAYA,
  calculateHaversineDistanceKm,
  sortCommunitiesByProximity,
  recommendVehicle,
  calculateRouteCircuit,
} from '../src/lib/routing.ts';

test('Routing: Haversine distance calculations around Celaya', () => {
  // Distance to itself should be 0
  const distZero = calculateHaversineDistanceKm(CEDIS_CELAYA.lat, CEDIS_CELAYA.lng, CEDIS_CELAYA.lat, CEDIS_CELAYA.lng);
  assert.equal(distZero, 0);

  // CEDIS to San Juan de la Vega (20.6278, -100.7634) -> approx 6.6 km
  const distSanJuan = calculateHaversineDistanceKm(CEDIS_CELAYA.lat, CEDIS_CELAYA.lng, 20.6278, -100.7634);
  assert.ok(distSanJuan > 6 && distSanJuan < 8, `Distance ${distSanJuan} should be between 6 and 8 km`);

  // CEDIS to Cortazar Centro (20.4819, -100.9633) -> approx 19.8 km
  const distCortazar = calculateHaversineDistanceKm(CEDIS_CELAYA.lat, CEDIS_CELAYA.lng, 20.4819, -100.9633);
  assert.ok(distCortazar > 18 && distCortazar < 22, `Distance ${distCortazar} should be between 18 and 22 km`);
});

test('Routing: sortCommunitiesByProximity from CEDIS', () => {
  const sampleCommunities = [
    { name: 'Cortazar Centro', latitude: 20.4819, longitude: -100.9633 }, // ~19.8 km
    { name: 'San Miguel Octopan', latitude: 20.5897, longitude: -100.7381 }, // ~8.1 km
    { name: 'San Juan de la Vega', latitude: 20.6278, longitude: -100.7634 }, // ~6.6 km
  ];

  const sorted = sortCommunitiesByProximity(CEDIS_CELAYA, sampleCommunities);

  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].name, 'San Juan de la Vega');
  assert.equal(sorted[1].name, 'San Miguel Octopan');
  assert.equal(sorted[2].name, 'Cortazar Centro');

  assert.ok(sorted[0].distanceKm < sorted[1].distanceKm);
  assert.ok(sorted[1].distanceKm < sorted[2].distanceKm);
});

test('Routing: recommendVehicle logic for cold chain and weight capacity', () => {
  // 1. Cold chain items (LACTEO_FRIO) -> Torton Thermo King
  const dairyItems = [
    { category: 'LACTEO_FRIO', weightKg: 200 },
    { category: 'SECO_ABARROTE', weightKg: 100 },
  ];
  const recDairy = recommendVehicle(dairyItems);
  assert.equal(recDairy.recommendedVehicle, 'Torton_ThermoKing');
  assert.equal(recDairy.requiresRefrigeration, true);
  assert.ok(recDairy.reason.includes('Thermo King'));

  // 2. Perishable agricultural items (AGRICOLA_PERECEDERO) -> Torton Thermo King
  const produceItems = [{ category: 'AGRICOLA_PERECEDERO', weightKg: 500 }];
  const recProduce = recommendVehicle(produceItems);
  assert.equal(recProduce.recommendedVehicle, 'Torton_ThermoKing');
  assert.equal(recProduce.requiresRefrigeration, true);

  // 3. Dry items under 3500kg -> Camioneta 3.5T
  const dryItemsLight = [
    { category: 'SECO_ABARROTE', weightKg: 1000 },
    { category: 'NO_ALIMENTARIO', weightKg: 200 },
  ];
  const recDryLight = recommendVehicle(dryItemsLight);
  assert.equal(recDryLight.recommendedVehicle, 'Camioneta_3_5T');
  assert.equal(recDryLight.requiresRefrigeration, false);
  assert.ok(recDryLight.reason.includes('Carga seca estándar'));

  // 4. Dry items exceeding 3500kg -> Torton Thermo King due to heavy capacity
  const dryItemsHeavy = [{ category: 'SECO_ABARROTE', weightKg: 4200 }];
  const recDryHeavy = recommendVehicle(dryItemsHeavy);
  assert.equal(recDryHeavy.recommendedVehicle, 'Torton_ThermoKing');
  assert.equal(recDryHeavy.requiresRefrigeration, false);
  assert.ok(recDryHeavy.reason.includes('3,500 kg'));
});

test('Routing: calculateRouteCircuit round-trip calculations', () => {
  // Empty stops
  const emptyCircuit = calculateRouteCircuit(CEDIS_CELAYA, []);
  assert.equal(emptyCircuit.totalDistanceKm, 0);
  assert.equal(emptyCircuit.estimatedDurationMinutes, 0);

  // Circuit with 2 stops: CEDIS -> San Juan de la Vega -> San Miguel Octopan -> CEDIS
  const stops = [
    { latitude: 20.6278, longitude: -100.7634 }, // San Juan (~6.6km from CEDIS)
    { latitude: 20.5897, longitude: -100.7381 }, // Octopan (~4.9km from San Juan)
  ];

  const circuit = calculateRouteCircuit(CEDIS_CELAYA, stops);

  // 3 legs: CEDIS->San Juan, San Juan->Octopan, Octopan->CEDIS
  assert.equal(circuit.legDistancesKm.length, 3);
  assert.ok(circuit.totalDistanceKm > 15 && circuit.totalDistanceKm < 25);
  // Duration includes transit at 45km/h + 30 minutes for 2 stops
  assert.ok(circuit.estimatedDurationMinutes > 30);
});
