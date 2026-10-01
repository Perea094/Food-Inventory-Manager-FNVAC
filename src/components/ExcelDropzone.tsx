'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Loader2,
  ArrowRight,
  Eye,
  FileCheck,
  Calendar,
  Layers,
  MapPin,
} from 'lucide-react';

// Required column keys definition with supported aliases
const REQUIRED_COLUMNS = [
  {
    key: 'Codigo_Barras',
    label: 'Código de Barras',
    aliases: ['codigobarras', 'codigodebarras', 'barcode', 'codigo', 'codigodebarra'],
  },
  {
    key: 'Producto',
    label: 'Producto',
    aliases: ['producto', 'nombre', 'name', 'descripcion', 'articulonombre'],
  },
  {
    key: 'Fecha_Caducidad_YYYY_MM_DD',
    label: 'Fecha Caducidad',
    aliases: [
      'fechacaducidadyyyymmdd',
      'fechacaducidad',
      'expirationdate',
      'fechavencimiento',
      'caducidad',
      'vencimiento',
    ],
  },
  {
    key: 'Cantidad',
    label: 'Cantidad',
    aliases: ['cantidad', 'currentquantity', 'qty', 'stock', 'unidades', 'cant'],
  },
];

interface PreviewRow {
  barcode: string;
  name: string;
  donorType: string;
  lotCode: string;
  expirationDate: string;
  quantity: string | number;
  storageArea: string;
}

interface ParsedSummary {
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  detectedColumns: string[];
  missingRequiredColumns: string[];
  isValidStructure: boolean;
  previewRows: PreviewRow[];
}

interface ExcelDropzoneProps {
  onImportSuccess?: (result: { processedCount: number; errors: string[] }) => void;
}

// Normalizes header keys by removing spaces, underscores, and accents
function cleanHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Finds value in row matching target aliases
function findValue(row: Record<string, any>, aliases: string[]): any {
  for (const k of Object.keys(row)) {
    const cleanK = cleanHeader(k);
    for (const target of aliases) {
      if (cleanK === cleanHeader(target)) {
        return row[k];
      }
    }
  }
  return undefined;
}

// Formats date value to YYYY-MM-DD string
function formatDatePreview(dateVal: any): string {
  if (!dateVal) return '—';
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getUTCFullYear();
    const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateVal).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str || '—';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExcelDropzone: React.FC<ExcelDropzoneProps> = ({ onImportSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParsedSummary | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    processedCount?: number;
    message?: string;
    errors?: string[];
  } | null>(null);

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!hasValidExt) {
      setParseError('Formato no compatible. Por favor sube un archivo con extensión .xlsx, .xls o .csv');
      setSelectedFile(null);
      setSummary(null);
      setUploadResult(null);
      return;
    }

    try {
      setIsParsing(true);
      setParseError(null);
      setUploadResult(null);
      setSelectedFile(file);

      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('El libro de cálculo no contiene ninguna hoja visible.');
      }

      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error('La primera hoja del archivo está vacía o dañada.');
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('La hoja seleccionada no contiene registros ni filas de datos.');
      }

      // Collect detected column headers from first few rows
      const detectedColumnsSet = new Set<string>();
      rawRows.slice(0, 5).forEach((r) => {
        Object.keys(r).forEach((k) => detectedColumnsSet.add(k));
      });
      const detectedColumns = Array.from(detectedColumnsSet);

      // Verify required columns
      const missingRequiredColumns: string[] = [];
      REQUIRED_COLUMNS.forEach((reqCol) => {
        const found = detectedColumns.some((colHeader) => {
          const cleanCol = cleanHeader(colHeader);
          return reqCol.aliases.some((alias) => cleanCol === cleanHeader(alias));
        });
        if (!found) {
          missingRequiredColumns.push(reqCol.label);
        }
      });

      const isValidStructure = missingRequiredColumns.length === 0;

      // Extract preview rows (up to 10 rows)
      const previewRows: PreviewRow[] = rawRows.slice(0, 10).map((row) => {
        const barcode =
          findValue(row, ['Codigo_Barras', 'CodigoBarras', 'Código de Barras', 'barcode', 'codigo']) ??
          '—';
        const name = findValue(row, ['Producto', 'Nombre', 'name', 'producto']) ?? '—';
        const donorType = findValue(row, ['Donante', 'donorType', 'donante']) ?? 'Donación General';
        const lotCode = findValue(row, ['Lote', 'lotCode', 'lote']) ?? 'S/L';
        const rawDate = findValue(row, [
          'Fecha_Caducidad_YYYY_MM_DD',
          'Fecha_Caducidad',
          'FechaCaducidad',
          'expirationDate',
        ]);
        const expirationDate = formatDatePreview(rawDate);
        const quantity =
          findValue(row, ['Cantidad', 'currentQuantity', 'qty', 'cantidad']) ?? '0';
        const storageArea =
          findValue(row, ['Area_Bodega', 'AreaBodega', 'Área Bodega', 'storageArea', 'area']) ??
          'Nave_Secos';

        return {
          barcode: String(barcode),
          name: String(name),
          donorType: String(donorType),
          lotCode: String(lotCode),
          expirationDate,
          quantity: quantity,
          storageArea: String(storageArea),
        };
      });

      setSummary({
        fileName: file.name,
        fileSizeBytes: file.size,
        totalRows: rawRows.length,
        detectedColumns,
        missingRequiredColumns,
        isValidStructure,
        previewRows,
      });
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo Excel.');
      setSummary(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummary(null);
    setParseError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/excel/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          processedCount: data.processedCount,
          errors: data.errors || [],
        });
        if (onImportSuccess) {
          onImportSuccess({
            processedCount: data.processedCount,
            errors: data.errors || [],
          });
        }
      } else {
        setUploadResult({
          success: false,
          message: data.error || 'Ocurrió un error al procesar la importación en el servidor.',
          errors: data.errors || [],
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: 'Error de red o comunicación: ' + (err.message || 'Desconocido'),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Drag & Drop Area (if no file loaded or wants to change) */}
      {!summary && !isParsing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-fnvac-blue-500 bg-fnvac-blue-50/70 scale-[1.01] shadow-lg shadow-fnvac-blue-500/10'
              : 'border-slate-300 hover:border-fnvac-blue-500 hover:bg-slate-50/80 bg-white shadow-xs'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                isDragging
                  ? 'bg-fnvac-blue-600 text-white'
                  : 'bg-fnvac-blue-100 text-fnvac-blue-700 group-hover:bg-fnvac-blue-200'
              }`}
            >
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                Arrastra tu archivo Excel o haz clic para examinar
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Formatos compatibles: <span className="font-semibold text-slate-700">.xlsx, .xls, .csv</span>.
                Compatible con listas de donantes, inventarios previos y reportes de almacén.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
              <FileSpreadsheet className="w-3.5 h-3.5 text-fnvac-blue-600" />
              <span>Detección automática de columnas y previsualizador FEFO</span>
            </div>
          </div>
        </div>
      )}

      {/* Parsing indicator */}
      {isParsing && (
        <div className="border border-slate-200 bg-white rounded-2xl p-12 text-center shadow-xs">
          <Loader2 className="w-10 h-10 text-fnvac-blue-600 animate-spin mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-900">Analizando hoja de cálculo...</h4>
          <p className="text-xs text-slate-500 mt-1">
            Leyendo encabezados, validando tipos de datos y estructurando filas de inventario.
          </p>
        </div>
      )}

      {/* Parse Error Notification */}
      {parseError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Error al interpretar el archivo</p>
            <p className="mt-0.5 text-rose-700">{parseError}</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2. File Preview and Validation Area */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* File Header Bar */}
          <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fnvac-blue-100 text-fnvac-blue-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base break-all">
                    {summary.fileName}
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    ({formatBytes(summary.fileSizeBytes)})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>{summary.totalRows} filas detectadas</span>
                  <span>&bull;</span>
                  <span>Primera hoja de cálculo</span>
                </div>
              </div>
            </div>

            {/* Validation Badge */}
            <div className="flex items-center gap-2">
              {summary.isValidStructure ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-fnvac-blue-100 text-fnvac-blue-800 border border-fnvac-blue-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-fnvac-blue-600" />
                  <span>Columnas obligatorias válidas (4/4)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Faltan columnas: {summary.missingRequiredColumns.join(', ')}</span>
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={isUploading}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                title="Descartar archivo y cargar otro"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Cambiar</span>
              </button>
            </div>
          </div>

          {/* Missing columns warning banner if any */}
          {!summary.isValidStructure && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Atención de compatibilidad: </span>
                No se detectaron los encabezados obligatorios: {summary.missingRequiredColumns.join(', ')}.
                El servidor podría rechazar la importación si no contiene estos campos requeridos para la base de datos de FNVAC.
              </div>
            </div>
          )}

          {/* Table Preview of first rows */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-500" />
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Previsualización de registros (Primeras {Math.min(summary.previewRows.length, 10)} de {summary.totalRows} filas)
                </h5>
              </div>
              <span className="text-[11px] text-slate-500">
                Verifica que los datos coincidan antes de confirmar
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Código de Barras</th>
                    <th className="px-3.5 py-2.5">Producto</th>
                    <th className="px-3.5 py-2.5">Donante</th>
                    <th className="px-3.5 py-2.5">Lote</th>
                    <th className="px-3.5 py-2.5">Fecha Caducidad</th>
                    <th className="px-3.5 py-2.5 text-right">Cantidad</th>
                    <th className="px-3.5 py-2.5">Área Bodega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {summary.previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2 font-semibold text-slate-900">{row.barcode}</td>
                      <td className="px-3.5 py-2 font-sans font-medium text-slate-800">{row.name}</td>
                      <td className="px-3.5 py-2 font-sans text-slate-600">{row.donorType}</td>
                      <td className="px-3.5 py-2 text-slate-700">{row.lotCode}</td>
                      <td className="px-3.5 py-2">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-800">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {row.expirationDate}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-fnvac-blue-800">
                        {row.quantity}
                      </td>
                      <td className="px-3.5 py-2 font-sans">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {row.storageArea}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Upload Action and Status */}
            <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Al confirmar, se registrarán automáticamente los productos nuevos y se crearán los lotes en el CEDIS Celaya.
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleReset}
                  disabled={isUploading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isUploading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white text-xs font-bold shadow-md shadow-fnvac-blue-700/20 transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando e Importando...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Confirmar e Importar al Inventario</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Success Banner */}
      {uploadResult && uploadResult.success && (
        <div className="rounded-2xl bg-fnvac-blue-50 border border-fnvac-blue-200 text-fnvac-blue-950 p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-fnvac-blue-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-fnvac-blue-900">
                ¡Carga Masiva Exitosa!
              </h4>
              <p className="mt-1 text-sm font-medium text-fnvac-blue-800">
                Se procesaron exitosamente {uploadResult.processedCount} registros de lote en el almacén.
              </p>
              <p className="mt-0.5 text-xs text-fnvac-blue-700">
                Los productos y lotes han sido actualizados en la base de datos de CEDIS Celaya y ya cuentan con cálculo FEFO en tiempo real.
              </p>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Advertencias durante la importación ({uploadResult.errors.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 max-h-32 overflow-y-auto text-[11px] text-amber-800">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-fnvac-blue-700 hover:bg-fnvac-blue-800 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <span>Ver Inventario Consolidado</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-fnvac-blue-300 text-fnvac-blue-800 hover:bg-fnvac-blue-100 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-fnvac-blue-600" />
              <span>Importar Otro Archivo Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Server Error Banner */}
      {uploadResult && !uploadResult.success && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-rose-950 shadow-xs space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-rose-900">
                Error al procesar la importación
              </h4>
              <p className="mt-1 text-sm font-medium text-rose-800">
                {uploadResult.message || 'El servidor no pudo validar o guardar los registros de la hoja.'}
              </p>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-3 p-3 bg-white/80 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Detalle de errores encontrados ({uploadResult.errors.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 max-h-40 overflow-y-auto text-[11px] text-rose-800 font-mono">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleConfirmImport}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar Importación</span>
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 text-xs font-semibold transition-colors"
            >
              <span>Subir un Archivo Corregido</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelDropzone;
