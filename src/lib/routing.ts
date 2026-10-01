import type { VehicleType } from '../types/index';
import { isAlreadyExpired, calculateDaysRemaining } from './fefo.ts';

export const CEDIS_CELAYA = {
  lat: 20.595,
  lng: -100.816,
  name: 'CEDIS Celaya (Km. 9 Carr. San Miguel)',
} as const;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ItemForRecommendation {
  category: string;
  requiresColdChain?: boolean;
  weightKg?: number;
  quantity?: number;
}

export interface VehicleRecommendation {
  recommendedVehicle: 'Torton_ThermoKing' | 'Camioneta_3_5T';
  reason: string;
  requiresRefrigeration: boolean;
  estimatedWeightKg: number;
}

export interface RouteCircuitResult {
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  legDistancesKm: number[];
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Sorts an array of communities by proximity to a given origin point (e.g. CEDIS Celaya).
 */
export function sortCommunitiesByProximity<T extends { latitude: number; longitude: number }>(
  origin: Coordinates,
  communities: T[]
): (T & { distanceKm: number })[] {
  const withDistance = communities.map((comm) => {
    const distanceKm = calculateHaversineDistanceKm(
      origin.lat,
      origin.lng,
      comm.latitude,
      comm.longitude
    );
    return {
      ...comm,
      distanceKm,
    };
  });

  return withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Evaluates vehicle requirements according to cold chain policy and cargo weight.
 * Rule:
 * - If any item is LACTEO_FRIO or AGRICOLA_PERECEDERO (or requiresColdChain), recommends Torton_ThermoKing.
 * - If total cargo weight > 3,500 kg, recommends Torton_ThermoKing.
 * - Otherwise, recommends Camioneta_3_5T.
 */
export function recommendVehicle(items: ItemForRecommendation[]): VehicleRecommendation {
  let requiresRefrigeration = false;
  let estimatedWeightKg = 0;

  for (const item of items) {
    if (
      item.requiresColdChain ||
      item.category === 'LACTEO_FRIO' ||
      item.category === 'AGRICOLA_PERECEDERO'
    ) {
      requiresRefrigeration = true;
    }

    if (item.weightKg) {
      estimatedWeightKg += item.weightKg;
    } else if (item.quantity) {
      // Approximate 1 unit/liter/kg = 1 kg if weight not directly given
      estimatedWeightKg += item.quantity;
    }
  }

  estimatedWeightKg = Math.round(estimatedWeightKg * 100) / 100;

  if (requiresRefrigeration) {
    return {
      recommendedVehicle: 'Torton_ThermoKing',
      reason: 'Requiere preservación estricta de cadena de frío Thermo King',
      requiresRefrigeration: true,
      estimatedWeightKg,
    };
  }

  if (estimatedWeightKg > 3500) {
    return {
      recommendedVehicle: 'Torton_ThermoKing',
      reason: `El peso estimado (${estimatedWeightKg} kg) excede la capacidad máxima de la Camioneta 3.5T (3,500 kg)`,
      requiresRefrigeration: false,
      estimatedWeightKg,
    };
  }

  return {
    recommendedVehicle: 'Camioneta_3_5T',
    reason: 'Carga seca estándar sin requerimiento de refrigeración',
    requiresRefrigeration: false,
    estimatedWeightKg,
  };
}

/**
 * Calculates a complete round-trip logistics circuit:
 * Origin -> Stop 1 -> Stop 2 -> ... -> Stop N -> Origin.
 * Returns total round-trip distance and estimated transit time in minutes.
 * Model: average transit speed 45 km/h + 15 minutes of community delivery per stop.
 */
export function calculateRouteCircuit(
  origin: Coordinates,
  stops: { latitude: number; longitude: number }[]
): RouteCircuitResult {
  if (!stops || stops.length === 0) {
    return {
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
      legDistancesKm: [],
    };
  }

  const legDistancesKm: number[] = [];
  let current = { lat: origin.lat, lng: origin.lng };
  let totalDistance = 0;

  // Visit all stops sequentially
  for (const stop of stops) {
    const legDistance = calculateHaversineDistanceKm(
      current.lat,
      current.lng,
      stop.latitude,
      stop.longitude
    );
    legDistancesKm.push(legDistance);
    totalDistance += legDistance;
    current = { lat: stop.latitude, lng: stop.longitude };
  }

  // Return to origin (CEDIS)
  const returnLeg = calculateHaversineDistanceKm(
    current.lat,
    current.lng,
    origin.lat,
    origin.lng
  );
  legDistancesKm.push(returnLeg);
  totalDistance += returnLeg;

  const totalDistanceKm = Math.round(totalDistance * 100) / 100;

  // Driving duration at 45 km/h: (km / 45) * 60 min = km * 1.333 min
  const drivingMinutes = (totalDistanceKm / 45) * 60;
  // Delivery handling time: 15 minutes per stop
  const stopHandlingMinutes = stops.length * 15;

  const estimatedDurationMinutes = Math.round(drivingMinutes + stopHandlingMinutes);

  return {
    totalDistanceKm,
    estimatedDurationMinutes,
    legDistancesKm,
  };
}

/**
 * Determines whether a batch is already expired and strictly ineligible for dispatch/routing.
 * Evaluates explicit 'VENCIDO' status, negative daysRemaining, or past expirationDate.
 */
export function isBatchExpiredForDispatch(
  batch: { expirationDate?: string | Date; status?: string; daysRemaining?: number },
  baseDate: Date = new Date()
): boolean {
  if (batch.status === 'VENCIDO') {
    return true;
  }
  if (batch.daysRemaining !== undefined && batch.daysRemaining < 0) {
    return true;
  }
  if (batch.expirationDate && isAlreadyExpired(batch.expirationDate, baseDate)) {
    return true;
  }
  return false;
}

export interface CriticalBatchesFilterResult<T> {
  eligibleBatches: T[];
  expiredExcludedCount: number;
}

/**
 * Filters warehouse inventory batches for critical FEFO routing (<= 7 days to expiration),
 * strictly shielding against expired items (VENCIDO, daysRemaining < 0, or past expiration date).
 */
export function filterCriticalBatchesForRouting<T extends {
  expirationDate: string | Date;
  currentQuantity: number;
  status?: any;
  daysRemaining?: number;
}>(
  batchList: T[],
  baseDate: Date = new Date()
): CriticalBatchesFilterResult<T> {
  const eligibleBatches: T[] = [];
  let expiredExcludedCount = 0;

  for (const b of batchList) {
    if ((b.currentQuantity ?? 0) <= 0) {
      continue;
    }

    const expired = isBatchExpiredForDispatch(b, baseDate);
    const days =
      b.daysRemaining !== undefined
        ? b.daysRemaining
        : calculateDaysRemaining(b.expirationDate, baseDate);

    const inCriticalWindow =
      b.status === 'CRITICO' || b.status === 'ATENCION' || days <= 7;

    if (inCriticalWindow) {
      if (expired || days < 0) {
        expiredExcludedCount++;
      } else if (days >= 0 && days <= 7) {
        eligibleBatches.push(b);
      }
    }
  }

  return { eligibleBatches, expiredExcludedCount };
}

export interface PriorityOptimizationOptions {
  priorityWeight?: number; // default 1.0
  maxPermutationStops?: number; // default 8
}

/**
 * Optimizes the sequence of route stops balancing geographic circuit efficiency
 * and community priority (number of families to feed).
 * - For stops.length <= maxPermutationStops (default 8): evaluates all permutations via exact
 *   combinatorial scoring: Total score = circuitTotalDistanceKm + (priorityWeight * weightedAverageArrivalDistKm)
 * - For stops.length > maxPermutationStops: utilizes a greedy nearest-weighted neighbor heuristic.
 * Returns a new array with stops re-indexed with order: 1, 2, ... N without mutating input.
 */
export function optimizeStopsPriorityAndProximity<
  T extends { latitude: number; longitude: number; beneficiariesCount?: number; order?: number }
>(
  origin: Coordinates,
  stops: T[],
  options?: PriorityOptimizationOptions
): T[] {
  if (!stops || stops.length === 0) {
    return [];
  }

  if (stops.length === 1) {
    return [{ ...stops[0], order: 1 }];
  }

  const priorityWeight = options?.priorityWeight ?? 1.0;
  const maxPermutationStops = options?.maxPermutationStops ?? 8;
  const n = stops.length;

  // Precalculate distance from origin and inter-stop distance matrix
  const distFromOrigin = stops.map((s) =>
    calculateHaversineDistanceKm(origin.lat, origin.lng, s.latitude, s.longitude)
  );

  const distBetween: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = calculateHaversineDistanceKm(
        stops[i].latitude,
        stops[i].longitude,
        stops[j].latitude,
        stops[j].longitude
      );
      distBetween[i][j] = d;
      distBetween[j][i] = d;
    }
  }

  const totalBeneficiaries = stops.reduce(
    (acc, s) => acc + Math.max(0, s.beneficiariesCount || 0),
    0
  );
  // If no stops define beneficiaries, treat each stop equally as 1 delivery unit
  const effectiveTotalBeneficiaries = totalBeneficiaries > 0 ? totalBeneficiaries : n;

  const calculateScore = (perm: number[]): { totalScore: number; circuitDist: number } => {
    let currentDist = distFromOrigin[perm[0]];
    let circuitDist = currentDist;
    const initialWeight =
      totalBeneficiaries > 0 ? Math.max(0, stops[perm[0]].beneficiariesCount || 0) : 1;
    let arrivalDistSumWeighted = initialWeight * currentDist;

    for (let i = 1; i < perm.length; i++) {
      const leg = distBetween[perm[i - 1]][perm[i]];
      circuitDist += leg;
      const stopWeight =
        totalBeneficiaries > 0 ? Math.max(0, stops[perm[i]].beneficiariesCount || 0) : 1;
      arrivalDistSumWeighted += stopWeight * circuitDist;
    }

    const returnLeg = distFromOrigin[perm[perm.length - 1]];
    circuitDist += returnLeg;

    const weightedAverageArrivalDistKm =
      arrivalDistSumWeighted / effectiveTotalBeneficiaries;

    const totalScore = circuitDist + priorityWeight * weightedAverageArrivalDistKm;
    return { totalScore, circuitDist };
  };

  if (n <= maxPermutationStops) {
    // Exact combinatorial permutation evaluation
    let bestScore = Infinity;
    let bestCircuitDist = Infinity;
    let bestPerm: number[] = [];

    const indices = Array.from({ length: n }, (_, i) => i);

    const permute = (arr: number[], l: number) => {
      if (l === n - 1) {
        const { totalScore, circuitDist } = calculateScore(arr);
        if (totalScore < bestScore - 1e-9) {
          bestScore = totalScore;
          bestCircuitDist = circuitDist;
          bestPerm = [...arr];
        } else if (
          Math.abs(totalScore - bestScore) <= 1e-9 &&
          circuitDist < bestCircuitDist - 1e-9
        ) {
          bestCircuitDist = circuitDist;
          bestPerm = [...arr];
        }
        return;
      }

      for (let i = l; i < n; i++) {
        const tmp = arr[l];
        arr[l] = arr[i];
        arr[i] = tmp;

        permute(arr, l + 1);

        arr[i] = arr[l];
        arr[l] = tmp;
      }
    };

    permute(indices, 0);

    return bestPerm.map((idx, orderIdx) => ({
      ...stops[idx],
      order: orderIdx + 1,
    }));
  }

  // Greedy nearest-weighted neighbor heuristic for n > maxPermutationStops
  const unvisited = new Set<number>(Array.from({ length: n }, (_, i) => i));
  const greedyIndices: number[] = [];
  let currentCoord: Coordinates = { lat: origin.lat, lng: origin.lng };

  while (unvisited.size > 0) {
    let bestCandidate = -1;
    let bestCandidateMetric = Infinity;
    let maxCandidateBeneficiaries = 0;

    for (const idx of unvisited) {
      const b = Math.max(0, stops[idx].beneficiariesCount || 0);
      if (b > maxCandidateBeneficiaries) {
        maxCandidateBeneficiaries = b;
      }
    }

    for (const idx of unvisited) {
      const dist = calculateHaversineDistanceKm(
        currentCoord.lat,
        currentCoord.lng,
        stops[idx].latitude,
        stops[idx].longitude
      );
      const b = Math.max(0, stops[idx].beneficiariesCount || 0);
      const weightFactor =
        maxCandidateBeneficiaries > 0
          ? 1 + priorityWeight * (b / maxCandidateBeneficiaries)
          : 1;
      const metric = dist / weightFactor;

      if (metric < bestCandidateMetric - 1e-9) {
        bestCandidateMetric = metric;
        bestCandidate = idx;
      } else if (Math.abs(metric - bestCandidateMetric) <= 1e-9) {
        // Tie break by larger beneficiaries, then smaller dist
        const currentBestB = Math.max(0, stops[bestCandidate].beneficiariesCount || 0);
        if (b > currentBestB) {
          bestCandidate = idx;
        }
      }
    }

    greedyIndices.push(bestCandidate);
    unvisited.delete(bestCandidate);
    currentCoord = {
      lat: stops[bestCandidate].latitude,
      lng: stops[bestCandidate].longitude,
    };
  }

  return greedyIndices.map((idx, orderIdx) => ({
    ...stops[idx],
    order: orderIdx + 1,
  }));
}

