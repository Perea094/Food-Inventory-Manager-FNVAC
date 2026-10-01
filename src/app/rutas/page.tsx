'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Truck,
  MapPin,
  Package,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  History,
  Printer,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Building,
  Scale,
  RotateCcw,
} from 'lucide-react';
import {
  CEDIS_CELAYA,
  calculateHaversineDistanceKm,
  calculateRouteCircuit,
  recommendVehicle,
  isBatchExpiredForDispatch,
  filterCriticalBatchesForRouting,
  optimizeStopsPriorityAndProximity,
} from '../../lib/routing.ts';
import StatusBadge from '../../components/StatusBadge.tsx';
import DriverManifestModal, { DriverManifestData } from '../../components/DriverManifestModal.tsx';
import Modal from '../../components/Modal.tsx';
import type {
  InventoryBatch,
  Community,
  Vehicle,
  RouteStop,
  DispatchedItem,
  VehicleType,
  DispatchRoute,
} from '../../types/index';

// Leaflet uses `window` - dynamically import with SSR disabled as required
const MapRouteView = dynamic(() => import('../../components/MapRouteView.tsx'), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] w-full bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-fnvac-blue-600 border-r-transparent"></div>
      <p className="text-sm font-medium">Cargando mapa interactivo Leaflet...</p>
    </div>
  ),
});

interface SelectedCargoItem {
  batchId: string;
  productId: string;
  productName: string;
  lotCode: string;
  expirationDate: string;
  donor: string;
  category: any;
  unit: any;
  availableQuantity: number;
  dispatchedQuantity: number;
  daysRemaining?: number;
  status?: any;
}

function RoutePlannerContent() {
  const searchParams = useSearchParams();
  const initialBatchId = searchParams.get('batchId');
  const initialFilter = searchParams.get('filter');

  // Master data
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [historicalRoutes, setHistoricalRoutes] = useState<DispatchRoute[]>([]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Route Plan State
  const [driverName, setDriverName] = useState('Operador de Transporte #1');
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>('Torton_ThermoKing');
  const [cargoItems, setCargoItems] = useState<SelectedCargoItem[]>([]);
  const [selectedStops, setSelectedStops] = useState<RouteStop[]>([]);

  // Active Manifest Modal State
  const [manifestRoute, setManifestRoute] = useState<DriverManifestData | null>(null);
  const [isManifestOpen, setIsManifestOpen] = useState(false);

  // Undo Dispatched Route Modal State
  const [routeToUndo, setRouteToUndo] = useState<DispatchRoute | null>(null);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  // Community picker state
  const [selectedCommunityToAdd, setSelectedCommunityToAdd] = useState('');
  // Batch picker state
  const [selectedBatchToAdd, setSelectedBatchToAdd] = useState('');

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [invRes, commRes, vehRes, routesRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/communities'),
        fetch('/api/vehicles'),
        fetch('/api/routes'),
      ]);

      if (!invRes.ok || !commRes.ok || !vehRes.ok || !routesRes.ok) {
        throw new Error('Error al cargar catálogos desde el servidor');
      }

      const invData = await invRes.json();
      const commData = await commRes.json();
      const vehData = await vehRes.json();
      const routesData = await routesRes.json();

      setBatches(invData.batches || []);
      setCommunities(commData || []);
      setVehicles(vehData || []);
      setHistoricalRoutes(routesData || []);

      // Handle initial search params
      if (initialBatchId && invData.batches) {
        const targetBatch = invData.batches.find((b: InventoryBatch) => b.id === initialBatchId);
        if (targetBatch && targetBatch.currentQuantity > 0) {
          if (isBatchExpiredForDispatch(targetBatch)) {
            setErrorMessage('El lote solicitado ya expiró y no es apto para distribución.');
          } else {
            setCargoItems([
              {
                batchId: targetBatch.id,
                productId: targetBatch.productId,
                productName: targetBatch.product?.name || 'Producto',
                lotCode: targetBatch.lotCode,
                expirationDate: targetBatch.expirationDate,
                donor: targetBatch.product?.donorType || 'Donante',
                category: targetBatch.product?.category || 'SECO_ABARROTE',
                unit: targetBatch.product?.unit || 'kilos',
                availableQuantity: targetBatch.currentQuantity,
                dispatchedQuantity: Math.min(targetBatch.currentQuantity, 50),
                daysRemaining: targetBatch.daysRemaining,
                status: targetBatch.status,
              },
            ]);
          }
        }
      } else if (initialFilter === 'criticos' && invData.batches) {
        // Automatically load critical batches
        loadCriticalBatches(invData.batches);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [initialBatchId, initialFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Asistente de Carga Crítica FEFO: Load batches with status CRITICO or ATENCION
  const loadCriticalBatches = (batchList: InventoryBatch[] = batches) => {
    const { eligibleBatches, expiredExcludedCount } = filterCriticalBatchesForRouting(batchList);

    if (eligibleBatches.length === 0) {
      if (expiredExcludedCount > 0) {
        setErrorMessage(
          `No hay lotes críticos vigentes. Se omitieron ${expiredExcludedCount} lote(s) caducado(s) por normativa de inocuidad alimentaria.`
        );
      } else {
        setSuccessMessage('No hay lotes con caducidad crítica (≤ 7 días) disponibles actualmente.');
      }
      return;
    }

    setCargoItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.batchId));
      const additions: SelectedCargoItem[] = eligibleBatches
        .filter((b) => !existingIds.has(b.id))
        .map((b) => ({
          batchId: b.id,
          productId: b.productId,
          productName: b.product?.name || 'Producto',
          lotCode: b.lotCode,
          expirationDate: b.expirationDate,
          donor: b.product?.donorType || 'Donante',
          category: b.product?.category || 'SECO_ABARROTE',
          unit: b.product?.unit || 'kilos',
          availableQuantity: b.currentQuantity,
          dispatchedQuantity: b.currentQuantity,
          daysRemaining: b.daysRemaining,
          status: b.status,
        }));

      if (additions.length === 0) {
        setSuccessMessage('Los lotes críticos ya estaban incluidos en la lista de carga.');
        return prev;
      }

      if (expiredExcludedCount > 0) {
        setSuccessMessage(
          `Se cargaron ${additions.length} lotes críticos FEFO prioritarios. Se omitieron automáticamente ${expiredExcludedCount} lote(s) caducado(s) por normativa de inocuidad alimentaria.`
        );
      } else {
        setSuccessMessage(`Se cargaron ${additions.length} lotes críticos FEFO prioritarios.`);
      }
      return [...prev, ...additions];
    });
  };

  // Add individual batch from warehouse
  const handleAddBatch = (batchId: string) => {
    if (!batchId) return;
    const found = batches.find((b) => b.id === batchId);
    if (!found) return;

    if (isBatchExpiredForDispatch(found)) {
      setErrorMessage(
        `No se puede agregar el lote ${found.lotCode}: el producto ya expiró y no es apto para donación o distribución.`
      );
      return;
    }

    if (cargoItems.some((item) => item.batchId === batchId)) {
      setErrorMessage('Este lote ya ha sido agregado al manifiesto de carga.');
      return;
    }

    const newItem: SelectedCargoItem = {
      batchId: found.id,
      productId: found.productId,
      productName: found.product?.name || 'Producto',
      lotCode: found.lotCode,
      expirationDate: found.expirationDate,
      donor: found.product?.donorType || 'Donante',
      category: found.product?.category || 'SECO_ABARROTE',
      unit: found.product?.unit || 'kilos',
      availableQuantity: found.currentQuantity,
      dispatchedQuantity: Math.min(found.currentQuantity, 50),
      daysRemaining: found.daysRemaining,
      status: found.status,
    };

    setCargoItems((prev) => [...prev, newItem]);
    setSelectedBatchToAdd('');
    setErrorMessage(null);
  };

  // Remove batch from cargo
  const handleRemoveCargoItem = (batchId: string) => {
    setCargoItems((prev) => prev.filter((item) => item.batchId !== batchId));
  };

  // Update dispatched quantity
  const handleUpdateQuantity = (batchId: string, qty: number) => {
    setCargoItems((prev) =>
      prev.map((item) => {
        if (item.batchId === batchId) {
          const validated = Math.max(1, Math.min(qty, item.availableQuantity));
          return { ...item, dispatchedQuantity: validated };
        }
        return item;
      })
    );
  };

  // Motor de Recomendación Vehicular
  const vehicleRecommendation = useMemo(() => {
    const itemsForRec = cargoItems.map((item) => ({
      category: item.category,
      quantity: item.dispatchedQuantity,
      weightKg: item.dispatchedQuantity,
    }));
    return recommendVehicle(itemsForRec);
  }, [cargoItems]);

  // Auto-enforce vehicle selection when cold chain is required
  useEffect(() => {
    if (vehicleRecommendation.requiresRefrigeration) {
      setSelectedVehicleType('Torton_ThermoKing');
    } else if (cargoItems.length > 0 && selectedVehicleType === 'Torton_ThermoKing') {
      // If dry goods only and weight < 3500kg, suggest or keep user choice
    }
  }, [vehicleRecommendation.requiresRefrigeration, cargoItems.length]);

  // Selected Vehicle Object
  const currentVehicle = useMemo(() => {
    return (
      vehicles.find((v) => v.vehicleType === selectedVehicleType) || {
        id: 'veh-001',
        name: selectedVehicleType === 'Torton_ThermoKing' ? 'Torton Thermo King #1' : 'Camioneta 3.5 Ton Reparto',
        plate: selectedVehicleType === 'Torton_ThermoKing' ? 'GT-4821-C' : 'GT-1092-B',
        vehicleType: selectedVehicleType,
        maxCapacityKg: selectedVehicleType === 'Torton_ThermoKing' ? 12000 : 3500,
        hasRefrigeration: selectedVehicleType === 'Torton_ThermoKing',
      }
    );
  }, [vehicles, selectedVehicleType]);

  // Capacity & Weight Calculations
  const totalWeightKg = useMemo(() => {
    return cargoItems.reduce((acc, curr) => acc + curr.dispatchedQuantity, 0);
  }, [cargoItems]);

  const capacityPercentage = useMemo(() => {
    if (!currentVehicle.maxCapacityKg) return 0;
    return Math.min(100, Math.round((totalWeightKg / currentVehicle.maxCapacityKg) * 100));
  }, [totalWeightKg, currentVehicle.maxCapacityKg]);

  const isOverweight = totalWeightKg > currentVehicle.maxCapacityKg;

  // Proximity & Communities calculations
  const communitiesWithDistance = useMemo(() => {
    return communities.map((c) => ({
      ...c,
      distanceFromCedisKm: calculateHaversineDistanceKm(
        CEDIS_CELAYA.lat,
        CEDIS_CELAYA.lng,
        c.latitude,
        c.longitude
      ),
    }));
  }, [communities]);

  // Add stop to route
  const handleAddStop = (commId: string) => {
    if (!commId) return;
    const comm = communities.find((c) => c.id === commId);
    if (!comm) return;

    if (selectedStops.some((s) => s.communityId === commId)) {
      setErrorMessage('Esta comunidad ya está agregada al recorrido.');
      return;
    }

    const newStop: RouteStop = {
      communityId: comm.id,
      name: comm.name,
      municipality: comm.municipality,
      latitude: comm.latitude,
      longitude: comm.longitude,
      order: selectedStops.length + 1,
      representativeName: comm.representativeName,
      phone: comm.phone,
      beneficiariesCount: comm.beneficiariesCount,
    };

    setSelectedStops((prev) => [...prev, newStop]);
    setSelectedCommunityToAdd('');
    setErrorMessage(null);
  };

  // Optimize proposed route sequence (Priority and Proximity)
  const handleOptimizeProposedRoute = () => {
    if (selectedStops.length < 2) {
      setErrorMessage('Agrega al menos 2 comunidades al itinerario para optimizar la secuencia.');
      return;
    }

    const reordered = optimizeStopsPriorityAndProximity(CEDIS_CELAYA, selectedStops);
    setSelectedStops(reordered);
    const totalBeneficiaries = reordered.reduce((acc, s) => acc + (s.beneficiariesCount || 0), 0);
    setErrorMessage(null);
    setSuccessMessage(
      `Itinerario optimizado: secuencia ordenada por proximidad logística y prioridad de familias (${totalBeneficiaries.toLocaleString('es-MX')} familias atendidas).`
    );
  };

  // Re-order stops
  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedStops.length) return;

    const updated = [...selectedStops];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    // Recalculate order index
    const reordered = updated.map((stop, idx) => ({
      ...stop,
      order: idx + 1,
    }));

    setSelectedStops(reordered);
  };

  const handleRemoveStop = (index: number) => {
    const filtered = selectedStops.filter((_, idx) => idx !== index);
    const reordered = filtered.map((stop, idx) => ({
      ...stop,
      order: idx + 1,
    }));
    setSelectedStops(reordered);
  };

  // Circuit calculations (Round trip from CEDIS)
  const circuitResult = useMemo(() => {
    return calculateRouteCircuit(CEDIS_CELAYA, selectedStops);
  }, [selectedStops]);

  // Format circuit duration into hours & minutes
  const formattedDuration = useMemo(() => {
    const mins = circuitResult.estimatedDurationMinutes;
    if (mins <= 0) return '0 min';
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours === 0) return `${remainingMins} min`;
    return `${hours} h ${remainingMins} min`;
  }, [circuitResult.estimatedDurationMinutes]);

  // Confirm and dispatch route
  const handleConfirmDispatch = async () => {
    try {
      setErrorMessage(null);

      // Validation
      if (!driverName.trim()) {
        setErrorMessage('Por favor ingresa el nombre del operador o chofer.');
        return;
      }
      if (selectedStops.length === 0) {
        setErrorMessage('Debes seleccionar al menos una comunidad para la ruta.');
        return;
      }
      if (cargoItems.length === 0) {
        setErrorMessage('Debes seleccionar al menos un producto/lote para despachar.');
        return;
      }

      const hasExpired = cargoItems.some((item) => isBatchExpiredForDispatch(item));
      if (hasExpired) {
        setErrorMessage('La carga contiene lotes expirados. Retíralos antes de despachar.');
        return;
      }

      // Check cold chain violation warning
      if (vehicleRecommendation.requiresRefrigeration && !currentVehicle.hasRefrigeration) {
        const proceed = window.confirm(
          '⚠️ ADVERTENCIA CRÍTICA: La carga incluye productos refrigerados o perecederos pero el vehículo seleccionado no cuenta con Thermo King. ¿Deseas despachar de todos modos?'
        );
        if (!proceed) return;
      }

      setIsSubmitting(true);

      const dispatchedItems: DispatchedItem[] = cargoItems.map((item) => ({
        batchId: item.batchId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.dispatchedQuantity,
        unit: item.unit,
        lotCode: item.lotCode,
        expirationDate: item.expirationDate,
        donor: item.donor,
        category: item.category,
      }));

      const payload = {
        vehicleType: selectedVehicleType,
        driverName: driverName.trim(),
        totalDistanceKm: circuitResult.totalDistanceKm,
        stops: selectedStops,
        dispatchedItems,
      };

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al despachar la ruta');
      }

      const createdRoute = await res.json();

      // Open Driver Manifest immediately for printing
      setManifestRoute({
        ...createdRoute,
        vehicleName: currentVehicle.name,
        vehiclePlate: currentVehicle.plate,
        stops: selectedStops,
        dispatchedItems,
      });
      setIsManifestOpen(true);

      // Refresh inventory and historical routes
      fetchData();

      // Clear current builder
      setCargoItems([]);
      setSelectedStops([]);
      setSuccessMessage(`¡Ruta ${createdRoute.routeCode} confirmada y despachada con éxito!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el despacho');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dispatched items & total units of the route selected to undo
  const undoDispatchedItems = useMemo<DispatchedItem[]>(() => {
    if (!routeToUndo) return [];
    try {
      const items =
        typeof routeToUndo.dispatchedItems === 'string'
          ? JSON.parse(routeToUndo.dispatchedItems)
          : routeToUndo.dispatchedItems;
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, [routeToUndo]);

  const undoTotalUnits = useMemo(() => {
    return undoDispatchedItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  }, [undoDispatchedItems]);

  const handleOpenUndoModal = (route: DispatchRoute) => {
    setRouteToUndo(route);
    setUndoError(null);
    setIsUndoModalOpen(true);
  };

  const handleCloseUndoModal = () => {
    if (isUndoing) return;
    setIsUndoModalOpen(false);
    setRouteToUndo(null);
    setUndoError(null);
  };

  const handleConfirmUndoRoute = async () => {
    if (!routeToUndo) return;
    try {
      setIsUndoing(true);
      setUndoError(null);

      const res = await fetch(`/api/routes/${routeToUndo.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al deshacer la ruta');
      }

      await fetchData();
      setIsUndoModalOpen(false);
      setRouteToUndo(null);
      setSuccessMessage(
        `Ruta ${data.routeCode || routeToUndo.routeCode} deshecha con éxito. Se reincorporaron ${data.restoredUnits ?? undoTotalUnits} unidades al inventario de bodega.`
      );
    } catch (err: any) {
      setUndoError(err.message || 'Ocurrió un error al deshacer la ruta');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <>
      <div className="space-y-6 print:hidden no-print">
        {/* Top Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fnvac-blue-50 border border-fnvac-blue-200 text-fnvac-blue-800 text-xs font-bold tracking-wide uppercase mb-2">
            <Truck className="w-3.5 h-3.5" />
            <span>Módulo de Logística &amp; Ruteo CEDIS Celaya</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Planificador Inteligente de Rutas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Optimización de carga FEFO, asignación de vehículo Thermo King y trazado geográfico para entrega en comunidades del Bajío.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
          title="Actualizar datos de bodega"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Atención requerida</p>
            <p className="text-red-700 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 p-1"
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-fnvac-blue-50 border border-fnvac-blue-200 text-fnvac-blue-800 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-fnvac-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-medium">{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-fnvac-blue-600 hover:text-fnvac-blue-900 p-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Route Config & Cargo Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Vehículo y Operador */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-fnvac-blue-700" />
              <span>1. Asignación de Unidad y Operador</span>
            </h2>

            {/* Cold Chain Enforce Banner */}
            {vehicleRecommendation.requiresRefrigeration && (
              <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 flex items-start gap-3 text-xs">
                <Snowflake className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-cyan-950 uppercase tracking-wide">
                    {vehicleRecommendation.reason}
                  </p>
                  <p className="text-cyan-800 mt-0.5">
                    Se requiere unidad refrigerada Thermo King a 4°C para garantizar inocuidad alimentaria.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Driver Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Operador (Chofer):
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ej. Operador Turno Matutino"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 font-medium text-slate-900 bg-white"
                />
              </div>

              {/* Vehicle Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vehículo de Despacho:
                </label>
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value as VehicleType)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 font-medium text-slate-900 bg-white"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.vehicleType}>
                      {v.name} ({v.maxCapacityKg.toLocaleString()} kg) - {v.hasRefrigeration ? '❄️ Thermo King' : 'Secos'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle Details & Capacity Progress */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-semibold">
                  {currentVehicle.name} &bull; Placas: <span className="font-mono">{currentVehicle.plate}</span>
                </span>
                <span className="font-bold font-mono">
                  {totalWeightKg.toLocaleString()} kg / {currentVehicle.maxCapacityKg.toLocaleString()} kg ({capacityPercentage}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isOverweight ? 'bg-fnvac-red-600' : capacityPercentage > 80 ? 'bg-amber-500' : 'bg-fnvac-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, (totalWeightKg / currentVehicle.maxCapacityKg) * 100)}%` }}
                ></div>
              </div>

              {isOverweight && (
                <p className="text-red-700 font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>⚠️ Sobrepeso: La carga excede la capacidad del vehículo ({currentVehicle.maxCapacityKg} kg).</span>
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Asistente FEFO y Carga de Mercancía */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-fnvac-blue-700" />
                  <span>2. Carga y Lotes Asignados ({cargoItems.length})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Selecciona lotes con prioridad FEFO para evitar mermas.
                </p>
              </div>

              {/* Button: Cargar Lotes Críticos FEFO */}
              <button
                type="button"
                onClick={() => loadCriticalBatches()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-fnvac-red-600 hover:bg-fnvac-red-700 text-white shadow-xs transition-colors"
                title="Cargar automáticamente lotes con ≤ 7 días de caducidad"
                aria-label="Agregar Producto Crítico"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cargar Lotes Críticos FEFO</span>
              </button>
            </div>

            {/* Quick Add Batch from Inventory Selector */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <select
                value={selectedBatchToAdd}
                onChange={(e) => setSelectedBatchToAdd(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 bg-white"
              >
                <option value="">-- Agregar Lote Específico del Inventario --</option>
                {batches
                  .filter((b) => b.currentQuantity > 0 && !cargoItems.some((c) => c.batchId === b.id))
                  .map((b) => {
                    const isExpired = isBatchExpiredForDispatch(b);
                    return (
                      <option key={b.id} value={b.id} disabled={isExpired}>
                        {isExpired
                          ? `🚫 [VENCIDO - NO DESPACHAR] ${b.product?.name} - Lote ${b.lotCode} (EXPIRADO)`
                          : `[${b.status || 'ESTABLE'}] ${b.product?.name} (Lote: ${b.lotCode}) - Disp: ${b.currentQuantity} ${b.product?.unit} - Cad: ${b.expirationDate}`}
                      </option>
                    );
                  })}
              </select>
              <button
                type="button"
                disabled={!selectedBatchToAdd}
                onClick={() => handleAddBatch(selectedBatchToAdd)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {/* Cargo Items Table */}
            {cargoItems.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No hay productos agregados a esta ruta</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Haz clic en &quot;Cargar Lotes Críticos FEFO&quot; o agrega productos desde el selector superior.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Producto y Donante</th>
                      <th className="py-2.5 px-3">Lote / Caducidad</th>
                      <th className="py-2.5 px-3 text-right">Cant. Despachar</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cargoItems.map((item) => (
                      <tr key={item.batchId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge
                            status={item.status || 'ESTABLE'}
                            daysRemaining={item.daysRemaining}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[11px] text-slate-500">{item.donor}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-slate-800 font-semibold">{item.lotCode}</div>
                          <div className="text-[11px] text-slate-500">{item.expirationDate}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max={item.availableQuantity}
                              value={item.dispatchedQuantity}
                              onChange={(e) =>
                                handleUpdateQuantity(item.batchId, Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 text-right text-xs font-bold border border-slate-300 rounded focus:ring-2 focus:ring-fnvac-blue-500 font-mono"
                            />
                            <span className="text-[11px] text-slate-500 font-medium w-10 text-left">
                              / {item.availableQuantity} {item.unit}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveCargoItem(item.batchId)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Quitar producto de la ruta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 3: Selección y Orden de Comunidades */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-fnvac-blue-700" />
                  <span>3. Itinerario de Comunidades ({selectedStops.length} paradas)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Organiza la secuencia de visitas desde el CEDIS Celaya.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOptimizeProposedRoute}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white shadow-xs transition-colors active:scale-95"
                title="Calcular y Optimizar Ruta: Reorganizar paradas propuestas minimizando kilometraje y priorizando comunidades con mayor número de familias a alimentar"
                aria-label="Calcular y Optimizar Ruta"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimizar Secuencia (Prioridades y Distancia)</span>
              </button>
            </div>

            {/* Add Community Dropdown */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <select
                value={selectedCommunityToAdd}
                onChange={(e) => setSelectedCommunityToAdd(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 bg-white"
              >
                <option value="">-- Agregar Comunidad al Recorrido --</option>
                {communitiesWithDistance
                  .filter((c) => !selectedStops.some((s) => s.communityId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.municipality}) &bull; {c.distanceFromCedisKm} km desde CEDIS &bull; {c.beneficiariesCount} familias
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!selectedCommunityToAdd}
                onClick={() => handleAddStop(selectedCommunityToAdd)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {/* Stops List */}
            {selectedStops.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No hay paradas seleccionadas</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Haz clic en &quot;Optimizar Secuencia&quot; o selecciona comunidades en el menú desplegable.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* CEDIS Celaya Origin Pin */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-fnvac-blue-50 border border-fnvac-blue-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-fnvac-blue-700 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                      🏢
                    </span>
                    <div>
                      <div className="font-bold text-fnvac-blue-950">
                        CEDIS Celaya (FNVAC) - Origen de Ruta
                      </div>
                      <div className="text-[11px] text-fnvac-blue-800">
                        Km. 9 Carr. San Miguel de Allende - Celaya
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-fnvac-blue-100 text-fnvac-blue-800 px-2 py-0.5 rounded font-bold uppercase">
                    Punto de Salida
                  </span>
                </div>

                {/* Ordered Stops */}
                {selectedStops.map((stop, index) => (
                  <div
                    key={stop.communityId || index}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white transition-all text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-fnvac-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {stop.order}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">
                          {stop.name} <span className="font-normal text-slate-500">({stop.municipality})</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {stop.representativeName ? `Contacto: ${stop.representativeName}` : ''}{' '}
                          {stop.phone ? `&bull; Tel: ${stop.phone}` : ''}{' '}
                          {stop.beneficiariesCount ? `&bull; 👥 ${stop.beneficiariesCount} familias` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Move Up / Down and Remove buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveStop(index, 'up')}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-25 rounded hover:bg-slate-200"
                        title="Mover parada antes"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === selectedStops.length - 1}
                        onClick={() => handleMoveStop(index, 'down')}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-25 rounded hover:bg-slate-200"
                        title="Mover parada después"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(index)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 ml-1"
                        title="Quitar parada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Return to CEDIS Pin */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-dashed border-slate-300 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border border-dashed border-slate-400 flex items-center justify-center text-[10px] font-bold">
                      ↩
                    </span>
                    <span>Retorno a CEDIS Celaya (Cierre de Circuito)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Retorno Logístico
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Leaflet Map & Dispatch Action (5 cols) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          {/* Circuit Summary Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Resumen del Circuito Logístico
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-fnvac-blue-50 rounded-xl border border-fnvac-blue-100">
                <div className="text-[11px] font-semibold text-fnvac-blue-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Distancia Redonda:</span>
                </div>
                <div className="text-xl font-black text-fnvac-blue-950 font-mono mt-0.5">
                  {circuitResult.totalDistanceKm} km
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tiempo Estimado:</span>
                </div>
                <div className="text-xl font-black text-blue-950 font-mono mt-0.5">
                  {formattedDuration}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>Paradas programadas: <strong className="text-slate-900">{selectedStops.length}</strong></span>
              <span>Carga total: <strong className="text-slate-900">{totalWeightKg.toLocaleString()} kg/uds</strong></span>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
            <div className="px-2 py-1.5 mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-fnvac-blue-700" />
                <span>Geolocalización OpenStreetMap</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                CEDIS: 20.595, -100.816
              </span>
            </div>

            <MapRouteView
              stops={selectedStops}
              height="440px"
              showReturnLeg={true}
            />
          </div>

          {/* Main Dispatch Button */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <button
              type="button"
              disabled={isSubmitting || cargoItems.length === 0 || selectedStops.length === 0}
              onClick={handleConfirmDispatch}
              className="w-full py-3 px-4 rounded-xl font-black text-sm text-white bg-fnvac-blue-700 hover:bg-fnvac-blue-800 focus:outline-none focus:ring-4 focus:ring-fnvac-blue-500/20 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Despachar y Generar Manifiesto"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                  <span>Despachando y Descontando Stock...</span>
                </>
              ) : (
                <>
                  <Truck className="w-5 h-5" />
                  <span>Despachar y Generar Manifiesto</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Al confirmar, el sistema descuenta automáticamente las existencias de los lotes seleccionados en la base de datos de bodega y genera la Hoja de Ruta oficial para el chofer.
            </p>
          </div>
        </div>
      </div>

      {/* HISTORIAL DE RUTAS DESPACHADAS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-fnvac-blue-700" />
            <h2 className="text-lg font-bold text-slate-900">
              Historial de Rutas Despachadas
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {historicalRoutes.length} rutas registradas
          </span>
        </div>

        {historicalRoutes.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Aún no se han despachado rutas en el sistema.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Folio Ruta</th>
                  <th className="py-3 px-4">Fecha &amp; Hora</th>
                  <th className="py-3 px-4">Vehículo &amp; Chofer</th>
                  <th className="py-3 px-4">Distancia</th>
                  <th className="py-3 px-4">Comunidades Atendidas</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historicalRoutes.map((route) => {
                  let stopsCount = 0;
                  let stopsSummary = '';
                  try {
                    const stopsArr =
                      typeof route.stops === 'string' ? JSON.parse(route.stops) : route.stops;
                    if (Array.isArray(stopsArr)) {
                      stopsCount = stopsArr.length;
                      stopsSummary = stopsArr.map((s: any) => s.name).join(', ');
                    }
                  } catch {
                    stopsSummary = 'N/D';
                  }

                  return (
                    <tr key={route.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-fnvac-blue-800">
                        {route.routeCode}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(route.createdAt).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{route.driverName}</div>
                        <div className="text-[11px] text-slate-500">
                          {route.vehicleType === 'Torton_ThermoKing'
                            ? '❄️ Torton Thermo King'
                            : 'Camioneta 3.5T'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {route.totalDistanceKm} km
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={stopsSummary}>
                        <span className="font-bold">{stopsCount} paradas: </span>
                        {stopsSummary}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>{route.status || 'En_Transito'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setManifestRoute(route);
                              setIsManifestOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-fnvac-blue-700 hover:text-fnvac-blue-800 bg-fnvac-blue-50 hover:bg-fnvac-blue-100 border border-fnvac-blue-200 transition-colors"
                            title="Abrir e imprimir manifiesto de carga"
                            aria-label={`Ver hoja de ruta para ${route.routeCode}`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ver Hoja</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenUndoModal(route)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                            title="Deshacer despacho de ruta y devolver stock al inventario"
                            aria-label={`Deshacer ruta ${route.routeCode}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Deshacer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Printable Driver Manifest Modal */}
      <DriverManifestModal
        isOpen={isManifestOpen}
        onClose={() => setIsManifestOpen(false)}
        route={manifestRoute}
      />

      {/* Undo Dispatched Route Confirmation Modal */}
      <Modal
        isOpen={isUndoModalOpen}
        onClose={handleCloseUndoModal}
        title="Deshacer Ruta Despachada"
        description="Esta acción revertirá la ruta y reincorporará la mercancía al inventario de bodega."
        maxWidth="lg"
      >
        {routeToUndo && (
          <div className="space-y-4 text-slate-700">
            {undoError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{undoError}</span>
              </div>
            )}

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>¿Está seguro de deshacer la ruta {routeToUndo.routeCode}?</span>
              </div>
              <p className="text-amber-800 leading-relaxed pl-5">
                La ruta será eliminada del historial de despachos y se reincorporarán automáticamente las existencias a sus lotes originales en bodega.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Folio de Ruta:</span>{' '}
                  <strong className="font-mono text-slate-900">{routeToUndo.routeCode}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Chofer:</span>{' '}
                  <strong className="text-slate-900">{routeToUndo.driverName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Fecha de Despacho:</span>{' '}
                  <strong className="text-slate-900">
                    {new Date(routeToUndo.createdAt).toLocaleString('es-MX', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Unidades a Restaurar:</span>{' '}
                  <strong className="text-fnvac-blue-700">{undoTotalUnits.toLocaleString()} uds</strong>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Mercancía a reincorporar al inventario ({undoDispatchedItems.length} lotes):
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs">
                {undoDispatchedItems.length === 0 ? (
                  <div className="p-3 text-center text-slate-400">Sin productos registrados en esta ruta.</div>
                ) : (
                  undoDispatchedItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-slate-800">{item.productName || 'Producto'}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Lote: {item.lotCode || item.batchId}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-fnvac-blue-700">
                          +{item.quantity} {item.unit || 'uds'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCloseUndoModal}
                disabled={isUndoing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUndoRoute}
                disabled={isUndoing}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isUndoing ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                    <span>Deshaciendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmar y Devolver Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function RutasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-fnvac-blue-600 border-r-transparent"></div>
          <p className="font-medium">Cargando Planificador de Rutas CEDIS Celaya...</p>
        </div>
      }
    >
      <RoutePlannerContent />
    </Suspense>
  );
}
