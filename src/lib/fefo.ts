import type { FEFOStatus, StorageArea, InventoryBatch, Product, InventoryKPIs } from '../types/index';

/**
 * Normalizes a date or date string to midnight UTC timestamp for day-accurate calculations.
 */
function toMidnightTimestamp(dateInput: string | Date): number {
  if (typeof dateInput === 'string') {
    // Check if input is YYYY-MM-DD
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return Date.UTC(year, month, day);
    }
  }
  const d = new Date(dateInput);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Calculates remaining days from baseDate until expirationDate.
 * Can return negative numbers if the date is in the past.
 */
export function calculateDaysRemaining(expirationDate: string | Date, baseDate: Date = new Date()): number {
  const expMs = toMidnightTimestamp(expirationDate);
  const baseMs = toMidnightTimestamp(baseDate);
  const diffMs = expMs - baseMs;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determines FEFO semaphore status based on days remaining and available stock.
 * Rules:
 * - AGOTADO: currentQuantity <= 0
 * - CRITICO: <= 3 days remaining
 * - ATENCION: 4 - 7 days remaining
 * - ESTABLE: > 7 days remaining
 */
export function getFEFOStatus(daysRemaining: number, currentQuantity: number): FEFOStatus {
  if (currentQuantity <= 0) {
    return 'AGOTADO';
  }
  if (daysRemaining <= 3) {
    return 'CRITICO';
  }
  if (daysRemaining <= 7) {
    return 'ATENCION';
  }
  return 'ESTABLE';
}

/**
 * Returns true if the product batch has already passed its expiration date.
 */
export function isAlreadyExpired(expirationDate: string | Date, baseDate: Date = new Date()): boolean {
  return calculateDaysRemaining(expirationDate, baseDate) < 0;
}

/**
 * Sorts inventory batches according to First-Expired, First-Out (FEFO) principle.
 * Batches with earliest expiration dates are placed first.
 */
export function sortBatchesFEFO<T extends { expirationDate: string; currentQuantity?: number; lotCode?: string }>(
  batches: T[]
): T[] {
  return [...batches].sort((a, b) => {
    const hasStockA = (a.currentQuantity ?? 0) > 0;
    const hasStockB = (b.currentQuantity ?? 0) > 0;
    if (hasStockA !== hasStockB) return hasStockA ? -1 : 1;

    const timeA = toMidnightTimestamp(a.expirationDate);
    const timeB = toMidnightTimestamp(b.expirationDate);

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Tie-break 1: Quantity descending
    const qtyA = a.currentQuantity ?? 0;
    const qtyB = b.currentQuantity ?? 0;
    if (qtyA !== qtyB) {
      return qtyB - qtyA;
    }

    // Tie-break 2: Lot code alphabetical
    return (a.lotCode || '').localeCompare(b.lotCode || '');
  });
}

/**
 * Filters batches by specific warehouse storage area (Cámara Fría, Nave de Secos, Andén).
 */
export function filterByStorageArea<T extends { product?: { storageArea?: StorageArea }; storageArea?: StorageArea }>(
  batches: T[],
  area: StorageArea
): T[] {
  return batches.filter((b) => {
    const batchArea = b.product?.storageArea || b.storageArea;
    return batchArea === area;
  });
}

/**
 * Calculates summary KPIs for the inventory dashboard based on batches and FEFO classification.
 */
export function calculateInventoryKPIs(
  batches: (InventoryBatch & { product?: Product })[],
  baseDate: Date = new Date()
): InventoryKPIs {
  let totalQuantity = 0;
  let criticalBatchesCount = 0;
  let warningBatchesCount = 0;
  let stableBatchesCount = 0;
  let coldRoomCount = 0;
  let dryStorageCount = 0;
  let exhaustedBatchesCount = 0;

  for (const b of batches) {
    const days = calculateDaysRemaining(b.expirationDate, baseDate);
    const status = getFEFOStatus(days, b.currentQuantity);
    
    totalQuantity += b.currentQuantity;

    if (status === 'AGOTADO') {
      exhaustedBatchesCount++;
    } else if (status === 'CRITICO') {
      criticalBatchesCount++;
    } else if (status === 'ATENCION') {
      warningBatchesCount++;
    } else if (status === 'ESTABLE') {
      stableBatchesCount++;
    }

    const area = b.product?.storageArea;
    if (area === 'Camara_Fria') {
      coldRoomCount += b.currentQuantity;
    } else if (area === 'Nave_Secos') {
      dryStorageCount += b.currentQuantity;
    }
  }

  return {
    totalQuantity,
    criticalBatchesCount,
    warningBatchesCount,
    stableBatchesCount,
    coldRoomCount,
    dryStorageCount,
    exhaustedBatchesCount,
  };
}

/**
 * Normalizes text for search and matching: lowercase, removes diacritics / accents, trims.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Bidirectional and token-based donor matching ignoring stopwords and accents.
 */
export function matchDonor(productDonor: string, queryDonor: string): boolean {
  if (!productDonor || !queryDonor) return false;
  const normProd = normalizeText(productDonor);
  const normQuery = normalizeText(queryDonor);

  if (normProd === normQuery) return true;
  if (normProd.includes(normQuery) || normQuery.includes(normProd)) return true;

  const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e']);
  const prodTokens = normProd
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const queryTokens = normQuery
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return queryTokens.some((q) =>
    prodTokens.some((p) => p.includes(q) || q.includes(p))
  );
}

export type SortField = 'fefo' | 'days' | 'product' | 'lot' | 'quantity' | 'donor' | 'location';
export type SortDirection = 'asc' | 'desc';

const FEFO_STATUS_RANK: Record<FEFOStatus, number> = {
  CRITICO: 1,
  ATENCION: 2,
  ESTABLE: 3,
  AGOTADO: 4,
};

/**
 * Sorts inventory batches according to a specified field and direction,
 * maintaining a consistent FEFO status and expiration tie-break.
 */
export function sortInventoryBatches<T extends InventoryBatch>(
  batches: T[],
  field: SortField = 'fefo',
  direction: SortDirection = 'asc'
): T[] {
  return [...batches].sort((a, b) => {
    // Always send exhausted batches (currentQuantity <= 0 or status === 'AGOTADO') to the very bottom!
    const hasStockA = (a.currentQuantity ?? 0) > 0 && a.status !== 'AGOTADO';
    const hasStockB = (b.currentQuantity ?? 0) > 0 && b.status !== 'AGOTADO';
    if (hasStockA !== hasStockB) return hasStockA ? -1 : 1;

    const daysA = a.daysRemaining !== undefined ? a.daysRemaining : calculateDaysRemaining(a.expirationDate);
    const daysB = b.daysRemaining !== undefined ? b.daysRemaining : calculateDaysRemaining(b.expirationDate);

    let cmp = 0;

    switch (field) {
      case 'fefo': {
        const statusA = a.status || getFEFOStatus(daysA, a.currentQuantity);
        const statusB = b.status || getFEFOStatus(daysB, b.currentQuantity);
        const rankA = FEFO_STATUS_RANK[statusA] ?? 99;
        const rankB = FEFO_STATUS_RANK[statusB] ?? 99;
        cmp = rankA - rankB;
        if (cmp === 0) {
          cmp = daysA - daysB;
        }
        break;
      }
      case 'days': {
        cmp = daysA - daysB;
        break;
      }
      case 'product': {
        const nameA = a.product?.name || '';
        const nameB = b.product?.name || '';
        cmp = nameA.localeCompare(nameB, 'es');
        break;
      }
      case 'lot': {
        const lotA = a.lotCode || '';
        const lotB = b.lotCode || '';
        cmp = lotA.localeCompare(lotB, 'es', { numeric: true });
        break;
      }
      case 'quantity': {
        cmp = a.currentQuantity - b.currentQuantity;
        break;
      }
      case 'donor': {
        const donorA = a.product?.donorType || '';
        const donorB = b.product?.donorType || '';
        cmp = donorA.localeCompare(donorB, 'es');
        break;
      }
      case 'location': {
        const locA = a.product?.storageArea || '';
        const locB = b.product?.storageArea || '';
        cmp = locA.localeCompare(locB, 'es');
        break;
      }
      default:
        cmp = 0;
        break;
    }

    if (cmp !== 0) {
      return direction === 'desc' ? -cmp : cmp;
    }

    // Universal tie-break: daysRemaining asc, then quantity desc, then lotCode
    if (daysA !== daysB) {
      return daysA - daysB;
    }
    if (a.currentQuantity !== b.currentQuantity) {
      return b.currentQuantity - a.currentQuantity;
    }
    return (a.lotCode || '').localeCompare(b.lotCode || '', 'es', { numeric: true });
  });
}

