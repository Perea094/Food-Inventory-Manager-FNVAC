'use client';

import React from 'react';
import {
  Search,
  Filter,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  RotateCcw,
} from 'lucide-react';
import type { FEFOStatus, ProductCategory, StorageArea } from '../types/index';

export interface FilterState {
  search: string;
  category: string;
  donor: string;
  storageArea: string;
  status: string;
  hideExhausted?: boolean;
}

export interface InventoryFiltersProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onReset: () => void;
  availableDonors?: string[];
  counts?: {
    total: number;
    critical: number;
    attention: number;
    stable: number;
  };
}

const categoryDisplayNames: Record<string, string> = {
  LACTEO_FRIO: 'Lácteos Fríos',
  AGRICOLA_PERECEDERO: 'Agrícola Perecedero',
  SECO_ABARROTE: 'Secos / Abarrotes',
  NO_ALIMENTARIO: 'No Alimentario',
};

const storageDisplayNames: Record<string, string> = {
  Camara_Fria: 'Cámara Fría',
  Nave_Secos: 'Nave de Secos',
  Anden: 'Andén',
};

const statusDisplayNames: Record<string, string> = {
  CRITICO: 'Críticos (≤ 3d)',
  ATENCION: 'Atención (4-7d)',
  ESTABLE: 'Estables (> 7d)',
};

export const CATEGORY_STORAGE_COMPATIBILITY: Record<string, string[]> = {
  LACTEO_FRIO: ['Camara_Fria'],
  AGRICOLA_PERECEDERO: ['Anden', 'Camara_Fria'],
  SECO_ABARROTE: ['Nave_Secos'],
  NO_ALIMENTARIO: ['Nave_Secos'],
};

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  filters,
  onChange,
  onReset,
  availableDonors = [],
  counts,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = e.target.value;
    let nextStorage = filters.storageArea;
    if (nextCategory && nextStorage) {
      const allowed = CATEGORY_STORAGE_COMPATIBILITY[nextCategory];
      if (allowed && !allowed.includes(nextStorage)) {
        nextStorage = '';
      }
    }
    onChange({ ...filters, category: nextCategory, storageArea: nextStorage });
  };

  const handleDonorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, donor: e.target.value });
  };

  const handleStorageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStorage = e.target.value;
    let nextCategory = filters.category;
    if (nextStorage && nextCategory) {
      const allowed = CATEGORY_STORAGE_COMPATIBILITY[nextCategory];
      if (allowed && !allowed.includes(nextStorage)) {
        nextCategory = '';
      }
    }
    onChange({ ...filters, storageArea: nextStorage, category: nextCategory });
  };

  const displayedDonors = React.useMemo(() => {
    const list = [...availableDonors];
    if (filters.donor && !list.includes(filters.donor)) {
      list.unshift(filters.donor);
    }
    return list;
  }, [availableDonors, filters.donor]);

  const handleStatusClick = (statusValue: string) => {
    onChange({ ...filters, status: filters.status === statusValue ? '' : statusValue });
  };

  const activeFiltersCount =
    (filters.search ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.donor ? 1 : 0) +
    (filters.storageArea ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.hideExhausted ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 no-print">
      {/* Top row: Status quick-filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Layers className="w-4 h-4 text-slate-400" />
          <span>Filtro FEFO por Prioridad:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => handleStatusClick('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all select-none cursor-pointer active:scale-95 ${
              filters.status === ''
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos {counts && counts.total !== undefined ? `(${counts.total})` : ''}
          </button>

          <button
            type="button"
            onClick={() => handleStatusClick('CRITICO')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all select-none cursor-pointer active:scale-95 ${
              filters.status === 'CRITICO'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Críticos</span>
            {counts && counts.critical !== undefined && (
              <span
                className={`text-[11px] font-bold ${
                  filters.status === 'CRITICO' ? 'text-red-100' : 'text-red-600'
                }`}
              >
                ({counts.critical})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleStatusClick('ATENCION')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all select-none cursor-pointer active:scale-95 ${
              filters.status === 'ATENCION'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Atención</span>
            {counts && counts.attention !== undefined && (
              <span
                className={`text-[11px] font-bold ${
                  filters.status === 'ATENCION' ? 'text-amber-100' : 'text-amber-700'
                }`}
              >
                ({counts.attention})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleStatusClick('ESTABLE')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all select-none cursor-pointer active:scale-95 ${
              filters.status === 'ESTABLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Estables</span>
            {counts && counts.stable !== undefined && (
              <span
                className={`text-[11px] font-bold ${
                  filters.status === 'ESTABLE' ? 'text-emerald-100' : 'text-emerald-700'
                }`}
              >
                ({counts.stable})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main search and dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        {/* Free text search: Name, barcode, or lotCode */}
        <div className="lg:col-span-3 sm:col-span-2 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Buscar por producto, lote o código..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white placeholder-slate-400"
          />
        </div>

        {/* Category Dropdown */}
        <div className="lg:col-span-2 sm:col-span-1">
          <select
            value={filters.category}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-700"
          >
            <option value="">Todas las Categorías</option>
            <option value="LACTEO_FRIO">Lácteos Fríos</option>
            <option value="AGRICOLA_PERECEDERO">Agrícola Perecedero</option>
            <option value="SECO_ABARROTE">Secos / Abarrotes</option>
            <option value="NO_ALIMENTARIO">No Alimentario</option>
          </select>
        </div>

        {/* Donor Dropdown */}
        <div className="lg:col-span-2 sm:col-span-1">
          <select
            value={filters.donor}
            onChange={handleDonorChange}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-700"
          >
            <option value="">Todos los Donantes</option>
            {displayedDonors.map((donor) => (
              <option key={donor} value={donor}>
                {donor}
              </option>
            ))}
          </select>
        </div>

        {/* Storage Area Dropdown */}
        <div className="lg:col-span-2 sm:col-span-1">
          <select
            value={filters.storageArea}
            onChange={handleStorageChange}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-700"
          >
            <option value="">Todas las Áreas</option>
            <option value="Camara_Fria">Cámara Fría</option>
            <option value="Nave_Secos">Nave de Secos</option>
            <option value="Anden">Andén</option>
          </select>
        </div>

        {/* Clear Filters Button - Prominent, visible on all screens */}
        <div className="lg:col-span-3 sm:col-span-1 flex items-center">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all select-none ${
              hasActiveFilters
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-xs cursor-pointer active:scale-95'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
            }`}
            title={hasActiveFilters ? 'Limpiar todos los filtros activos' : 'Sin filtros activos'}
          >
            <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Limpiar Filtros {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Stock visibility toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700 hover:text-slate-900 active:scale-95 transition-all">
          <input
            type="checkbox"
            checked={Boolean(filters.hideExhausted)}
            onChange={(e) => onChange({ ...filters, hideExhausted: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-fnvac-blue-600 focus:ring-fnvac-blue-500 cursor-pointer"
          />
          <span>Ocultar lotes agotados (stock 0)</span>
        </label>
      </div>

      {/* Active filter chips row with individual [x] removals */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filtros activos:
          </span>

          {filters.search && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              <span>Texto: &quot;{filters.search}&quot;</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: '' })}
                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none active:scale-95"
                title="Quitar filtro de texto"
                aria-label="Quitar filtro de texto"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.category && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              <span>Categoría: {categoryDisplayNames[filters.category] || filters.category}</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, category: '' })}
                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none active:scale-95"
                title="Quitar filtro de categoría"
                aria-label="Quitar filtro de categoría"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.donor && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              <span>Donante: {filters.donor}</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, donor: '' })}
                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none active:scale-95"
                title="Quitar filtro de donante"
                aria-label="Quitar filtro de donante"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.storageArea && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-medium">
              <span>Área: {storageDisplayNames[filters.storageArea] || filters.storageArea}</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, storageArea: '' })}
                className="p-0.5 hover:bg-cyan-100 rounded-full text-cyan-600 hover:text-cyan-900 transition-colors cursor-pointer select-none active:scale-95"
                title="Quitar filtro de área"
                aria-label="Quitar filtro de área"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.status && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium ${
                filters.status === 'CRITICO'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : filters.status === 'ATENCION'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <span>Semáforo: {statusDisplayNames[filters.status] || filters.status}</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, status: '' })}
                className="p-0.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer select-none active:scale-95"
                title="Quitar filtro de semáforo"
                aria-label="Quitar filtro de semáforo"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.hideExhausted && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              <span>Ocultando agotados</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, hideExhausted: false })}
                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none active:scale-95"
                title="Mostrar lotes agotados"
                aria-label="Mostrar lotes agotados"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryFilters;
