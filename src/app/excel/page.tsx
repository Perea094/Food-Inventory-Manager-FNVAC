'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Table,
  Info,
  Layers,
  Calendar,
  Truck,
  Building2,
  Database,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Users,
} from 'lucide-react';
import ExcelDropzone from '../../components/ExcelDropzone.tsx';
import Modal from '../../components/Modal.tsx';
import UserManagementTab from '../../components/UserManagementTab.tsx';

export default function ExcelPage() {
  const [sessionUser, setSessionUser] = useState<{
    id?: string;
    userId?: string;
    username?: string;
    role?: string;
    name?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'excel' | 'operators'>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Modal Seed state
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);
  const [seedErrorMessage, setSeedErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setSessionUser(data.user || null);
        }
      } catch (err) {
        console.error('Error al verificar sesión en excel page:', err);
      }
    }
    loadSession();
  }, []);

  const handleDownloadExport = async () => {
    try {
      setIsExporting(true);
      const res = await fetch('/api/excel/export');
      if (!res.ok) {
        throw new Error(`Error en servidor al exportar (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventario_fnvac_celaya.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('No fue posible descargar el archivo de inventario: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const res = await fetch('/api/excel/template');
      if (!res.ok) {
        throw new Error(`Error en servidor al generar plantilla (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_captura_fnvac.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('No fue posible descargar la plantilla oficial: ' + err.message);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleExecuteSeed = async () => {
    try {
      setIsSeeding(true);
      setSeedErrorMessage(null);
      setSeedSuccessMessage(null);

      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setSeedSuccessMessage(
          'Base de datos restablecida correctamente con el catálogo y lotes muestra de Celaya.'
        );
      } else {
        setSeedErrorMessage(data.error || 'Error al restablecer la base de datos.');
      }
    } catch (err: any) {
      setSeedErrorMessage('Error de red al conectar con el servidor: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-fnvac-blue-800 uppercase tracking-wider mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-fnvac-blue-100 border border-fnvac-blue-200">
                  Interoperabilidad Bidireccional
                </span>
                <span>&bull;</span>
                <span className="text-slate-500">Fundación Nutrición y Vida A.C. - CEDIS Celaya</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Centro de Interoperabilidad y Migración Excel
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
                Herramienta oficial de integración para la transición fluida entre hojas de cálculo y la
                plataforma digital de FNVAC. Permite descargar reportes ejecutivos consolidados para auditorías/SAT,
                obtener la plantilla oficial de captura de almacén y procesar cargas masivas de donaciones sin perder trazabilidad FEFO.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors shadow-xs"
              >
                <span>Ver Tablero FEFO</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Operational Context Alert */}
          <div className="mt-6 rounded-2xl bg-gradient-to-r from-fnvac-blue-50 via-slate-50 to-white border border-fnvac-blue-200/80 p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-fnvac-blue-600 text-white shrink-0 mt-0.5">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-1">
                <p className="font-bold text-slate-900">
                  Flujo Operativo de Donaciones en CEDIS Celaya:
                </p>
                <p>
                  Las remisiones de empresas donantes como <strong className="text-slate-900">Cuadritos Biotek</strong>,
                  productores del Bajío y autoservicios se reciben comúnmente en formato Excel.
                  Este módulo estandariza los registros y los incorpora al inventario local con cálculo automático de caducidad
                  y semáforo FEFO (<span className="text-rose-700 font-semibold">Crítico</span>,{' '}
                  <span className="text-amber-700 font-semibold">Atención</span>,{' '}
                  <span className="text-fnvac-blue-700 font-semibold">Estable</span>) sin requerir re-captura manual.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switch bar under header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('excel')}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'excel'
                ? 'border-fnvac-blue-600 text-fnvac-blue-700 bg-slate-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Archivos Excel & Migración</span>
          </button>

          {(sessionUser?.role === 'admin' || !sessionUser) && (
            <button
              onClick={() => setActiveTab('operators')}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'operators'
                  ? 'border-fnvac-blue-600 text-fnvac-blue-700 bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gestión de Operadores y Accesos</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'excel' && (
        <>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
        {/* ========================================================================= */}
        {/* SECTION 1: Descarga y Reportes                                            */}
        {/* ========================================================================= */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-fnvac-blue-700" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Sección 1: Descarga de Reportes y Plantillas Oficiales
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card A: Exportar Inventario Consolidado */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-fnvac-blue-100 text-fnvac-blue-800 flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-fnvac-blue-50 text-fnvac-blue-800 border border-fnvac-blue-200 mb-1">
                        Reporte Ejecutivo Multi-Hoja
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Exportar Inventario Consolidado (.xlsx)
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                  Genera un libro de Excel oficial estructurado en 3 hojas de cálculo independientes
                  para auditorías internas del Patronato, supervisión sanitaria y reportes fiscales ante el SAT:
                </p>

                <div className="space-y-3 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-fnvac-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900">Inventario Actual: </strong>
                      <span className="text-slate-600">
                        Todos los lotes en almacén con código de barras, categoría, unidad, área bodega y semáforo FEFO.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900">Alertas Críticas (&le; 7 días): </strong>
                      <span className="text-slate-600">
                        Lotes con caducidad inmediata priorizados para despacho urgente a comedores comunitarios.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900">Bitácora de Rutas Despachadas: </strong>
                      <span className="text-slate-600">
                        Historial de salidas logísticas desde CEDIS Celaya, unidades entregadas, paradas y choferes.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Nombre: <code className="text-slate-700 font-mono font-semibold">inventario_fnvac_celaya.xlsx</code>
                </span>

                <button
                  onClick={handleDownloadExport}
                  disabled={isExporting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-fnvac-blue-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 disabled:opacity-60"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando archivo...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Descargar Inventario (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card B: Descargar Plantilla Oficial */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-fnvac-blue-100 text-fnvac-blue-800 flex items-center justify-center font-bold">
                      <Table className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-fnvac-blue-50 text-fnvac-blue-800 border border-fnvac-blue-200 mb-1">
                        Estandarización Operativa
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Descargar Plantilla Oficial FNVAC (.xlsx)
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                  Archivo preconfigurado con la estructura de columnas requerida por el sistema de inventario
                  para captura rápida por personal de recepción, montacarguistas y donantes:
                </p>

                <div className="space-y-2 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-700">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 font-semibold text-slate-800">
                    <span>Columnas Obligatorias:</span>
                    <span className="text-fnvac-blue-700">Formato Estricto</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><code className="font-bold text-slate-800">Codigo_Barras</code> (EAN-13 o interno)</li>
                    <li><code className="font-bold text-slate-800">Producto</code> (Nombre comercial descriptivo)</li>
                    <li><code className="font-bold text-slate-800">Fecha_Caducidad_YYYY_MM_DD</code> (ej. 2026-09-25)</li>
                    <li><code className="font-bold text-slate-800">Cantidad</code> (Número de unidades mayor a 0)</li>
                    <li>Campos complementarios: Donante, Categoría, Unidad, Área de Bodega y Lote.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Nombre: <code className="text-slate-700 font-mono font-semibold">plantilla_captura_fnvac.xlsx</code>
                </span>

                <button
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-fnvac-blue-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 disabled:opacity-60"
                >
                  {isDownloadingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Descargando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Descargar Plantilla (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: Carga Masiva de Alimentos y Lotes                               */}
        {/* ========================================================================= */}
        <section className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-fnvac-blue-700" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Sección 2: Carga Masiva de Alimentos y Lotes
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Arrastra o selecciona el archivo para validar antes de guardar
            </span>
          </div>

          {/* Interactive Dropzone Component */}
          <ExcelDropzone />

          {/* Column Mapping Guide with sample values */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-fnvac-blue-600" />
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Guía de Mapeo de Columnas y Valores Válidos para Celaya
              </h4>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              La plataforma reconoce automáticamente los nombres de columna estándar y variaciones comunes con mayúsculas,
              minúsculas o guiones bajos. Asegúrate de incluir los campos requeridos:
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Columna</th>
                    <th className="px-3 py-2.5">Requerido</th>
                    <th className="px-3 py-2.5">Ejemplo Muestra</th>
                    <th className="px-3 py-2.5">Opciones / Formato Válido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-fnvac-blue-800 font-mono">Codigo_Barras</td>
                    <td className="px-3 py-2 font-sans font-semibold text-rose-700">Sí (Obligatorio)</td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">7500000000017</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Código EAN-13 de producto o código interno de almacén</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-fnvac-blue-800 font-mono">Producto</td>
                    <td className="px-3 py-2 font-sans font-semibold text-rose-700">Sí (Obligatorio)</td>
                    <td className="px-3 py-2 text-slate-900 font-sans font-medium">Leche Entera UHT 1L</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Nombre descriptivo con presentación comercial</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-slate-800 font-mono">Donante</td>
                    <td className="px-3 py-2 font-sans text-slate-500">Opcional</td>
                    <td className="px-3 py-2 text-slate-900 font-sans">Cuadritos Biotek</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Empresa donante, Central de Abasto, Donación General</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-slate-800 font-mono">Categoria</td>
                    <td className="px-3 py-2 font-sans text-slate-500">Opcional</td>
                    <td className="px-3 py-2 text-slate-900">LACTEO_FRIO</td>
                    <td className="px-3 py-2 font-sans text-slate-600">
                      <code>LACTEO_FRIO</code>, <code>AGRICOLA_PERECEDERO</code>, <code>SECO_ABARROTE</code>, <code>NO_ALIMENTARIO</code>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-slate-800 font-mono">Unidad</td>
                    <td className="px-3 py-2 font-sans text-slate-500">Opcional</td>
                    <td className="px-3 py-2 text-slate-900">litros</td>
                    <td className="px-3 py-2 font-sans text-slate-600">
                      <code>piezas</code>, <code>kilos</code>, <code>cajas</code>, <code>litros</code>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-slate-800 font-mono">Area_Bodega</td>
                    <td className="px-3 py-2 font-sans text-slate-500">Opcional</td>
                    <td className="px-3 py-2 text-slate-900">Camara_Fria</td>
                    <td className="px-3 py-2 font-sans text-slate-600">
                      <code>Camara_Fria</code> (0-4°C), <code>Nave_Secos</code>, <code>Anden</code>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-fnvac-blue-800 font-mono">Fecha_Caducidad_YYYY_MM_DD</td>
                    <td className="px-3 py-2 font-sans font-semibold text-rose-700">Sí (Obligatorio)</td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">2026-09-25</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Formato ISO YYYY-MM-DD (año-mes-día)</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-fnvac-blue-800 font-mono">Cantidad</td>
                    <td className="px-3 py-2 font-sans font-semibold text-rose-700">Sí (Obligatorio)</td>
                    <td className="px-3 py-2 text-slate-900 font-bold text-fnvac-blue-700">500</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Cantidad numérica disponible mayor a 0</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-bold text-slate-800 font-mono">Lote</td>
                    <td className="px-3 py-2 font-sans text-slate-500">Opcional</td>
                    <td className="px-3 py-2 text-slate-900">LT-LE-2601</td>
                    <td className="px-3 py-2 font-sans text-slate-600">Código alfanumérico impreso en empaque o autogenerado</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: Mantenimiento y Datos de Prueba                                */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-amber-200/90 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                <Database className="w-3.5 h-3.5 text-amber-700" />
                <span>Mantenimiento y Ambiente de Demostración</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                Restablecer Base de Datos Oficial (Seed Data Celaya)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Restaura el estado original del sistema con los 15 productos representativos de Celaya
                (donantes como Cuadritos Biotek, productores locales de hortalizas), catálogo de 10 comunidades rurales,
                flota de vehículos logísticos (incluyendo el Torton Thermo King) y lotes calibrados en semáforo FEFO.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => {
                  setSeedErrorMessage(null);
                  setSeedSuccessMessage(null);
                  setIsSeedModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restablecer Datos de Demostración</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation Modal for Demo Data Re-Seed */}
      <Modal
        isOpen={isSeedModalOpen}
        onClose={() => {
          if (!isSeeding) setIsSeedModalOpen(false);
        }}
        title="Restablecer Datos Demostrativos"
        description="Fundación Nutrición y Vida A.C. - CEDIS Celaya"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">¿Deseas reiniciar la base de datos a su estado oficial?</p>
              <p className="mt-1 text-amber-800">
                Esta acción sustituirá las pruebas o registros actuales con los datos muestra oficiales
                de Celaya: donaciones de Cuadritos, comunidades del Bajío, unidades con refrigeración y lotes FEFO iniciales.
              </p>
            </div>
          </div>

          {seedSuccessMessage && (
            <div className="rounded-xl bg-fnvac-blue-50 border border-fnvac-blue-200 p-4 text-xs text-fnvac-blue-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-fnvac-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">¡Operación exitosa!</p>
                <p className="mt-0.5 text-fnvac-blue-800">{seedSuccessMessage}</p>
              </div>
            </div>
          )}

          {seedErrorMessage && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error al ejecutar reinicio</p>
                <p className="mt-0.5 text-rose-800">{seedErrorMessage}</p>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsSeedModalOpen(false)}
              disabled={isSeeding}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {seedSuccessMessage ? 'Cerrar' : 'Cancelar'}
            </button>

            {!seedSuccessMessage ? (
              <button
                onClick={handleExecuteSeed}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Restableciendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Sí, Restablecer Base de Datos</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsSeedModalOpen(false);
                  window.location.href = '/';
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <span>Ir al Tablero Principal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Modal>
        </>
      )}

      {activeTab === 'operators' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <UserManagementTab />
        </div>
      )}
    </div>
  );
}
