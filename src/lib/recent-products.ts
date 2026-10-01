import type { Product, InventoryBatch, ProductCategory } from '../types/index';

export const RECENT_PRODUCTS_KEY = 'fnvac_recent_products';
export const MAX_RECENT_PRODUCTS = 8;

/**
 * Retrieves recent products stored in browser localStorage.
 * Safely handles SSR and storage parsing errors.
 */
export function getRecentProductsFromStorage(): Product[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(RECENT_PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Product =>
        Boolean(item && typeof item === 'object' && item.id && item.name && item.barcode)
    );
  } catch {
    return [];
  }
}

/**
 * Saves a product to recent storage, deduplicating by ID and barcode.
 * Prepends the item so the most recent is at the front, truncated to limit.
 */
export function saveRecentProductToStorage(
  product: Product,
  limit: number = MAX_RECENT_PRODUCTS
): Product[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  if (!product || !product.id) {
    return getRecentProductsFromStorage();
  }

  try {
    const current = getRecentProductsFromStorage();
    const filtered = current.filter(
      (p) => p.id !== product.id && p.barcode !== product.barcode
    );
    const updated = [product, ...filtered].slice(0, Math.max(1, limit));
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all recent products from browser localStorage.
 */
export function clearRecentProductsFromStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(RECENT_PRODUCTS_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Extracts unique recent products from inventory batches (ordered by receivedAt desc).
 * Useful as an immediate fallback or supplement to browser storage.
 */
export function extractRecentProductsFromBatches(
  batches: InventoryBatch[],
  limit: number = MAX_RECENT_PRODUCTS
): Product[] {
  if (!Array.isArray(batches) || batches.length === 0) {
    return [];
  }

  // Sort batches by receivedAt descending if available
  const sorted = [...batches].sort((a, b) => {
    const timeA = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const timeB = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return timeB - timeA;
  });

  const seen = new Set<string>();
  const products: Product[] = [];

  for (const b of sorted) {
    if (b.product && b.product.id && !seen.has(b.product.id)) {
      seen.add(b.product.id);
      if (b.product.barcode) seen.add(b.product.barcode);
      products.push(b.product);
      if (products.length >= limit) break;
    }
  }

  return products;
}

/**
 * Returns Tailwind badge classes according to product category.
 */
export function getCategoryBadgeClasses(cat: ProductCategory | string): string {
  switch (cat) {
    case 'LACTEO_FRIO':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'AGRICOLA_PERECEDERO':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SECO_ABARROTE':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'NO_ALIMENTARIO':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

/**
 * Returns human-readable Spanish label for product categories.
 */
export function getCategoryLabel(cat: ProductCategory | string): string {
  switch (cat) {
    case 'LACTEO_FRIO':
      return 'Lácteo Frío';
    case 'AGRICOLA_PERECEDERO':
      return 'Agrícola Perecedero';
    case 'SECO_ABARROTE':
      return 'Seco / Abarrote';
    case 'NO_ALIMENTARIO':
      return 'No Alimentario';
    default:
      return String(cat || 'General').replace(/_/g, ' ');
  }
}
