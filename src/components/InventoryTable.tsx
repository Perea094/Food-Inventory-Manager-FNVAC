'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Truck,
  Edit3,
  Snowflake,
  Package,
  Calendar,
  Barcode,
  Building,
  AlertCircle,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';
import StatusBadge from './StatusBadge.tsx';
import type { InventoryBatch, ProductCategory, StorageArea } from '../types/index';
import {
  sortInventoryBatches,
  type SortField,
  type SortDirection,
} from '../lib/fefo.ts';

export interface InventoryTableProps {
  batches: InventoryBatch[];
  isLoading?: boolean;
  onEditStock: (batch: InventoryBatch) => void;
  onDeleteBatch?: (batch: InventoryBatch) => void;
  onResetFilters?: () => void;
  hideExhausted?: boolean;
  onToggleHideExhausted?: (hide: boolean) => void;
}

const sortLabels: Record<SortField, { asc: string; desc: string }> = {
  fefo: {
    asc: 'Semáforo FEFO (Prioridad Crítica)',
    desc: 'Semáforo FEFO (Inverso - Estables primero)',
  },
  days: {
    asc: 'Caducidad (Próximos a vencer)',
    desc: 'Caducidad (Más lejanos)',
  },
  product: {
    asc: 'Producto (A → Z)',
    desc: 'Producto (Z → A)',
  },
  lot: {
    asc: 'Código de Lote (A → Z)',
    desc: 'Código de Lote (Z → A)',
  },
  quantity: {
    asc: 'Existencia (Menor a mayor)',
    desc: 'Existencia (Mayor a menor)',
  },
  donor: {
    asc: 'Donante (A → Z)',
    desc: 'Donante (Z → A)',
  },
  location: {
    asc: 'Ubicación (A → Z)',
    desc: 'Ubicación (Z → A)',
  },
};

const categoryLabels: Record<ProductCategory, { label: string; badgeClass: string }> = {
  LACTEO_FRIO: {
    label: 'Lácteo Frío',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  AGRICOLA_PERECEDERO: {
    label: 'Agrícola Perecedero',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  SECO_ABARROTE: {
    label: 'Seco / Abarrote',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  NO_ALIMENTARIO: {
    label: 'No Alimentario',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

const storageAreaLabels: Record<
  StorageArea,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  Camara_Fria: {
    label: 'Cámara Fría',
    icon: Snowflake,
    badgeClass: 'bg-cyan-100/70 text-cyan-800 border-cyan-300',
  },
  Nave_Secos: {
    label: 'Nave de Secos',
    icon: Package,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  Anden: {
    label: 'Andén',
    icon: Building,
    badgeClass: 'bg-amber-100/70 text-amber-800 border-amber-300',
  },
};

function formatExpiration(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return dateString;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  batches,
  isLoading = false,
  onEditStock,
  onDeleteBatch,
  onResetFilters,
  hideExhausted,
  onToggleHideExhausted,
}) => {
  const [sortField, setSortField] = useState<SortField>('fefo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [internalHideExhausted, setInternalHideExhausted] = useState(false);

  const effectiveHideExhausted = hideExhausted !== undefined ? hideExhausted : internalHideExhausted;

  const handleToggleHideExhausted = (checked: boolean) => {
    setInternalHideExhausted(checked);
    onToggleHideExhausted?.(checked);
  };

  const displayBatches = useMemo(() => {
    if (effectiveHideExhausted) {
      return batches.filter((b) => (b.currentQuantity ?? 0) > 0 && b.status !== 'AGOTADO');
    }
    return batches;
  }, [batches, effectiveHideExhausted]);

  const sortedBatches = useMemo(
    () => sortInventoryBatches(displayBatches, sortField, sortDirection),
    [displayBatches, sortField, sortDirection]
  );

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'quantity' ? 'desc' : 'asc');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-fnvac-blue-600 border-r-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 font-medium">
          Cargando inventario y evaluando semáforo FEFO...
        </p>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <Package className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">No se encontraron lotes</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          No hay lotes que coincidan con los filtros de búsqueda o el almacén está vacío.
        </p>
        {onResetFilters && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-fnvac-blue-600 text-white hover:bg-fnvac-blue-700 shadow-xs transition-all active:scale-95 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros y mostrar todo el inventario</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Accessible Sort Bar Toolbar */}
      <div className="p-3 sm:px-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5 text-fnvac-blue-600" />
            <label htmlFor="inventory-sort-select">Ordenar por:</label>
          </div>
          <select
            id="inventory-sort-select"
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
              setSortField(field);
              setSortDirection(direction);
            }}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 transition-all cursor-pointer font-medium"
            aria-label="Criterio de ordenación de inventario"
          >
            <option value="fefo-asc">Semáforo FEFO (Prioridad Crítica)</option>
            <option value="fefo-desc">Semáforo FEFO (Inverso - Estables primero)</option>
            <option value="days-asc">Caducidad (Próximos a vencer)</option>
            <option value="days-desc">Caducidad (Más lejanos)</option>
            <option value="product-asc">Producto (A → Z)</option>
            <option value="product-desc">Producto (Z → A)</option>
            <option value="quantity-desc">Existencia (Mayor a menor)</option>
            <option value="quantity-asc">Existencia (Menor a mayor)</option>
            <option value="lot-asc">Código de Lote (A → Z)</option>
            <option value="lot-desc">Código de Lote (Z → A)</option>
            <option value="donor-asc">Donante (A → Z)</option>
            <option value="donor-desc">Donante (Z → A)</option>
            <option value="location-asc">Ubicación (A → Z)</option>
            <option value="location-desc">Ubicación (Z → A)</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
            title={`Cambiar dirección (actual: ${sortDirection === 'asc' ? 'Ascendente' : 'Descendente'})`}
            aria-label="Invertir dirección de orden"
          >
            {sortDirection === 'asc' ? (
              <>
                <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600" />
                <span>Ascendente</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600" />
                <span>Descendente</span>
              </>
            )}
          </button>

          {(sortField !== 'fefo' || sortDirection !== 'asc') && (
            <button
              type="button"
              onClick={() => {
                setSortField('fefo');
                setSortDirection('asc');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-fnvac-blue-700 bg-fnvac-blue-50 hover:bg-fnvac-blue-100 rounded-lg border border-fnvac-blue-200 transition-all active:scale-95 cursor-pointer select-none"
              title="Restablecer orden predeterminado FEFO"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer orden FEFO</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-600 hover:text-slate-900 font-medium active:scale-95 transition-all text-xs">
            <input
              type="checkbox"
              checked={effectiveHideExhausted}
              onChange={(e) => handleToggleHideExhausted(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-fnvac-blue-600 focus:ring-fnvac-blue-500 cursor-pointer"
            />
            <span>Ocultar agotados</span>
          </label>

          <div className="text-slate-500 text-[11px] hidden sm:block">
            Haz clic en los encabezados de columna para alternar orden
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              {/* Semáforo & Días */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'fefo' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('fefo')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('fefo');
                  }
                }}
                className="py-3.5 px-4 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Semáforo &amp; Días</span>
                  {sortField === 'fefo' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Producto y Código */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'product' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('product')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('product');
                  }
                }}
                className="py-3.5 px-4 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Producto y Código</span>
                  {sortField === 'product' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Lote */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'lot' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('lot')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('lot');
                  }
                }}
                className="py-3.5 px-3 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Lote</span>
                  {sortField === 'lot' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Caducidad */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'days' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('days')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('days');
                  }
                }}
                className="py-3.5 px-3 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Caducidad</span>
                  {sortField === 'days' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Existencia */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'quantity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('quantity')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('quantity');
                  }
                }}
                className="py-3.5 px-3 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Existencia</span>
                  {sortField === 'quantity' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Donante */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'donor' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('donor')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('donor');
                  }
                }}
                className="py-3.5 px-3 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Donante</span>
                  {sortField === 'donor' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Ubicación */}
              <th
                scope="col"
                role="button"
                tabIndex={0}
                aria-sort={sortField === 'location' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleHeaderSort('location')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHeaderSort('location');
                  }
                }}
                className="py-3.5 px-3 cursor-pointer select-none active:scale-95 hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span>Ubicación</span>
                  {sortField === 'location' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-fnvac-blue-600 font-bold" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </div>
              </th>

              {/* Acciones */}
              <th scope="col" className="py-3.5 px-4 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedBatches.map((batch) => {
              const product = batch.product;
              const isExhausted = (batch.currentQuantity ?? 0) <= 0 || batch.status === 'AGOTADO';
              const isCritical = !isExhausted && batch.status === 'CRITICO';
              const isWarning = !isExhausted && batch.status === 'ATENCION';
              const categoryInfo = product?.category
                ? categoryLabels[product.category]
                : undefined;
              const storageInfo = product?.storageArea
                ? storageAreaLabels[product.storageArea]
                : undefined;
              const StorageIcon = storageInfo?.icon || Package;

              return (
                <tr
                  key={batch.id}
                  className={`transition-colors ${
                    isExhausted
                      ? 'opacity-65 bg-slate-50/80 hover:bg-slate-100 hover:opacity-90 transition-all'
                      : isCritical
                      ? 'bg-red-50/20 hover:bg-fnvac-blue-50/40'
                      : isWarning
                      ? 'bg-amber-50/10 hover:bg-fnvac-blue-50/40'
                      : 'hover:bg-fnvac-blue-50/40'
                  }`}
                >
                  {/* Semáforo & Días */}
                  <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                    <StatusBadge
                      status={batch.status || (isExhausted ? 'AGOTADO' : 'ESTABLE')}
                      daysRemaining={batch.daysRemaining}
                    />
                  </td>

                  {/* Producto, Categoría, Código */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="font-semibold text-slate-900 leading-tight">
                      {product?.name || 'Producto no identificado'}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {categoryInfo && (
                        <span
                          className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${categoryInfo.badgeClass}`}
                        >
                          {categoryInfo.label}
                        </span>
                      )}
                      {product?.barcode && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          <Barcode className="w-3 h-3 text-slate-400" />
                          {product.barcode}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Lote */}
                  <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                    <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {batch.lotCode}
                    </span>
                  </td>

                  {/* Caducidad */}
                  <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatExpiration(batch.expirationDate)}</span>
                    </div>
                  </td>

                  {/* Existencia */}
                  <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                    {isExhausted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-red-600 border border-red-200">
                        0 (Sin stock)
                      </span>
                    ) : (
                      <div className="font-bold text-slate-900">
                        {batch.currentQuantity.toLocaleString('es-MX')}
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          {product?.unit || 'uds'}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Donante */}
                  <td className="py-3.5 px-3 align-middle">
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                      {product?.donorType || 'Donante General'}
                    </span>
                  </td>

                  {/* Ubicación */}
                  <td className="py-3.5 px-3 whitespace-nowrap align-middle">
                    {storageInfo && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${storageInfo.badgeClass}`}
                      >
                        <StorageIcon className="w-3.5 h-3.5" />
                        <span>{storageInfo.label}</span>
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-right align-middle">
                    <div className="inline-flex items-center gap-2">
                      {isExhausted ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none select-none"
                          title="Lote agotado (sin stock)"
                          aria-disabled="true"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Despachar</span>
                        </span>
                      ) : (
                        <Link
                          href={`/rutas?batchId=${encodeURIComponent(batch.id)}`}
                          prefetch={true}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-fnvac-blue-600 text-white hover:bg-fnvac-blue-700 shadow-xs transition-all active:scale-95 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                          title="Asignar y despachar este lote a una ruta de entrega comunitaria"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Despachar</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => onEditStock(batch)}
                        className="p-1.5 text-slate-500 hover:text-fnvac-blue-700 hover:bg-fnvac-blue-50 rounded-lg border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        title="Ajuste rápido de inventario / stock"
                        aria-label="Editar stock"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {onDeleteBatch && (
                        <button
                          type="button"
                          onClick={() => onDeleteBatch(batch)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-all active:scale-95 cursor-pointer"
                          title="Eliminar lote de inventario"
                          aria-label="Eliminar lote de inventario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer info */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-slate-700">{sortedBatches.length}</span> lotes en lista
          &bull; Orden activo: <span className="font-medium text-fnvac-blue-700">{sortLabels[sortField]?.[sortDirection] || `${sortField} (${sortDirection})`}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500"></span> Crítico (&le; 3d)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span> Atención (4-7d)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Estable (&gt; 7d)
          </span>
        </div>
      </div>
    </div>
  );
};

export default InventoryTable;
