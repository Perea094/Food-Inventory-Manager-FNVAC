'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Barcode,
  Truck,
  FileSpreadsheet,
  RefreshCw,
  Package,
  AlertCircle,
  AlertTriangle,
  Snowflake,
  HeartHandshake,
  CheckCircle2,
  Save,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import KPICard from '../components/KPICard.tsx';
import InventoryFilters, { FilterState } from '../components/InventoryFilters.tsx';
import InventoryTable from '../components/InventoryTable.tsx';
import Modal from '../components/Modal.tsx';
import StatusBadge from '../components/StatusBadge.tsx';
import type { InventoryBatch, InventoryKPIs } from '../types/index';

const INITIAL_FILTERS: FilterState = {
  search: '',
  category: '',
  donor: '',
  storageArea: '',
  status: '',
  hideExhausted: false,
};

export default function DashboardPage() {
  const router = useRouter();

  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [totalBatchesCount, setTotalBatchesCount] = useState<number>(0);
  const [kpis, setKpis] = useState<InventoryKPIs>({
    totalQuantity: 0,
    criticalBatchesCount: 0,
    warningBatchesCount: 0,
    stableBatchesCount: 0,
    coldRoomCount: 0,
    dryStorageCount: 0,
    exhaustedBatchesCount: 0,
  });
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Stock Editing Modal State
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Batch Deletion State
  const [deletingBatch, setDeletingBatch] = useState<InventoryBatch | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Available donors list
  const [availableDonors, setAvailableDonors] = useState<string[]>([]);

  const fetchInventory = useCallback(async (currentFilters: FilterState) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (currentFilters.search) params.set('search', currentFilters.search);
      if (currentFilters.category) params.set('category', currentFilters.category);
      if (currentFilters.donor) params.set('donor', currentFilters.donor);
      if (currentFilters.storageArea) params.set('storageArea', currentFilters.storageArea);
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.hideExhausted) params.set('hideExhausted', 'true');

      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Error en el servidor al consultar inventario (${res.status})`);
      }

      const data = await res.json();
      setBatches(data.batches || []);
      if (data.kpis) {
        setKpis(data.kpis);
      }
      if (typeof data.totalBatchesCount === 'number') {
        setTotalBatchesCount(data.totalBatchesCount);
      } else if (Array.isArray(data.batches)) {
        setTotalBatchesCount(data.batches.length);
      }

      // Populate master donors catalog
      if (Array.isArray(data.allDonors) && data.allDonors.length > 0) {
        setAvailableDonors(data.allDonors);
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la base de datos de bodega.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory(filters);
  }, [filters, fetchInventory]);

  // Open Edit Stock modal
  const handleOpenEditStock = (batch: InventoryBatch) => {
    setEditingBatch(batch);
    setEditQuantity(String(batch.currentQuantity));
    setModalFeedback(null);
  };

  // Close Edit Stock modal
  const handleCloseEditStock = () => {
    setEditingBatch(null);
    setEditQuantity('');
    setModalFeedback(null);
  };

  // Save updated stock quantity
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch || isSavingStock) return;

    const qty = Number(editQuantity);
    if (isNaN(qty) || qty < 0) {
      setModalFeedback('La cantidad debe ser un número mayor o igual a 0');
      return;
    }

    try {
      setIsSavingStock(true);
      setModalFeedback(null);

      const res = await fetch(`/api/inventory/${editingBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentQuantity: qty }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al actualizar el stock');
      }

      // Refetch inventory to update KPIs and list
      await fetchInventory(filters);
      handleCloseEditStock();
    } catch (err: any) {
      setModalFeedback(err.message);
    } finally {
      setIsSavingStock(false);
    }
  };

  // Delete Batch Handlers
  const handleOpenDeleteBatch = (batch: InventoryBatch) => {
    setDeletingBatch(batch);
    setDeleteError(null);
  };

  const handleCloseDeleteBatch = () => {
    if (!isDeleting) {
      setDeletingBatch(null);
      setDeleteError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBatch || isDeleting) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/inventory/${deletingBatch.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error al eliminar lote (${res.status})`);
      }

      await fetchInventory(filters);
      setDeletingBatch(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Error desconocido al eliminar el lote.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick filter handlers via KPI cards
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const isFiltered = Boolean(
    filters.search ||
    filters.category ||
    filters.donor ||
    filters.storageArea ||
    filters.status ||
    filters.hideExhausted
  );

  const handleKpiCriticalClick = () => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === 'CRITICO' ? '' : 'CRITICO',
    }));
  };

  const handleKpiAttentionClick = () => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === 'ATENCION' ? '' : 'ATENCION',
    }));
  };

  const handleKpiColdClick = () => {
    setFilters((prev) => {
      const willBeCold = prev.storageArea !== 'Camara_Fria';
      const isIncompatibleCategory =
        prev.category === 'SECO_ABARROTE' || prev.category === 'NO_ALIMENTARIO';
      return {
        ...prev,
        storageArea: willBeCold ? 'Camara_Fria' : '',
        category: willBeCold && isIncompatibleCategory ? '' : prev.category,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Operations Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fnvac-blue-900 via-fnvac-blue-800 to-slate-900 text-white p-6 sm:p-8 shadow-md">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-fnvac-blue-100 text-xs font-semibold tracking-wide uppercase">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Operación Activa CEDIS Celaya</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Control de Inventario FEFO y Rutas Logísticas
          </h1>
          <p className="text-sm sm:text-base text-fnvac-blue-100/90 leading-relaxed">
            Rescate y distribución prioritaria de alimentos perecederos donados por Cuadritos
            Biotek, productores agrícolas del Bajío y aliados comerciales para comedores
            comunitarios de Celaya y la región.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
          <HeartHandshake className="w-72 h-72 text-white" />
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Error al conectar con la base de datos</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
          <button
            onClick={() => fetchInventory(filters)}
            className="px-3 py-1 text-xs font-semibold bg-red-100 hover:bg-red-200 rounded-lg text-red-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock */}
        <KPICard
          title="Total Stock en Bodega"
          value={kpis.totalQuantity}
          subtext="Kilos / piezas / litros totales"
          icon={Package}
          variant="neutral"
          onClick={handleResetFilters}
          isActive={!isFiltered}
          className={!isFiltered ? 'ring-2 ring-slate-400' : ''}
          badge={
            !isFiltered ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                ✓ Todo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-fnvac-blue-100 text-fnvac-blue-800 border border-fnvac-blue-300 animate-pulse">
                ↺ Limpiar
              </span>
            )
          }
          actionHint={isFiltered ? 'Clic para ver todo el inventario' : 'Mostrando inventario completo'}
        />

        {/* Lotes Críticos */}
        <KPICard
          title="Lotes Críticos"
          value={kpis.criticalBatchesCount}
          subtext="Caducidad en &le; 3 días (Alta Prioridad)"
          icon={AlertCircle}
          variant="critical"
          onClick={handleKpiCriticalClick}
          isActive={filters.status === 'CRITICO'}
          className={filters.status === 'CRITICO' ? 'ring-2 ring-red-500' : ''}
          actionHint={filters.status === 'CRITICO' ? 'Filtro activo (clic para desactivar)' : 'Clic para filtrar por críticos'}
        />

        {/* Lotes en Atención */}
        <KPICard
          title="Lotes en Atención"
          value={kpis.warningBatchesCount}
          subtext="Caducidad en 4 a 7 días (Próximo Despacho)"
          icon={AlertTriangle}
          variant="attention"
          onClick={handleKpiAttentionClick}
          isActive={filters.status === 'ATENCION'}
          className={filters.status === 'ATENCION' ? 'ring-2 ring-amber-500' : ''}
          actionHint={filters.status === 'ATENCION' ? 'Filtro activo (clic para desactivar)' : 'Clic para filtrar por atención'}
        />

        {/* Cámaras Frías vs Nave Secos */}
        <KPICard
          title="Cámaras Frías vs Secos"
          value={`${kpis.coldRoomCount} / ${kpis.dryStorageCount}`}
          subtext="Lotes refrigerados vs secos"
          icon={Snowflake}
          variant="cold"
          onClick={handleKpiColdClick}
          isActive={filters.storageArea === 'Camara_Fria'}
          className={filters.storageArea === 'Camara_Fria' ? 'ring-2 ring-cyan-500' : ''}
          actionHint={filters.storageArea === 'Camara_Fria' ? 'Filtro frío activo (clic para desactivar)' : 'Clic para filtrar por cámara fría'}
        />
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-2">
          {/* Escanear Recepción */}
          <Link
            href="/recepcion"
            prefetch={true}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white shadow-xs transition-all active:scale-[0.98] select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
          >
            <Barcode className="w-4 h-4" />
            <span>Escanear Recepción</span>
          </Link>

          {/* Planificar Ruta Crítica */}
          <Link
            href="/rutas?filter=criticos"
            prefetch={true}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-fnvac-red-600 hover:bg-fnvac-red-700 text-white shadow-xs transition-all active:scale-[0.98] select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-fnvac-red-500"
          >
            <Truck className="w-4 h-4" />
            <span>Planificar Ruta Crítica</span>
          </Link>

          {/* Excel & Exportar */}
          <Link
            href="/excel"
            prefetch={true}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all active:scale-[0.98] select-none cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-fnvac-blue-700" />
            <span>Excel &amp; Reportes</span>
          </Link>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => fetchInventory(filters)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all active:scale-[0.98] select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
          title="Actualizar datos en tiempo real"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Filter Bar */}
      <InventoryFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        availableDonors={availableDonors}
        counts={{
          total:
            kpis.criticalBatchesCount +
            kpis.warningBatchesCount +
            kpis.stableBatchesCount +
            (kpis.exhaustedBatchesCount || 0),
          critical: kpis.criticalBatchesCount,
          attention: kpis.warningBatchesCount,
          stable: kpis.stableBatchesCount,
        }}
      />

      {/* Active Filter summary banner */}
      {isFiltered && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-sm shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold">Vista filtrada activa:</span>
            <span>
              Mostrando <strong>{batches.length}</strong> de <strong>{totalBatchesCount || batches.length}</strong> lotes.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-all active:scale-95 cursor-pointer select-none self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer todo</span>
          </button>
        </div>
      )}

      {/* Main FEFO Interactive Table */}
      <InventoryTable
        batches={batches}
        isLoading={isLoading}
        onEditStock={handleOpenEditStock}
        onDeleteBatch={handleOpenDeleteBatch}
        onResetFilters={handleResetFilters}
        hideExhausted={filters.hideExhausted}
        onToggleHideExhausted={(hide) => setFilters((prev) => ({ ...prev, hideExhausted: hide }))}
      />

      {/* Quick Stock Edit Modal */}
      {editingBatch && (
        <Modal
          isOpen={Boolean(editingBatch)}
          onClose={handleCloseEditStock}
          title="Ajuste Rápido de Stock"
          description="Modifica la existencia disponible en bodega para este lote específico."
          maxWidth="md"
        >
          <form onSubmit={handleSaveStock} className="space-y-4">
            {/* Lote Summary */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Producto:</p>
                  <p className="text-sm font-bold text-slate-900">
                    {editingBatch.product?.name || 'Producto'}
                  </p>
                </div>
                <StatusBadge
                  status={editingBatch.status || 'ESTABLE'}
                  daysRemaining={editingBatch.daysRemaining}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div>
                  <span className="font-semibold text-slate-700">Lote: </span>
                  <span className="font-mono">{editingBatch.lotCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Caducidad: </span>
                  <span>{editingBatch.expirationDate}</span>
                </div>
              </div>
            </div>

            {/* Input field */}
            <div>
              <label
                htmlFor="editStockInput"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Cantidad Actual ({editingBatch.product?.unit || 'uds'}):
              </label>
              <input
                id="editStockInput"
                type="number"
                min="0"
                step="any"
                required
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 font-bold text-slate-900"
                placeholder="0"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                Ingresa el nuevo conteo físico verificado en bodega.
              </p>
            </div>

            {modalFeedback && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalFeedback}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseEditStock}
                disabled={isSavingStock}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingStock}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-fnvac-blue-600 hover:bg-fnvac-blue-700 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingStock ? 'Guardando...' : 'Guardar Ajuste'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Batch Confirmation Modal */}
      {deletingBatch && (
        <Modal
          isOpen={Boolean(deletingBatch)}
          onClose={handleCloseDeleteBatch}
          title="Confirmar Eliminación de Registro de Inventario"
          description="Esta acción eliminará permanentemente este registro de lote de la base de datos."
          maxWidth="lg"
        >
          <div className="space-y-4 text-left">
            {/* Warning Banner */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Atención: Esta acción es irreversible</p>
                <p className="text-xs text-amber-800 mt-1">
                  El lote seleccionado será eliminado permanentemente del inventario activo y sus existencias no podrán ser recuperadas. Asegúrese de que no haya rutas activas dependientes de este lote.
                </p>
              </div>
            </div>

            {/* Batch Details Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Producto</span>
                  <h4 className="text-base font-bold text-slate-900">
                    {deletingBatch.product?.name || 'Producto no identificado'}
                  </h4>
                  {deletingBatch.product?.barcode && (
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      Código: {deletingBatch.product.barcode}
                    </p>
                  )}
                </div>
                <StatusBadge
                  status={deletingBatch.status || 'ESTABLE'}
                  daysRemaining={deletingBatch.daysRemaining}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Lote:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                    {deletingBatch.lotCode}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Caducidad:</span>
                  <span
                    className={`font-semibold mt-0.5 inline-block ${
                      deletingBatch.daysRemaining !== undefined && deletingBatch.daysRemaining < 0
                        ? 'text-red-600 font-bold'
                        : 'text-slate-800'
                    }`}
                  >
                    {deletingBatch.expirationDate}
                    {deletingBatch.daysRemaining !== undefined && deletingBatch.daysRemaining < 0 && (
                      <span className="ml-1 text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        (Expirado)
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Existencia:</span>
                  <span className="font-bold text-slate-900 mt-0.5 inline-block">
                    {deletingBatch.currentQuantity.toLocaleString('es-MX')}{' '}
                    <span className="font-normal text-slate-600">
                      {deletingBatch.product?.unit || 'uds'}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Ubicación:</span>
                  <span className="font-medium text-slate-800 mt-0.5 inline-block">
                    {deletingBatch.product?.storageArea === 'Camara_Fria'
                      ? 'Cámara Fría'
                      : deletingBatch.product?.storageArea === 'Nave_Secos'
                      ? 'Nave de Secos'
                      : deletingBatch.product?.storageArea === 'Anden'
                      ? 'Andén'
                      : deletingBatch.product?.storageArea || 'Almacén general'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-500 block">Donante:</span>
                  <span className="font-medium text-slate-800 mt-0.5 inline-block">
                    {deletingBatch.product?.donorType || 'Donante General'}
                  </span>
                </div>
              </div>
            </div>

            {/* Delete Error Alert */}
            {deleteError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseDeleteBatch}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none shadow-xs select-none"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Registro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
