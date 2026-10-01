'use client';

import React, { useEffect } from 'react';
import { Printer, X, ShieldAlert, Truck, Calendar, User, MapPin, PackageCheck } from 'lucide-react';
import type { RouteStop, DispatchedItem, VehicleType } from '../types/index';

export interface DriverManifestData {
  id?: string;
  routeCode: string;
  createdAt: string;
  vehicleType: VehicleType | string;
  vehicleName?: string;
  vehiclePlate?: string;
  driverName: string;
  status?: string;
  totalDistanceKm?: number;
  stops: RouteStop[] | string;
  dispatchedItems: DispatchedItem[] | string;
}

export interface DriverManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: DriverManifestData | null;
}

export const DriverManifestModal: React.FC<DriverManifestModalProps> = ({
  isOpen,
  onClose,
  route,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('manifest-modal-open');
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('manifest-modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !route) return null;

  // Safely parse stops
  let stops: RouteStop[] = [];
  try {
    stops = Array.isArray(route.stops)
      ? route.stops
      : typeof route.stops === 'string'
      ? JSON.parse(route.stops)
      : [];
  } catch {
    stops = [];
  }

  // Safely parse items
  let items: DispatchedItem[] = [];
  try {
    items = Array.isArray(route.dispatchedItems)
      ? route.dispatchedItems
      : typeof route.dispatchedItems === 'string'
      ? JSON.parse(route.dispatchedItems)
      : [];
  } catch {
    items = [];
  }

  // Determine if cold chain banner must be shown
  const isColdChainRequired =
    route.vehicleType === 'Torton_ThermoKing' ||
    items.some(
      (item) =>
        item.category === 'LACTEO_FRIO' ||
        item.category === 'AGRICOLA_PERECEDERO' ||
        item.productName?.toLowerCase().includes('leche') ||
        item.productName?.toLowerCase().includes('queso') ||
        item.productName?.toLowerCase().includes('yogur') ||
        item.productName?.toLowerCase().includes('brócoli') ||
        item.productName?.toLowerCase().includes('brocoli') ||
        item.productName?.toLowerCase().includes('zanahoria') ||
        item.productName?.toLowerCase().includes('jitomate')
    );

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const vehicleDisplay =
    route.vehicleName ||
    (route.vehicleType === 'Torton_ThermoKing'
      ? 'Torton Thermo King #1 (Refrigerado)'
      : 'Camioneta 3.5 Ton Reparto');

  const plateDisplay =
    route.vehiclePlate || (route.vehicleType === 'Torton_ThermoKing' ? 'GT-4821-C' : 'GT-1092-B');

  const totalCargoUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalBeneficiaries = stops.reduce(
    (acc, curr) => acc + (Number(curr.beneficiariesCount) || 0),
    0
  );

  return (
    <div className="manifest-modal-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Modal Dialog Card */}
      <div className="manifest-modal-dialog relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 print:static print:max-w-none print:w-full print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:overflow-visible">
        {/* Top Control Bar (Screen Only) */}
        <div className="no-print print:hidden flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo-fnvac.png" alt="FNVAC" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-fnvac-blue-400" />
              <span className="font-bold text-sm tracking-wide">
                Manifiesto de Carga y Hoja de Ruta
              </span>
              <span className="text-xs bg-fnvac-blue-500/20 text-fnvac-blue-300 font-mono px-2 py-0.5 rounded border border-fnvac-blue-500/30">
                {route.routeCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white shadow transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-400 cursor-pointer"
              title="Imprimir manifiesto oficial"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Manifiesto (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Manifest Sheet */}
        <div className="manifest-modal-scroll max-h-[calc(90vh-65px)] overflow-y-auto p-6 sm:p-8 bg-slate-50/50 print:static print:max-h-none print:overflow-visible print:p-0 print:m-0 print:bg-white">
          <div
            id="driver-manifest-sheet"
            className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm space-y-6 text-slate-900 print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none"
          >
            {/* Header: Fundación Nutrición y Vida, A.C. */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <img src="/logo-fnvac.png" alt="FNVAC" className="h-10 sm:h-12 w-auto object-contain shrink-0" />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                      Fundación Nutrición y Vida, A.C. - CEDIS Celaya
                    </h1>
                    <h2 className="text-base sm:text-lg font-bold text-fnvac-blue-800 mt-0.5">
                      Hoja de Ruta de Distribución y Manifiesto de Carga para Chofer
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Km. 9 Carretera San Miguel de Allende - Celaya &bull; Banco de Alimentos &bull; Tel. CEDIS: (461) 615-0000
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right bg-slate-100 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200 shrink-0">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Folio de Despacho
                  </div>
                  <div className="text-xl font-black font-mono text-fnvac-blue-800">
                    {route.routeCode}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex items-center sm:justify-end gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDateTime(route.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Driver & Vehicle Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    Operador / Chofer Asignado:
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {route.driverName}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" />
                    Vehículo &amp; Placas:
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {vehicleDisplay}
                  </div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    Placas: <span className="font-semibold">{plateDisplay}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    Circuito Logístico Estimado:
                  </div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {route.totalDistanceKm ? `${route.totalDistanceKm} km` : 'Circuito Celaya Regional'}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    {stops.length} Paradas &bull; {totalBeneficiaries} Familias
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Cold Chain Instruction Banner */}
            {isColdChainRequired && (
              <div className="print-break-inside-avoid print:break-inside-avoid p-4 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-950 flex items-start gap-3 shadow-xs print:bg-amber-50/20 print:border-amber-700 print:text-black">
                <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-black text-amber-900 uppercase tracking-wide">
                    ⚠️ REQUERIMIENTO CRÍTICO DE CADENA DE FRÍO: Mantener caja refrigerada Thermo King a 4°C en todo el trayecto.
                  </p>
                  <p className="mt-1 text-amber-800 text-xs leading-relaxed print:text-black">
                    La carga incluye lácteos, quesos o alimentos perecederos altamente sensibles a la temperatura. No apagar el compresor Thermo King en paradas intermedias de entrega. En caso de variación superior a 6°C, reportar de inmediato a Supervisor de Almacén CEDIS Celaya.
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: Itinerary / Paradas de Entrega */}
            <div className="print-break-inside-avoid print:break-inside-avoid">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-fnvac-blue-700" />
                  <span>1. Itinerario de Paradas y Puntos de Entrega ({stops.length})</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Origen: CEDIS Celaya &bull; Ruta Secuencial
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-lg print:border-slate-400 print:overflow-visible">
                <table className="print-table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2 px-3 text-center w-14">Parada #</th>
                      <th className="py-2 px-3">Comunidad / Comedor</th>
                      <th className="py-2 px-3">Municipio</th>
                      <th className="py-2 px-3">Representante / Contacto</th>
                      <th className="py-2 px-3">Teléfono</th>
                      <th className="py-2 px-3 text-center">Familias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stops.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">
                          Sin paradas registradas
                        </td>
                      </tr>
                    ) : (
                      stops.map((stop, index) => (
                        <tr key={stop.communityId || index} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-slate-50/60 font-mono">
                            {stop.order || index + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {stop.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {stop.municipality || 'Celaya'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            {stop.representativeName || 'Comité Comunitario'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {stop.phone || 'S/N'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono">
                            {stop.beneficiariesCount || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Manifiesto de Carga Despachada */}
            <div className="print-break-inside-avoid print:break-inside-avoid">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-fnvac-blue-700" />
                  <span>2. Manifiesto de Carga y Lotes Despachados ({items.length} renglones)</span>
                </h3>
                <span className="text-[11px] text-slate-600 font-semibold">
                  Total Carga: {totalCargoUnits.toLocaleString('es-MX')} unidades/kg/L
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-lg print:border-slate-400 print:overflow-visible">
                <table className="print-table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3">Código Lote</th>
                      <th className="py-2 px-3">Caducidad (FEFO)</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3">Unidad</th>
                      <th className="py-2 px-3">Donante / Aliado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">
                          Sin productos asignados a la ruta
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={item.batchId || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.productName}
                            {item.category === 'LACTEO_FRIO' && (
                              <span className="ml-1 text-[10px] text-cyan-700 bg-cyan-50 px-1 py-0.5 rounded font-normal">
                                ❄️ Frío
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                            {item.lotCode || 'N/D'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {item.expirationDate || 'Ver envase'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900 text-sm">
                            {Number(item.quantity).toLocaleString('es-MX')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {item.donor || 'Cuadritos Biotek / Campo'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Receipt & Signatures Section */}
            <div className="pt-4 border-t-2 border-slate-900 print-break-inside-avoid print:break-inside-avoid">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
                3. Firmas de Conformidad y Salida
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                {/* 1. Despachó */}
                <div className="flex flex-col justify-between h-28 border border-slate-300 rounded-lg p-3 bg-slate-50/40 print:border-slate-400 print:bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                    1. Despachó
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Almacén &amp; Control FEFO CEDIS Celaya</div>
                    <div className="text-[10px] text-slate-500 print:text-slate-700">Firma y Sello de Salida</div>
                  </div>
                </div>

                {/* 2. Conductor / Recibió Carga */}
                <div className="flex flex-col justify-between h-28 border border-slate-300 rounded-lg p-3 bg-slate-50/40 print:border-slate-400 print:bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                    2. Conductor / Recibió Carga
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{route.driverName || 'Operador de Ruta'}</div>
                    <div className="text-[10px] text-slate-500 print:text-slate-700">Firma de Entrega en Ruta</div>
                  </div>
                </div>

                {/* 3. Responsable de CEDIS */}
                <div className="flex flex-col justify-between h-28 border border-slate-300 rounded-lg p-3 bg-slate-50/40 print:border-slate-400 print:bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                    3. Responsable de CEDIS
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Supervisión Logística FNVAC</div>
                    <div className="text-[10px] text-slate-500 print:text-slate-700">Validación y Cierre de Salida</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[10px] text-slate-400 text-center print:text-slate-600">
                Documento oficial generado por la Plataforma de Logística e Inventario FNVAC &bull; Fundación Nutrición y Vida A.C. Celaya, Gto.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverManifestModal;
