'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Barcode,
  Package,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  PlusCircle,
  Volume2,
  VolumeX,
  Search,
  Check,
  Building2,
  Edit3,
  Trash2,
  Loader2,
  Save,
  CopyPlus,
} from 'lucide-react';
import BarcodeScanner from '../../components/BarcodeScanner.tsx';
import QuickProductModal from '../../components/QuickProductModal.tsx';
import CatalogSearchModal from '../../components/CatalogSearchModal.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import Modal from '../../components/Modal.tsx';
import { calculateDaysRemaining, getFEFOStatus } from '../../lib/fefo.ts';
import { saveRecentProductToStorage } from '../../lib/recent-products.ts';
import type { Product, StorageArea, InventoryBatch, FEFOStatus } from '../../types/index';

// Helper: Formats relative date to YYYY-MM-DD
function getRelativeDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: Generate default lot code `LOT-${YYYYMMDD}-${random4}`
function generateLotCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOT-${y}${m}${d}-${rand}`;
}

// Helper: Check if date string is in the past
function checkIsExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return false;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

// Web Audio API Beep Synthesizers
function playBeep(type: 'success' | 'warning' | 'scan') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'scan') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'warning') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (err) {
    console.warn('Audio feedback unavailable:', err);
  }
}

export default function RecepcionPage() {
  // Sound enabled preference
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanner & Product lookup state
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState<string | null>(null);
  const [suggestedProductName, setSuggestedProductName] = useState<string>('');
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  // Form State
  const [lotCode, setLotCode] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [storageArea, setStorageArea] = useState<StorageArea>('Camara_Fria');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Expired Date Modal & Warning Banner
  const [showExpiredWarningModal, setShowExpiredWarningModal] = useState(false);

  // Duplicate Lot Collision Modal State (WMS Lot Consolidation)
  const [duplicateCollisionModal, setDuplicateCollisionModal] = useState<{
    existingBatch: InventoryBatch & { product?: Product };
    incomingQuantity: number;
    incomingExpirationDate: string;
  } | null>(null);
  const [isResolvingCollision, setIsResolvingCollision] = useState(false);

  // Feedback State
  const [successBanner, setSuccessBanner] = useState<{
    productName: string;
    lotCode: string;
    quantity: number;
    unit: string;
    status: FEFOStatus;
    warning?: string;
    consolidated?: boolean;
    totalQuantity?: number;
    previousQuantity?: number;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Recent batches in shift
  const [recentBatches, setRecentBatches] = useState<InventoryBatch[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  // State for editing recent batches
  const [editingRecentBatch, setEditingRecentBatch] = useState<InventoryBatch | null>(null);
  const [editLotCode, setEditLotCode] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<number | string>('');
  const [editExpirationDate, setEditExpirationDate] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // State for deleting recent batches
  const [deletingRecentBatch, setDeletingRecentBatch] = useState<InventoryBatch | null>(null);
  const [isDeletingRecent, setIsDeletingRecent] = useState(false);
  const [deleteRecentError, setDeleteRecentError] = useState<string | null>(null);

  // Notification message
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  // Manual search catalog modal
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);

  // Focus ref for quantity input
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent batches on mount
  const fetchRecentBatches = useCallback(async () => {
    try {
      setIsLoadingRecent(true);
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.batches)) {
          // Sort by receivedAt descending and take top 10
          const sorted = [...data.batches].sort((a, b) => {
            const dateA = new Date(a.receivedAt || 0).getTime();
            const dateB = new Date(b.receivedAt || 0).getTime();
            return dateB - dateA;
          });
          setRecentBatches(sorted.slice(0, 10));
        }
      }
    } catch (err) {
      console.warn('Error fetching recent batches:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentBatches();
  }, [fetchRecentBatches]);

  // Handlers for editing recent batch
  const handleOpenEditRecentBatch = (batch: InventoryBatch) => {
    setEditingRecentBatch(batch);
    setEditLotCode(batch.lotCode);
    setEditQuantity(batch.currentQuantity);
    setEditExpirationDate(batch.expirationDate);
    setEditError(null);
  };

  const handleCloseEditRecentBatch = () => {
    if (isSavingEdit) return;
    setEditingRecentBatch(null);
    setEditError(null);
  };

  const handleSaveEditRecentBatch = async () => {
    if (!editingRecentBatch) return;

    const trimmedLot = editLotCode.trim();
    if (!trimmedLot) {
      setEditError('El código de lote es obligatorio.');
      return;
    }

    const qty = Number(editQuantity);
    if (isNaN(qty) || qty < 0) {
      setEditError('La cantidad actual debe ser un número mayor o igual a 0');
      return;
    }

    if (!editExpirationDate) {
      setEditError('Debe ingresar la fecha de caducidad.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      const res = await fetch(`/api/inventory/${editingRecentBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotCode: trimmedLot,
          currentQuantity: qty,
          expirationDate: editExpirationDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el lote');
      }

      if (soundEnabled) {
        playBeep('success');
      }

      setEditingRecentBatch(null);
      await fetchRecentBatches();
      setNotificationMessage('Entrada actualizada correctamente');
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar el lote');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handlers for deleting recent batch
  const handleOpenDeleteRecentBatch = (batch: InventoryBatch) => {
    setDeletingRecentBatch(batch);
    setDeleteRecentError(null);
  };

  const handleCloseDeleteRecentBatch = () => {
    if (isDeletingRecent) return;
    setDeletingRecentBatch(null);
    setDeleteRecentError(null);
  };

  const handleConfirmDeleteRecentBatch = async () => {
    if (!deletingRecentBatch) return;

    try {
      setIsDeletingRecent(true);
      setDeleteRecentError(null);

      const res = await fetch(`/api/inventory/${deletingRecentBatch.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el lote');
      }

      if (soundEnabled) {
        playBeep('success');
      }

      setDeletingRecentBatch(null);
      await fetchRecentBatches();
      setNotificationMessage('Entrada eliminada correctamente');
    } catch (err: any) {
      setDeleteRecentError(err.message || 'Error al eliminar el lote');
    } finally {
      setIsDeletingRecent(false);
    }
  };

  // Handle scanned barcode
  const handleScanBarcode = async (barcode: string, suggestedName?: string) => {
    if (!barcode) return;
    setFormError(null);
    setSuccessBanner(null);

    if (soundEnabled) {
      playBeep('scan');
    }

    try {
      setIsSearchingProduct(true);
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
      if (!res.ok) {
        throw new Error(`Error al consultar catálogo (${res.status})`);
      }

      const products: Product[] = await res.json();
      if (products && products.length > 0) {
        // Product exists in catalog
        const prod = products[0];
        saveRecentProductToStorage(prod);
        selectProductForReception(prod);
      } else {
        // Product not found in catalog -> Prompt Quick Registration
        setBarcodeNotFound(barcode);
        setSuggestedProductName(suggestedName || '');
        setIsQuickModalOpen(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al verificar el código de barras en el catálogo.');
    } finally {
      setIsSearchingProduct(false);
    }
  };

  // Helper: Prepare form for a selected product
  const selectProductForReception = (prod: Product) => {
    setSelectedProduct(prod);
    setBarcodeNotFound(null);
    setLotCode(generateLotCode());
    setExpirationDate(getRelativeDate(7)); // default +7 days (Attention)
    setStorageArea(prod.storageArea || 'Camara_Fria');
    setQuantity('');
    saveRecentProductToStorage(prod);

    // Auto-focus quantity input after selection
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 150);
  };

  // Open modal for manual registration of an uncataloged / non-existent product
  const handleOpenNewProductModal = () => {
    setBarcodeNotFound(null);
    setSuggestedProductName('');
    setIsQuickModalOpen(true);
  };

  // Quick Product Registration callback
  const handleProductCreated = (newProd: Product) => {
    setIsQuickModalOpen(false);
    selectProductForReception(newProd);
    if (soundEnabled) {
      playBeep('success');
    }
  };

  // Quick Expiration Date Short-cut handler
  const handleQuickExpiration = (days: number) => {
    setExpirationDate(getRelativeDate(days));
  };

  // Live FEFO Status calculation for preview
  const isDateExpired = checkIsExpired(expirationDate);
  const liveDaysRemaining = expirationDate ? calculateDaysRemaining(expirationDate) : 0;
  const liveFEFOStatus = expirationDate
    ? getFEFOStatus(liveDaysRemaining, Number(quantity) || 1)
    : 'ESTABLE';

  // Handlers for duplicate lot collision modal
  const handleConfirmConsolidate = async () => {
    if (!duplicateCollisionModal || !selectedProduct) return;
    try {
      setIsResolvingCollision(true);
      setFormError(null);

      const payload = {
        productId: selectedProduct.id,
        lotCode: duplicateCollisionModal.existingBatch.lotCode,
        expirationDate: duplicateCollisionModal.incomingExpirationDate,
        currentQuantity: duplicateCollisionModal.incomingQuantity,
        action: 'consolidate',
        updateExpirationStrategy: 'earliest',
      };

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al consolidar existencias.');
      }

      if (soundEnabled) {
        playBeep('success');
      }

      setSuccessBanner({
        productName: selectedProduct.name,
        lotCode: duplicateCollisionModal.existingBatch.lotCode,
        quantity: duplicateCollisionModal.incomingQuantity,
        unit: selectedProduct.unit,
        status: data.status || liveFEFOStatus,
        warning: data.warning,
        consolidated: true,
        totalQuantity: data.currentQuantity,
        previousQuantity: data.previousQuantity,
      });

      setRecentBatches((prev) => {
        const exists = prev.some((b) => b.id === data.id);
        if (exists) {
          return prev.map((b) =>
            b.id === data.id ? { ...b, ...data, product: selectedProduct } : b
          );
        }
        return [{ ...data, product: selectedProduct }, ...prev.slice(0, 9)];
      });
      fetchRecentBatches();
      saveRecentProductToStorage(selectedProduct);

      // Reset
      setDuplicateCollisionModal(null);
      setSelectedProduct(null);
      setLotCode('');
      setExpirationDate('');
      setQuantity('');
    } catch (err: any) {
      setFormError(err.message || 'Error al consolidar el lote.');
    } finally {
      setIsResolvingCollision(false);
    }
  };

  const handleConfirmCreateSeparate = async () => {
    if (!duplicateCollisionModal || !selectedProduct) return;
    try {
      setIsResolvingCollision(true);
      setFormError(null);

      const payload = {
        productId: selectedProduct.id,
        lotCode: duplicateCollisionModal.existingBatch.lotCode,
        expirationDate: duplicateCollisionModal.incomingExpirationDate,
        currentQuantity: duplicateCollisionModal.incomingQuantity,
        action: 'create_new',
      };

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar lote separado.');
      }

      if (soundEnabled) {
        playBeep('success');
      }

      setSuccessBanner({
        productName: selectedProduct.name,
        lotCode: duplicateCollisionModal.existingBatch.lotCode,
        quantity: duplicateCollisionModal.incomingQuantity,
        unit: selectedProduct.unit,
        status: data.status || liveFEFOStatus,
        warning: data.warning || 'Registrado como lote separado con folio duplicado',
        consolidated: false,
      });

      const newBatchRecord: InventoryBatch = {
        id: data.id || crypto.randomUUID(),
        productId: selectedProduct.id,
        lotCode: duplicateCollisionModal.existingBatch.lotCode,
        expirationDate: duplicateCollisionModal.incomingExpirationDate,
        currentQuantity: duplicateCollisionModal.incomingQuantity,
        receivedAt: new Date().toISOString(),
        daysRemaining: data.daysRemaining,
        status: data.status,
        product: selectedProduct,
      };
      setRecentBatches((prev) => [newBatchRecord, ...prev.slice(0, 9)]);
      fetchRecentBatches();
      saveRecentProductToStorage(selectedProduct);

      // Reset
      setDuplicateCollisionModal(null);
      setSelectedProduct(null);
      setLotCode('');
      setExpirationDate('');
      setQuantity('');
    } catch (err: any) {
      setFormError(err.message || 'Error al crear lote separado.');
    } finally {
      setIsResolvingCollision(false);
    }
  };

  const handleCancelCollision = () => {
    if (isResolvingCollision) return;
    setDuplicateCollisionModal(null);
  };

  // Submit Batch Entry
  const handleSubmitBatch = async (e?: React.FormEvent, forceAllowExpired = false) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!selectedProduct) {
      setFormError('Primero debe escanear o seleccionar un producto del catálogo.');
      return;
    }

    const cleanLot = lotCode.trim();
    if (!cleanLot) {
      setFormError('El código de lote es obligatorio.');
      return;
    }

    if (!expirationDate) {
      setFormError('Debe ingresar la fecha de caducidad del lote.');
      return;
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('La cantidad recibida debe ser un número mayor a 0.');
      return;
    }

    // Expiration date validation: if in past and not explicitly confirmed
    if (isDateExpired && !forceAllowExpired) {
      if (soundEnabled) {
        playBeep('warning');
      }
      setShowExpiredWarningModal(true);
      return;
    }

    try {
      setIsSubmittingBatch(true);
      const payload = {
        productId: selectedProduct.id,
        lotCode: cleanLot,
        expirationDate,
        currentQuantity: qty,
        forceReject: false, // Allows recording as intake with merma warning if expired
      };

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Check for duplicate lot collision (HTTP 409)
      if (res.status === 409 || data.duplicateDetected) {
        if (soundEnabled) {
          playBeep('warning');
        }
        setDuplicateCollisionModal({
          existingBatch: data.existingBatch,
          incomingQuantity: qty,
          incomingExpirationDate: expirationDate,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la entrada de inventario.');
      }

      // Play positive audio tone
      if (soundEnabled) {
        playBeep('success');
      }

      // Success notification
      if (data.consolidated) {
        setSuccessBanner({
          productName: selectedProduct.name,
          lotCode: cleanLot,
          quantity: qty,
          unit: selectedProduct.unit,
          status: data.status || liveFEFOStatus,
          warning: data.warning,
          consolidated: true,
          totalQuantity: data.currentQuantity,
          previousQuantity: data.previousQuantity,
        });
        setRecentBatches((prev) => {
          const exists = prev.some((b) => b.id === data.id);
          if (exists) {
            return prev.map((b) =>
              b.id === data.id ? { ...b, ...data, product: selectedProduct } : b
            );
          }
          return [{ ...data, product: selectedProduct }, ...prev.slice(0, 9)];
        });
        fetchRecentBatches();
      } else {
        setSuccessBanner({
          productName: selectedProduct.name,
          lotCode: cleanLot,
          quantity: qty,
          unit: selectedProduct.unit,
          status: data.status || liveFEFOStatus,
          warning: data.warning,
          consolidated: false,
        });
        const newBatchRecord: InventoryBatch = {
          id: data.id || crypto.randomUUID(),
          productId: selectedProduct.id,
          lotCode: cleanLot,
          expirationDate,
          currentQuantity: qty,
          receivedAt: new Date().toISOString(),
          daysRemaining: data.daysRemaining !== undefined ? data.daysRemaining : liveDaysRemaining,
          status: data.status || liveFEFOStatus,
          product: selectedProduct,
        };
        setRecentBatches((prev) => [newBatchRecord, ...prev.slice(0, 9)]);
      }

      // Save to recent products storage
      saveRecentProductToStorage(selectedProduct);

      // Reset form and prepare for next scan
      setSelectedProduct(null);
      setLotCode('');
      setExpirationDate('');
      setQuantity('');
      setShowExpiredWarningModal(false);
      setDuplicateCollisionModal(null);
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión al registrar el lote.');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-fnvac-blue-800 uppercase tracking-wider mb-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:underline text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Inventario</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span>Andén de Entrada &bull; CEDIS Celaya</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Módulo de Recepción y Control de Entrada</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registro de donaciones perecederas y abarrotes con semáforo FEFO instantáneo y códigos de barras.
          </p>
        </div>

        {/* Action controls: Sound Toggle, Manual Catalog Search & Register Product */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              soundEnabled
                ? 'bg-fnvac-blue-50 text-fnvac-blue-800 border-fnvac-blue-200 hover:bg-fnvac-blue-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-fnvac-blue-600" />
                <span>Audio Activado</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Silenciado</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCatalogSearchOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Buscar en Catálogo</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewProductModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-fnvac-blue-800 bg-fnvac-blue-100/90 hover:bg-fnvac-blue-200 border border-fnvac-blue-300 shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
          >
            <PlusCircle className="w-4 h-4 text-fnvac-blue-700" />
            <span>+ Registrar producto inexistente</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        successBanner.consolidated ? (
          <div className="rounded-2xl bg-fnvac-blue-50 border-2 border-fnvac-blue-500/40 p-4 shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-fnvac-blue-600 text-white flex-shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-base text-fnvac-blue-950">
                    ¡Lote Consolidado en Bodega!
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-fnvac-blue-200 text-fnvac-blue-900 border border-fnvac-blue-300">
                    WMS FEFO
                  </span>
                </div>
                <p className="text-xs text-fnvac-blue-900 mt-1">
                  Se sumaron <span className="font-bold text-fnvac-blue-950">{successBanner.quantity} {successBanner.unit}</span> al lote{' '}
                  <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-fnvac-blue-300 text-fnvac-blue-950">
                    {successBanner.lotCode}
                  </span>{' '}
                  de <span className="font-bold">{successBanner.productName}</span>.
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs">
                  <span className="bg-white/90 border border-fnvac-blue-200 px-2.5 py-1 rounded-lg text-fnvac-blue-900">
                    Existencia previa: <span className="font-semibold">{successBanner.previousQuantity ?? 0} {successBanner.unit}</span>
                  </span>
                  <span className="text-fnvac-blue-500 font-bold">+</span>
                  <span className="bg-white/90 border border-fnvac-blue-200 px-2.5 py-1 rounded-lg text-fnvac-blue-900">
                    Entrada: <span className="font-semibold text-fnvac-blue-700">+{successBanner.quantity} {successBanner.unit}</span>
                  </span>
                  <span className="text-fnvac-blue-500 font-bold">=</span>
                  <span className="bg-fnvac-blue-600 text-white font-bold px-2.5 py-1 rounded-lg shadow-2xs">
                    Existencia total en bodega: {successBanner.totalQuantity ?? ((successBanner.previousQuantity || 0) + successBanner.quantity)} {successBanner.unit}
                  </span>
                </div>
                {successBanner.warning && (
                  <p className="text-xs text-amber-800 font-semibold mt-2 bg-amber-100/60 p-1.5 rounded inline-block">
                    ⚠️ {successBanner.warning}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={successBanner.status} size="sm" showDays={false} />
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                className="text-xs text-fnvac-blue-700 hover:text-fnvac-blue-900 font-semibold p-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-fnvac-blue-50 border border-fnvac-blue-200 p-4 shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-fnvac-blue-600 text-white flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-fnvac-blue-950">
                  ¡Lote Recepcionado y Registrado con Éxito!
                </p>
                <p className="text-xs text-fnvac-blue-800 mt-0.5">
                  Ingresaron <span className="font-bold">{successBanner.quantity} {successBanner.unit}</span> de{' '}
                  <span className="font-bold">{successBanner.productName}</span> bajo el folio{' '}
                  <span className="font-mono font-semibold bg-fnvac-blue-100/80 px-1 rounded">{successBanner.lotCode}</span>.
                </p>
                {successBanner.warning && (
                  <p className="text-xs text-amber-800 font-semibold mt-1 bg-amber-100/60 p-1 rounded inline-block">
                    ⚠️ {successBanner.warning}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={successBanner.status} size="sm" showDays={false} />
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                className="text-xs text-fnvac-blue-700 hover:text-fnvac-blue-900 font-semibold p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )
      )}

      {/* Notification Message Banner */}
      {notificationMessage && (
        <div className="rounded-2xl bg-fnvac-blue-50 border border-fnvac-blue-200 p-4 shadow-sm flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-fnvac-blue-600 text-white flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-fnvac-blue-950">{notificationMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationMessage(null)}
            className="text-xs text-fnvac-blue-700 hover:text-fnvac-blue-900 font-semibold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {formError && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Error en la recepción</p>
            <p className="mt-0.5">{formError}</p>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-xs text-red-700 hover:text-red-900 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Reception Grid: Scanner (Left) + Form Details (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Barcode Scanner */}
        <div className="lg:col-span-5 space-y-4">
          <BarcodeScanner
            onScan={handleScanBarcode}
            isLoading={isSearchingProduct}
            onAddNewProduct={handleOpenNewProductModal}
          />

          {/* Quick Help Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-fnvac-blue-600" />
              <span>Instrucciones Operativas de Andén</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>Pase los productos frente al lector láser continuo.</li>
              <li>Si no tiene código de barras, use los atajos de hortalizas a granel.</li>
              <li>Si el producto es nuevo, se abrirá el modal de alta rápida de 10 segundos.</li>
              <li>Verifique la temperatura recomendada antes de asignar el área.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Reception Form or Empty State */}
        <div className="lg:col-span-7">
          {selectedProduct ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-5 p-6">
              {/* Product Card Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Producto Identificado
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedProduct.name}
                    </h2>
                    <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{selectedProduct.barcode}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors"
                  >
                    Cambiar Producto
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/80 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fnvac-blue-100 text-fnvac-blue-800 font-semibold">
                    <Building2 className="w-3 h-3" />
                    <span>Donante: {selectedProduct.donorType}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    <Layers className="w-3 h-3" />
                    <span>Categoría: {selectedProduct.category.replace('_', ' ')}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-semibold">
                    <MapPin className="w-3 h-3" />
                    <span>Área Sugerida: {selectedProduct.storageArea.replace('_', ' ')}</span>
                  </span>
                </div>
              </div>

              {/* Batch Entry Form */}
              <form onSubmit={(e) => handleSubmitBatch(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Lot Code Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Código de Lote *
                      </label>
                      <button
                        type="button"
                        onClick={() => setLotCode(generateLotCode())}
                        className="text-[11px] text-fnvac-blue-700 hover:underline flex items-center gap-1"
                        title="Generar nuevo código de lote CEDIS"
                      >
                        <RotateCcw className="w-3 h-3" /> Regenerar
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={lotCode}
                      onChange={(e) => setLotCode(e.target.value)}
                      placeholder="LOT-20260917-XXXX"
                      className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Código del proveedor o folio autogenerado.
                    </p>
                  </div>

                  {/* Quantity & Unit Indicator */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cantidad Recibida ({selectedProduct.unit}) *
                    </label>
                    <div className="relative">
                      <input
                        ref={quantityInputRef}
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-3 pr-20 py-2 text-base font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedProduct.unit}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Total verificado físicamente en la báscula o tarima.
                    </p>
                  </div>
                </div>

                {/* Expiration Date Section */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-fnvac-blue-700" />
                      <span>Fecha de Caducidad Formal *</span>
                    </label>

                    {/* Live FEFO Status Indicator */}
                    {expirationDate && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Semáforo Previsto:</span>
                        <StatusBadge
                          status={isDateExpired ? 'AGOTADO' : liveFEFOStatus}
                          daysRemaining={liveDaysRemaining}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5">
                      <input
                        type="date"
                        required
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className={`w-full px-3 py-2 text-sm font-semibold rounded-lg border focus:outline-none focus:ring-2 ${
                          isDateExpired
                            ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500'
                            : 'border-slate-300 bg-white text-slate-900 focus:ring-fnvac-blue-500'
                        }`}
                      />
                    </div>

                    {/* Quick Expiration Shortcuts */}
                    <div className="sm:col-span-7 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickExpiration(3)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 transition-colors"
                        title="Caduca en 3 días (Alta prioridad)"
                      >
                        +3 días (Crítico)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickExpiration(7)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 transition-colors"
                        title="Caduca en 7 días (Atención)"
                      >
                        +7 días (Atención)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickExpiration(15)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        +15 días
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickExpiration(30)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-fnvac-blue-100 hover:bg-fnvac-blue-200 text-fnvac-blue-800 border border-fnvac-blue-200 transition-colors"
                      >
                        +30 días
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickExpiration(180)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 transition-colors"
                      >
                        +180 días
                      </button>
                    </div>
                  </div>

                  {/* Expired Warning Banner */}
                  {isDateExpired && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-100 border border-red-300 text-red-900 text-xs animate-shake">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold">¡Alerta de Caducidad! </span>
                        <span>
                          La fecha ingresada ya venció ({Math.abs(liveDaysRemaining)} días en el pasado).
                          Clasificar como merma de rechazo o corregir fecha antes de almacenar.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Storage Area Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Área de Almacén Destino</span>
                  </label>
                  <select
                    value={storageArea}
                    onChange={(e) => setStorageArea(e.target.value as StorageArea)}
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 bg-white text-slate-800"
                  >
                    <option value="Camara_Fria">Cámara Fría (Refrigeración 2°C - 4°C)</option>
                    <option value="Nave_Secos">Nave de Secos (Temperatura ambiente controlada)</option>
                    <option value="Anden">Andén de Perecederos (Tránsito y despacho rápido)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Por defecto se asigna el área sugerida del producto. Puede reubicarlo si la cámara está llena.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingBatch}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-fnvac-blue-700 hover:bg-fnvac-blue-800 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 disabled:opacity-50"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span>
                      {isSubmittingBatch
                        ? 'Registrando Entrada...'
                        : 'Registrar Entrada de Lote'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Empty State: Awaiting Scan */
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[380px] space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-fnvac-blue-50 text-fnvac-blue-700 flex items-center justify-center">
                <Barcode className="w-8 h-8" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-base font-bold text-slate-800">
                  Esperando Lectura de Código de Barras
                </h3>
                <p className="text-xs text-slate-500">
                  Escanee un empaque con la pistola USB, active la cámara de su dispositivo o elija una de las hortalizas a granel.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expiration Warning Modal (If date is in past on submit) */}
      {showExpiredWarningModal && (
        <Modal
          isOpen={showExpiredWarningModal}
          onClose={() => setShowExpiredWarningModal(false)}
          title="¡Alerta de Caducidad de Lote!"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm">La fecha ingresada ya venció</p>
                <p>
                  El lote tiene fecha de caducidad <span className="font-bold">{expirationDate}</span>, la cual ya venció hace{' '}
                  <span className="font-bold">{Math.abs(liveDaysRemaining)} días</span>.
                </p>
                <p className="text-red-700 font-semibold">
                  Clasificar como merma de rechazo o corregir fecha.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExpiredWarningModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Corregir Fecha
              </button>
              <button
                type="button"
                onClick={() => handleSubmitBatch(undefined, true)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors"
              >
                Registrar como Merma de Rechazo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate Lot Collision Modal */}
      {duplicateCollisionModal && (
        <Modal
          isOpen={!!duplicateCollisionModal}
          onClose={handleCancelCollision}
          title="Lote Existente Detectado en Almacén"
          maxWidth="lg"
        >
          <div className="space-y-4 text-left">
            {/* Warning header explaining collision */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-amber-950">
                  Ya existe un lote registrado con el código &quot;{duplicateCollisionModal.existingBatch.lotCode}&quot;
                </p>
                <p className="text-amber-800">
                  El producto <span className="font-bold">{selectedProduct?.name}</span> ya cuenta con existencias bajo este mismo folio en CEDIS Celaya.
                  De acuerdo con la norma operativa WMS y rotación FEFO, se recomienda consolidar las existencias en una sola partida para facilitar el control de tarima.
                </p>
              </div>
            </div>

            {/* Comparison card (Existencia Actual vs Nueva Entrada vs Total Proyectado) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Análisis de Existencias y FEFO</span>
                <span className="font-mono text-slate-500">
                  Lote: {duplicateCollisionModal.existingBatch.lotCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Current Stock */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Existencia Actual
                  </span>
                  <div className="text-lg font-extrabold text-slate-800 mt-1">
                    {duplicateCollisionModal.existingBatch.currentQuantity}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      {selectedProduct?.unit || 'uds'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Vence: {duplicateCollisionModal.existingBatch.expirationDate}</span>
                  </div>
                </div>

                {/* Incoming Batch */}
                <div className="bg-fnvac-blue-50/70 border border-fnvac-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-fnvac-blue-700 block tracking-wider">
                    Nueva Entrada
                  </span>
                  <div className="text-lg font-extrabold text-fnvac-blue-700 mt-1">
                    +{duplicateCollisionModal.incomingQuantity}{' '}
                    <span className="text-xs font-normal text-fnvac-blue-600">
                      {selectedProduct?.unit || 'uds'}
                    </span>
                  </div>
                  <div className="text-[11px] text-fnvac-blue-800 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3 text-fnvac-blue-600" />
                    <span>Vence: {duplicateCollisionModal.incomingExpirationDate}</span>
                  </div>
                </div>

                {/* Total Projected */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                    Total Proyectado
                  </span>
                  <div className="text-lg font-extrabold text-blue-800 mt-1">
                    {duplicateCollisionModal.existingBatch.currentQuantity + duplicateCollisionModal.incomingQuantity}{' '}
                    <span className="text-xs font-normal text-blue-600">
                      {selectedProduct?.unit || 'uds'}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 mt-1 flex items-center justify-center gap-1">
                    <span>
                      Caducidad FEFO:{' '}
                      {duplicateCollisionModal.existingBatch.expirationDate <= duplicateCollisionModal.incomingExpirationDate
                        ? duplicateCollisionModal.existingBatch.expirationDate
                        : duplicateCollisionModal.incomingExpirationDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Projected FEFO Status */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                <span className="text-slate-600 font-medium">Semáforo FEFO tras consolidación:</span>
                <StatusBadge
                  status={getFEFOStatus(
                    calculateDaysRemaining(
                      duplicateCollisionModal.existingBatch.expirationDate <= duplicateCollisionModal.incomingExpirationDate
                        ? duplicateCollisionModal.existingBatch.expirationDate
                        : duplicateCollisionModal.incomingExpirationDate
                    ),
                    duplicateCollisionModal.existingBatch.currentQuantity + duplicateCollisionModal.incomingQuantity
                  )}
                  daysRemaining={calculateDaysRemaining(
                    duplicateCollisionModal.existingBatch.expirationDate <= duplicateCollisionModal.incomingExpirationDate
                      ? duplicateCollisionModal.existingBatch.expirationDate
                      : duplicateCollisionModal.incomingExpirationDate
                  )}
                  size="sm"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelCollision}
                disabled={isResolvingCollision}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-[0.98] cursor-pointer text-center disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar / Corregir Folio
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateSeparate}
                disabled={isResolvingCollision}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
              >
                {isResolvingCollision ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CopyPlus className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Crear como Lote Separado</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmConsolidate}
                disabled={isResolvingCollision}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-fnvac-blue-700 hover:bg-fnvac-blue-800 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
              >
                {isResolvingCollision ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                <span>Sumar al Lote Existente (Recomendado WMS)</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Product Registration Modal (When barcode not found) */}
      <QuickProductModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        scannedBarcode={barcodeNotFound || ''}
        suggestedName={suggestedProductName}
        onProductCreated={handleProductCreated}
      />

      {/* Dynamic Catalog Search Modal */}
      <CatalogSearchModal
        isOpen={isCatalogSearchOpen}
        onClose={() => setIsCatalogSearchOpen(false)}
        onSelectProduct={(prod) => {
          selectProductForReception(prod);
          setIsCatalogSearchOpen(false);
        }}
        onAddNewProduct={(suggestedName) => {
          setIsCatalogSearchOpen(false);
          setBarcodeNotFound(null);
          setSuggestedProductName(suggestedName || '');
          setIsQuickModalOpen(true);
        }}
        recentBatches={recentBatches}
      />

      {/* Bottom Table: "Últimas Recepciones del Turno" */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-fnvac-blue-100 text-fnvac-blue-800">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Últimas Recepciones del Turno
              </h3>
              <p className="text-xs text-slate-500">
                Lotes ingresados recientemente en CEDIS Celaya con semáforo FEFO asignado.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRecentBatches}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3 h-3" /> Actualizar
          </button>
        </div>

        {/* Recent Batches Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="py-2.5 px-3">Hora / Fecha</th>
                <th className="py-2.5 px-3">Producto &amp; Código</th>
                <th className="py-2.5 px-3">Lote</th>
                <th className="py-2.5 px-3 text-right">Cantidad</th>
                <th className="py-2.5 px-3">Caducidad</th>
                <th className="py-2.5 px-3">Semáforo FEFO</th>
                <th className="py-2.5 px-3">Área de Bodega</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {recentBatches.length > 0 ? (
                recentBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono">
                      {batch.receivedAt
                        ? new Date(batch.receivedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) +
                          ' ' +
                          new Date(batch.receivedAt).toLocaleDateString([], {
                            day: '2-digit',
                            month: 'short',
                          })
                        : 'Reciente'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div>{batch.product?.name || 'Producto'}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {batch.product?.barcode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {batch.lotCode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {batch.currentQuantity} {batch.product?.unit || 'uds'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                      {batch.expirationDate}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge
                        status={batch.status || 'ESTABLE'}
                        daysRemaining={batch.daysRemaining}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {batch.product?.storageArea
                          ? batch.product.storageArea.replace('_', ' ')
                          : 'Cámara Fría'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRecentBatch(batch)}
                          title="Editar entrada"
                          aria-label={`Editar entrada de lote ${batch.lotCode}`}
                          className="p-1.5 text-slate-500 hover:text-fnvac-blue-700 hover:bg-fnvac-blue-50 rounded-md transition-colors active:scale-95 cursor-pointer select-none"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteRecentBatch(batch)}
                          title="Eliminar entrada"
                          aria-label={`Eliminar entrada de lote ${batch.lotCode}`}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors active:scale-95 cursor-pointer select-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    {isLoadingRecent
                      ? 'Cargando recepciones...'
                      : 'No hay recepciones registradas en este turno.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Recent Batch Modal */}
      {editingRecentBatch && (
        <Modal
          isOpen={!!editingRecentBatch}
          onClose={handleCloseEditRecentBatch}
          title="Editar Entrada de Recepción"
          description="Modifica los datos del lote recibido recientemente."
          maxWidth="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEditRecentBatch();
            }}
            className="space-y-4 text-left"
          >
            {/* Product Summary Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Producto
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {editingRecentBatch.product?.name || 'Producto'}
                </p>
                <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                  <Barcode className="w-3 h-3" />
                  <span>{editingRecentBatch.product?.barcode || 'N/A'}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Unidad de Medida
                </span>
                <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-0.5">
                  {editingRecentBatch.product?.unit || 'uds'}
                </span>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lot Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código de Lote *
                </label>
                <input
                  type="text"
                  required
                  value={editLotCode}
                  onChange={(e) => setEditLotCode(e.target.value)}
                  placeholder="LOT-..."
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                />
              </div>

              {/* Current Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantidad Recibida ({editingRecentBatch.product?.unit || 'uds'}) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                />
              </div>

              {/* Expiration Date */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Fecha de Caducidad *
                  </label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '+3d', days: 3 },
                      { label: '+7d', days: 7 },
                      { label: '+15d', days: 15 },
                      { label: '+30d', days: 30 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setEditExpirationDate(getRelativeDate(btn.days))}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-fnvac-blue-100 hover:text-fnvac-blue-800 text-slate-600 rounded transition-colors cursor-pointer active:scale-95"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Live FEFO Status Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-500">Semáforo FEFO proyectado: </span>
                <span className="font-semibold text-slate-800">
                  {editExpirationDate
                    ? calculateDaysRemaining(editExpirationDate) >= 0
                      ? `${calculateDaysRemaining(editExpirationDate)} días restantes`
                      : `Vencido hace ${Math.abs(calculateDaysRemaining(editExpirationDate))} días`
                    : 'Sin fecha'}
                </span>
              </div>
              <StatusBadge
                status={
                  editExpirationDate
                    ? getFEFOStatus(calculateDaysRemaining(editExpirationDate), Number(editQuantity) || 0)
                    : 'ESTABLE'
                }
                daysRemaining={editExpirationDate ? calculateDaysRemaining(editExpirationDate) : 0}
                size="sm"
              />
            </div>

            {/* Error Message */}
            {editError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseEditRecentBatch}
                disabled={isSavingEdit}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-fnvac-blue-700 hover:bg-fnvac-blue-800 rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Recent Batch Modal */}
      {deletingRecentBatch && (
        <Modal
          isOpen={!!deletingRecentBatch}
          onClose={handleCloseDeleteRecentBatch}
          title="Eliminar Entrada de Recepción"
          description="¿Estás seguro de eliminar este registro del inventario?"
          maxWidth="md"
        >
          <div className="space-y-4 text-left">
            {/* Irreversible Action Warning */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-red-900">Atención: Esta acción es irreversible</p>
                <p>Atención: Esta acción es irreversible y descontará este registro del inventario.</p>
              </div>
            </div>

            {/* Batch Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-sm text-slate-900">
                {deletingRecentBatch.product?.name || 'Producto'}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                Código: {deletingRecentBatch.product?.barcode || 'N/A'}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-500 block">Lote:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                    {deletingRecentBatch.lotCode}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Cantidad:</span>
                  <span className="font-bold text-slate-900 mt-0.5 inline-block">
                    {deletingRecentBatch.currentQuantity}{' '}
                    <span className="font-normal text-slate-600">
                      {deletingRecentBatch.product?.unit || 'uds'}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Caducidad:</span>
                  <span className="font-medium text-slate-800 mt-0.5 inline-block">
                    {deletingRecentBatch.expirationDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Semáforo:</span>
                  <div className="mt-0.5">
                    <StatusBadge
                      status={deletingRecentBatch.status || 'ESTABLE'}
                      daysRemaining={deletingRecentBatch.daysRemaining}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Delete Error Alert */}
            {deleteRecentError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteRecentError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseDeleteRecentBatch}
                disabled={isDeletingRecent}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecentBatch}
                disabled={isDeletingRecent}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none"
              >
                {isDeletingRecent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
