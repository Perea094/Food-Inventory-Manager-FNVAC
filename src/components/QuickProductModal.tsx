'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, AlertCircle, Sparkles, Building2, Tag, Layers, Boxes, MapPin } from 'lucide-react';
import Modal from './Modal.tsx';
import type { Product, ProductCategory, StorageArea, UnitType } from '../types/index';

export interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedBarcode: string;
  suggestedName?: string;
  onProductCreated: (newProduct: Product) => void;
}

/**
 * Generates an internal barcode identifier for items lacking physical barcodes
 */
export function generateInternalBarcode(): string {
  return `INT-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
}

const CATEGORY_OPTIONS: { label: string; value: ProductCategory }[] = [
  { label: 'Lácteo Frío (Refrigeración 2°C - 4°C)', value: 'LACTEO_FRIO' },
  { label: 'Agrícola Perecedero (Frutas y Hortalizas Frescas)', value: 'AGRICOLA_PERECEDERO' },
  { label: 'Secos / Abarrotes (No Perecedero)', value: 'SECO_ABARROTE' },
  { label: 'No Alimentario (Higiene, Útiles, Ropa)', value: 'NO_ALIMENTARIO' },
];

const DONOR_OPTIONS = [
  'Cuadritos Biotek',
  'Campo Bajío',
  'Donación Central',
  'Walmart',
  'Central de Abasto Celaya',
  'Productores Unidos del Bajío',
  'Soriana',
];

const UNIT_OPTIONS: { label: string; value: UnitType }[] = [
  { label: 'Piezas (pzas)', value: 'piezas' },
  { label: 'Kilos (kg)', value: 'kilos' },
  { label: 'Litros (L)', value: 'litros' },
  { label: 'Cajas (cj)', value: 'cajas' },
];

const STORAGE_OPTIONS: { label: string; value: StorageArea }[] = [
  { label: 'Cámara Fría (Refrigerado)', value: 'Camara_Fria' },
  { label: 'Nave de Secos (Temperatura ambiente)', value: 'Nave_Secos' },
  { label: 'Andén de Perecederos (Tránsito rápido)', value: 'Anden' },
];

export const QuickProductModal: React.FC<QuickProductModalProps> = ({
  isOpen,
  onClose,
  scannedBarcode,
  suggestedName = '',
  onProductCreated,
}) => {
  const [barcode, setBarcode] = useState(scannedBarcode || '');
  const [name, setName] = useState(suggestedName);
  const [donorType, setDonorType] = useState('Cuadritos Biotek');
  const [customDonor, setCustomDonor] = useState('');
  const [isCustomDonor, setIsCustomDonor] = useState(false);
  const [category, setCategory] = useState<ProductCategory>('LACTEO_FRIO');
  const [unit, setUnit] = useState<UnitType>('piezas');
  const [storageArea, setStorageArea] = useState<StorageArea>('Camara_Fria');
  const [minStock, setMinStock] = useState('50');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or scanned barcode changes
  useEffect(() => {
    if (isOpen) {
      setBarcode(scannedBarcode || '');
      setName(suggestedName);
      setErrorMessage(null);

      // Smart defaults based on suggested name or default donor
      if (suggestedName.toLowerCase().includes('brócoli') ||
          suggestedName.toLowerCase().includes('zanahoria') ||
          suggestedName.toLowerCase().includes('jitomate') ||
          suggestedName.toLowerCase().includes('lechuga')) {
        setDonorType('Campo Bajío');
        setCategory('AGRICOLA_PERECEDERO');
        setUnit(suggestedName.toLowerCase().includes('lechuga') ? 'piezas' : 'kilos');
        setStorageArea('Anden');
      } else {
        setDonorType('Cuadritos Biotek');
        setCategory('LACTEO_FRIO');
        setUnit('litros');
        setStorageArea('Camara_Fria');
      }
    }
  }, [isOpen, scannedBarcode, suggestedName]);

  // Suggest storage area & unit when category changes
  const handleCategoryChange = (newCat: ProductCategory) => {
    setCategory(newCat);
    if (newCat === 'LACTEO_FRIO') {
      setStorageArea('Camara_Fria');
      setUnit('litros');
      setDonorType('Cuadritos Biotek');
    } else if (newCat === 'AGRICOLA_PERECEDERO') {
      setStorageArea('Anden');
      setUnit('kilos');
      setDonorType('Campo Bajío');
    } else if (newCat === 'SECO_ABARROTE') {
      setStorageArea('Nave_Secos');
      setUnit('kilos');
      setDonorType('Donación Central');
    } else if (newCat === 'NO_ALIMENTARIO') {
      setStorageArea('Nave_Secos');
      setUnit('piezas');
      setDonorType('Donación Central');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanBarcode = barcode.trim();
    const cleanName = name.trim();
    const finalDonor = (isCustomDonor ? customDonor : donorType).trim();

    if (!cleanBarcode) {
      setErrorMessage('El código de barras es obligatorio.');
      return;
    }
    if (!cleanName) {
      setErrorMessage('El nombre del producto es obligatorio.');
      return;
    }
    if (!finalDonor) {
      setErrorMessage('Debe especificar el donante o procedencia.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: cleanBarcode,
          name: cleanName,
          donorType: finalDonor,
          category,
          unit,
          storageArea,
          minStock: Number(minStock) || 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al registrar el producto en el catálogo.');
      }

      const createdProduct: Product = await res.json();
      onProductCreated(createdProduct);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión al guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={!scannedBarcode ? 'Alta de Producto Inexistente en Catálogo' : 'Registrar Producto Nuevo'}
      description={
        !scannedBarcode
          ? 'Registre un artículo inexistente en el catálogo de CEDIS Celaya asignando un código o generando uno interno.'
          : 'El código escaneado no existe aún en el catálogo de CEDIS Celaya. Regístrelo en un instante para continuar la recepción.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Barcode & Product Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Código de Barras
              </label>
              {!scannedBarcode && (
                <button
                  type="button"
                  onClick={() => setBarcode(generateInternalBarcode())}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-fnvac-blue-700 hover:text-fnvac-blue-800 hover:underline cursor-pointer active:scale-95 transition-all"
                  title="Generar código interno automático"
                >
                  <Sparkles className="w-3 h-3 text-fnvac-blue-600" />
                  <span>Generar código interno</span>
                </button>
              )}
            </div>
            <input
              type="text"
              required
              autoFocus={!scannedBarcode}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 text-slate-800"
              placeholder={!scannedBarcode ? 'Escriba o genere código' : 'Código EAN/UPC'}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del Producto *
            </label>
            <input
              type="text"
              required
              autoFocus={Boolean(scannedBarcode)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Leche Entera UHT 1L, Jitomate Bola..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 text-slate-900"
            />
          </div>
        </div>

        {/* Category & Donor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Categoría del Alimento *
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-800"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Donante / Aliado Estratégico *
            </label>
            {!isCustomDonor ? (
              <div className="space-y-1">
                <select
                  value={donorType}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomDonor(true);
                    } else {
                      setDonorType(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-800"
                >
                  {DONOR_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__custom__">+ Otro donante personalizado...</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={customDonor}
                  onChange={(e) => setCustomDonor(e.target.value)}
                  placeholder="Escriba nombre del donante"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setIsCustomDonor(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Lista
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Unit, Storage Area & Min Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-slate-500" />
              Unidad de Medida
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitType)}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-800"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Área de Almacén Sugerida
            </label>
            <select
              value={storageArea}
              onChange={(e) => setStorageArea(e.target.value as StorageArea)}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white text-slate-800"
            >
              {STORAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Stock Mínimo Sugerido
            </label>
            <input
              type="number"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 text-slate-800"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-fnvac-blue-600 hover:bg-fnvac-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSubmitting ? 'Registrando...' : 'Guardar y Continuar Recepción'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default QuickProductModal;
