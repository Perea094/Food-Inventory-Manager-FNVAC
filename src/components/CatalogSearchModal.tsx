'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  PlusCircle,
  Package,
  Barcode,
  Loader2,
  Building2,
  Layers,
  Trash2,
} from 'lucide-react';
import Modal from './Modal.tsx';
import {
  getRecentProductsFromStorage,
  clearRecentProductsFromStorage,
  extractRecentProductsFromBatches,
  getCategoryBadgeClasses,
  getCategoryLabel,
} from '../lib/recent-products.ts';
import type { Product, InventoryBatch } from '../types/index';

export interface CatalogSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onAddNewProduct?: (suggestedName?: string) => void;
  recentBatches?: InventoryBatch[];
}

export default function CatalogSearchModal({
  isOpen,
  onClose,
  onSelectProduct,
  onAddNewProduct,
  recentBatches = [],
}: CatalogSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [frequentProducts, setFrequentProducts] = useState<
    (Product & { batchCount?: number; totalQuantity?: number })[]
  >([]);
  const [isLoadingFrequent, setIsLoadingFrequent] = useState(false);

  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens and reset query
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDebouncedQuery('');
      setSearchResults([]);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Load Recent Products from Storage & Batches
  useEffect(() => {
    if (isOpen) {
      const fromStorage = getRecentProductsFromStorage();
      const fromBatches = recentBatches ? extractRecentProductsFromBatches(recentBatches) : [];
      const combined: Product[] = [];
      const seen = new Set<string>();

      for (const p of [...fromStorage, ...fromBatches]) {
        if (p && p.id && !seen.has(p.id)) {
          seen.add(p.id);
          combined.push(p);
        }
      }
      setRecentProducts(combined.slice(0, 8));
    }
  }, [isOpen, recentBatches]);

  // Fetch Frequent Products on modal open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchFrequent = async () => {
      try {
        setIsLoadingFrequent(true);
        const res = await fetch('/api/products?frequent=true&limit=8');
        if (res.ok && isMounted) {
          const data = await res.json();
          setFrequentProducts(data);
        }
      } catch (err) {
        console.warn('Error fetching frequent products:', err);
      } finally {
        if (isMounted) setIsLoadingFrequent(false);
      }
    };
    fetchFrequent();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Debounce search query input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query updates
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    const executeSearch = async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api/products?q=${encodeURIComponent(trimmed)}`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.warn('Error searching products in catalog:', err);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    };

    executeSearch();
    return () => {
      isCurrent = false;
    };
  }, [debouncedQuery]);

  const handleClearInput = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleClearRecent = () => {
    clearRecentProductsFromStorage();
    const fallback = recentBatches ? extractRecentProductsFromBatches(recentBatches) : [];
    setRecentProducts(fallback.slice(0, 8));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      onSelectProduct(searchResults[0]);
    }
  };

  const handleQuickAdd = (suggested?: string) => {
    onClose();
    if (onAddNewProduct) {
      onAddNewProduct(suggested || searchQuery.trim());
    }
  };

  const isQueryEmpty = !searchQuery.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Búsqueda Dinámica en Catálogo"
      description="Localice cualquier producto por nombre, código de barras, donante o categoría."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Search Input Bar with Debounce & Clear Button */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar por nombre, código, donante o categoría (ej. Leche, Brócoli, Cuadritos)..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400 font-medium transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />

          {searchQuery && (
            <button
              type="button"
              onClick={handleClearInput}
              title="Limpiar búsqueda"
              className="absolute right-3 top-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic Mode: Live Filtered Results */}
        {!isQueryEmpty && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
              <span>Resultados de búsqueda</span>
              {isSearching ? (
                <span className="flex items-center gap-1 text-fnvac-blue-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...
                </span>
              ) : (
                <span>
                  {searchResults.length} {searchResults.length === 1 ? 'coincidencia' : 'coincidencias'}
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {searchResults.map((prod) => {
                const badgeStyle = getCategoryBadgeClasses(prod.category);
                const catLabel = getCategoryLabel(prod.category);

                return (
                  <div
                    key={prod.id}
                    className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-fnvac-blue-200 hover:bg-fnvac-blue-50/40 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{prod.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}
                        >
                          {catLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prod.barcode}</span>
                        </span>
                        <span className="flex items-center gap-1 font-sans">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prod.donorType}</span>
                        </span>
                        <span className="font-sans text-slate-400">&bull;</span>
                        <span className="font-sans text-slate-600 font-semibold">{prod.unit}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-fnvac-blue-600 hover:bg-fnvac-blue-700 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer self-end sm:self-center select-none"
                    >
                      <span>Seleccionar</span>
                    </button>
                  </div>
                );
              })}

              {/* Empty state when no matches */}
              {!isSearching && searchResults.length === 0 && (
                <div className="py-8 text-center space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700">
                      No encontramos ningún producto que coincida con &quot;{searchQuery}&quot;.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Puede darlo de alta inmediatamente en el catálogo institucional.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickAdd(searchQuery)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fnvac-blue-800 bg-fnvac-blue-100 hover:bg-fnvac-blue-200 border border-fnvac-blue-300 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <PlusCircle className="w-4 h-4 text-fnvac-blue-700" />
                    <span>+ Registrar &quot;{searchQuery}&quot; como nuevo producto</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Mode: Empty Query (Historial Reciente + Artículos Comunes + Quick Add) */}
        {isQueryEmpty && (
          <div className="space-y-5">
            {/* Section 1: Historial Reciente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-fnvac-blue-600" />
                  <span>Historial Reciente</span>
                </div>
                {recentProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
                    title="Limpiar productos recientes"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>

              {recentProducts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentProducts.map((prod) => (
                    <button
                      key={`recent-${prod.id}`}
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-fnvac-blue-50 text-slate-700 hover:text-fnvac-blue-900 border border-slate-200 hover:border-fnvac-blue-300 transition-all active:scale-95 cursor-pointer shadow-2xs group"
                    >
                      <span>{prod.name}</span>
                      <span className="text-[10px] text-slate-400 group-hover:text-fnvac-blue-700">
                        ({prod.unit})
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-1">
                  No hay productos en el historial reciente de este equipo.
                </p>
              )}
            </div>

            {/* Section 2: Artículos Más Comunes del Almacén */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <TrendingUp className="w-3.5 h-3.5 text-fnvac-blue-600" />
                  <span>Artículos Más Comunes del Almacén</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Mayor rotación histórica</span>
              </div>

              {isLoadingFrequent ? (
                <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-fnvac-blue-600" />
                  <span>Cargando productos comunes...</span>
                </div>
              ) : frequentProducts.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {frequentProducts.map((prod) => {
                    const badgeStyle = getCategoryBadgeClasses(prod.category);
                    const catLabel = getCategoryLabel(prod.category);

                    return (
                      <div
                        key={`freq-${prod.id}`}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-fnvac-blue-200 hover:bg-fnvac-blue-50/40 transition-all"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {prod.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${badgeStyle}`}
                            >
                              {catLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono text-slate-400 truncate">{prod.barcode}</span>
                            <span>&bull;</span>
                            <span className="text-slate-600 font-medium">{prod.donorType}</span>
                            {Boolean(prod.batchCount && prod.batchCount > 0) && (
                              <>
                                <span>&bull;</span>
                                <span className="font-semibold text-fnvac-blue-700 bg-fnvac-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                  {prod.batchCount} {prod.batchCount === 1 ? 'lote' : 'lotes'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectProduct(prod)}
                          className="px-3 py-1.5 text-xs font-semibold text-fnvac-blue-700 bg-fnvac-blue-50 hover:bg-fnvac-blue-600 hover:text-white rounded-lg border border-fnvac-blue-200 transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                        >
                          Seleccionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  No se encontraron productos frecuentes en la base de datos.
                </p>
              )}
            </div>

            {/* Quick Action Footer: Registrar Producto Inexistente */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                ¿No encuentra el producto en la lista?
              </p>
              <button
                type="button"
                onClick={() => handleQuickAdd()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-fnvac-blue-800 bg-fnvac-blue-100 hover:bg-fnvac-blue-200 border border-fnvac-blue-300 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs select-none"
              >
                <PlusCircle className="w-4 h-4 text-fnvac-blue-700" />
                <span>+ Registrar producto inexistente</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
