'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ScanLine,
  Barcode,
  Camera,
  CameraOff,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  Trash2,
  RotateCcw,
  Package,
  Clock,
  Calendar,
  Sparkles,
  Layers,
  MapPin,
  Building2,
  Plus,
  Minus,
  Search,
  Check,
  X,
  RefreshCw,
  Loader2,
  CheckCheck,
  LogOut,
} from 'lucide-react';

import BarcodeScanner from '../../components/BarcodeScanner.tsx';
import QuickProductModal from '../../components/QuickProductModal.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import Modal from '../../components/Modal.tsx';
import { BULK_PRODUCE_SHORTCUTS, BulkProduceShortcut } from '../../lib/produce.ts';
import { calculateDaysRemaining, getFEFOStatus } from '../../lib/fefo.ts';
import { saveRecentProductToStorage } from '../../lib/recent-products.ts';
import type { Product, StorageArea, InventoryBatch, FEFOStatus, AuthSession } from '../../types/index';

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

// Web Audio API Beep Synthesizer
function playBeep(type: 'success' | 'warning' | 'scan') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      setTimeout(() => ctx.close().catch(() => {}), 300);
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
      setTimeout(() => ctx.close().catch(() => {}), 200);
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
      setTimeout(() => ctx.close().catch(() => {}), 400);
    }
  } catch (err) {
    console.warn('Audio feedback unavailable:', err);
  }
}

export default function OperadorPage() {
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Barcode input state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Selected product & quick creation
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [barcodeForModal, setBarcodeForModal] = useState('');
  const [suggestedNameForModal, setSuggestedNameForModal] = useState('');

  // Batch details form state
  const [lotCode, setLotCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [storageArea, setStorageArea] = useState<StorageArea>('Camara_Fria');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Expired date warning modal
  const [showExpiredWarningModal, setShowExpiredWarningModal] = useState(false);

  // Duplicate lot collision modal state (409)
  const [duplicateCollisionModal, setDuplicateCollisionModal] = useState<{
    existingBatch: InventoryBatch & { product?: Product };
    incomingQuantity: number;
    incomingExpirationDate: string;
  } | null>(null);
  const [isResolvingCollision, setIsResolvingCollision] = useState(false);

  // Success Feedback
  const [successBanner, setSuccessBanner] = useState<{
    productName: string;
    lotCode: string;
    quantity: number;
    unit: string;
    status: FEFOStatus;
    warning?: string;
    consolidated?: boolean;
    totalQuantity?: number;
  } | null>(null);

  // Shift registrations list & counter
  const [shiftBatches, setShiftBatches] = useState<InventoryBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [shiftCount, setShiftCount] = useState(0);

  // User Session state
  const [sessionUser, setSessionUser] = useState<AuthSession | null>(null);

  // Deleting / Undo batch modal
  const [deletingBatch, setDeletingBatch] = useState<InventoryBatch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Refs for auto-focus
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Fetch session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setSessionUser(data.user || null);
        } else {
          setSessionUser(null);
        }
      } catch {
        setSessionUser(null);
      }
    };
    fetchSession();
  }, []);

  // Handle operator logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      window.location.href = '/login';
    }
  };

  // Auto focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Fetch initial recent batches
  const fetchRecentBatches = useCallback(async () => {
    try {
      setIsLoadingBatches(true);
      const isOp = sessionUser?.role === 'operator';
      const url = isOp ? '/api/inventory?myShift=true' : '/api/inventory';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.batches)) {
          const sorted = [...data.batches].sort((a, b) => {
            const dateA = new Date(a.receivedAt || 0).getTime();
            const dateB = new Date(b.receivedAt || 0).getTime();
            return dateB - dateA;
          });
          setShiftBatches(sorted.slice(0, 15));
        }
      }
    } catch (err) {
      console.warn('Error al cargar registros recientes:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [sessionUser]);

  useEffect(() => {
    fetchRecentBatches();
  }, [fetchRecentBatches]);

  // Select Product and prepare form
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setLotCode(generateLotCode());
    setQuantity('1'); // Default starting tactile quantity
    setExpirationDate(getRelativeDate(7)); // Default +7 days
    setStorageArea(prod.storageArea || 'Camara_Fria');
    setFormError(null);
    setSuccessBanner(null);
    saveRecentProductToStorage(prod);

    // Focus quantity input for speed
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 150);
  };

  // Barcode lookup
  const handleScanBarcode = async (code: string, suggestedName?: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    if (soundEnabled) {
      playBeep('scan');
    }

    setFormError(null);
    setSuccessBanner(null);

    try {
      setIsSearchingProduct(true);
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(cleanCode)}`);
      if (!res.ok) {
        throw new Error(`Error en catálogo (${res.status})`);
      }

      const products: Product[] = await res.json();
      if (products && products.length > 0) {
        handleSelectProduct(products[0]);
        setBarcodeInput('');
      } else {
        // Product not registered yet: Open quick product modal
        setBarcodeForModal(cleanCode);
        setSuggestedNameForModal(suggestedName || '');
        setIsQuickModalOpen(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al buscar el código en el catálogo.');
    } finally {
      setIsSearchingProduct(false);
    }
  };

  // Submit manual barcode from input
  const handleSubmitBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleScanBarcode(barcodeInput);
    }
  };

  // Click handler for Bulk Produce Shortcut
  const handleSelectBulkProduce = (item: BulkProduceShortcut) => {
    handleScanBarcode(item.barcode, item.name);
  };

  // Quick product modal created handler
  const handleProductCreated = (newProd: Product) => {
    setIsQuickModalOpen(false);
    handleSelectProduct(newProd);
    if (soundEnabled) {
      playBeep('success');
    }
  };

  // Open modal for uncataloged product
  const handleOpenNewProductModal = () => {
    setBarcodeForModal('');
    setSuggestedNameForModal('');
    setIsQuickModalOpen(true);
  };

  // Quantity Stepper Handlers
  const handleAdjustQuantity = (delta: number) => {
    const current = Number(quantity) || 0;
    const next = Math.max(0, current + delta);
    setQuantity(String(next));
  };

  const handleResetQuantity = () => {
    setQuantity('0');
  };

  // Expiration Date Chip Handler
  const handleQuickExpiration = (days: number) => {
    setExpirationDate(getRelativeDate(days));
  };

  // FEFO preview calculation
  const isDateExpired = checkIsExpired(expirationDate);
  const liveDaysRemaining = expirationDate ? calculateDaysRemaining(expirationDate) : 0;
  const liveFEFOStatus: FEFOStatus = expirationDate
    ? getFEFOStatus(liveDaysRemaining, Number(quantity) || 1)
    : 'ESTABLE';

  // Handle confirmation submission
  const handleSubmitBatch = async (forceAllowExpired = false) => {
    setFormError(null);

    if (!selectedProduct) {
      setFormError('Primero escanea o selecciona un producto para registrar.');
      barcodeInputRef.current?.focus();
      return;
    }

    const cleanLot = lotCode.trim();
    if (!cleanLot) {
      setFormError('El código de lote es obligatorio.');
      return;
    }

    if (!expirationDate) {
      setFormError('Debe ingresar la fecha de caducidad.');
      return;
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('La cantidad debe ser un número mayor a 0.');
      quantityInputRef.current?.focus();
      return;
    }

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
        forceReject: false,
      };

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Duplicate lot collision (409)
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
        throw new Error(data.error || 'Error al guardar la entrada en el almacén.');
      }

      if (soundEnabled) {
        playBeep('success');
      }

      // Success Banner & List Update
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
        createdBy: data.createdBy || sessionUser?.userId,
      };

      setShiftBatches((prev) => [newBatchRecord, ...prev.slice(0, 14)]);
      setShiftCount((prev) => prev + 1);

      // Reset form and return to scanner focus
      setSelectedProduct(null);
      setLotCode('');
      setQuantity('');
      setExpirationDate('');
      setShowExpiredWarningModal(false);
      setBarcodeInput('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar el lote en bodega.');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Handlers for Duplicate Lot Collision (Consolidation or Separate Batch)
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
      });

      setShiftBatches((prev) => {
        const exists = prev.some((b) => b.id === data.id);
        if (exists) {
          return prev.map((b) =>
            b.id === data.id ? { ...b, ...data, product: selectedProduct } : b
          );
        }
        return [{ ...data, product: selectedProduct }, ...prev.slice(0, 14)];
      });
      setShiftCount((prev) => prev + 1);

      // Reset
      setDuplicateCollisionModal(null);
      setSelectedProduct(null);
      setLotCode('');
      setExpirationDate('');
      setQuantity('');
      setBarcodeInput('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
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
        warning: data.warning || 'Registrado como lote separado con folio repetido',
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
        createdBy: data.createdBy || sessionUser?.userId,
      };

      setShiftBatches((prev) => [newBatchRecord, ...prev.slice(0, 14)]);
      setShiftCount((prev) => prev + 1);

      // Reset
      setDuplicateCollisionModal(null);
      setSelectedProduct(null);
      setLotCode('');
      setExpirationDate('');
      setQuantity('');
      setBarcodeInput('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      setFormError(err.message || 'Error al crear lote separado.');
    } finally {
      setIsResolvingCollision(false);
    }
  };

  // Handlers for deleting/undoing a registered batch
  const handleOpenDeleteBatch = (batch: InventoryBatch) => {
    setDeletingBatch(batch);
    setDeleteError(null);
  };

  const handleCloseDeleteBatch = () => {
    if (isDeleting) return;
    setDeletingBatch(null);
    setDeleteError(null);
  };

  const handleConfirmDeleteBatch = async () => {
    if (!deletingBatch) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/inventory/${deletingBatch.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Error al eliminar el lote.');
        return;
      }

      if (soundEnabled) {
        playBeep('success');
      }

      setShiftBatches((prev) => prev.filter((b) => b.id !== deletingBatch.id));
      setShiftCount((prev) => Math.max(0, prev - 1));
      setDeletingBatch(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Error al eliminar el lote.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            {sessionUser?.role === 'admin' && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Tablero Principal</span>
              </Link>
            )}
            <div className="flex items-center gap-2 pt-1">
              <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
                <ScanLine className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                    Modo Operador de Almacén
                  </h1>
                  {sessionUser?.role === 'operator' && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Operador de Almacén
                    </span>
                  )}
                  {sessionUser?.role === 'admin' && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-fnvac-blue-500/20 text-fnvac-blue-300 border border-fnvac-blue-500/30">
                      Coordinador / Admin
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-300">
                  Terminal de Registro Rápido CEDIS Celaya &bull; Andén de Entrada
                  {sessionUser && (
                    <span className="ml-1 text-slate-400 font-semibold">
                      &bull; {sessionUser.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Counters & Audio Controls */}
          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* Shift Counter */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-xl text-center">
              <CheckCheck className="w-5 h-5 text-fnvac-blue-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Registros del Turno
                </div>
                <div className="text-lg font-extrabold text-white leading-tight">
                  {shiftCount}
                </div>
              </div>
            </div>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-fnvac-blue-500/20 text-fnvac-blue-300 border-fnvac-blue-500/40 hover:bg-fnvac-blue-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-fnvac-blue-400" />
                  <span className="hidden md:inline">Sonido ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden md:inline">Silenciado</span>
                </>
              )}
            </button>

            {/* Operator Logout */}
            {sessionUser?.role === 'operator' && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="rounded-2xl p-4 bg-fnvac-blue-500/15 border-2 border-fnvac-blue-500 text-fnvac-blue-950 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fnvac-blue-600 text-white rounded-xl shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-fnvac-blue-900 leading-tight">
                {successBanner.consolidated
                  ? '¡Existencias Consolidadas con Éxito!'
                  : '¡Entrada a Bodega Confirmada con Éxito!'}
              </h3>
              <p className="text-xs sm:text-sm text-fnvac-blue-800 font-medium mt-0.5">
                Producto: <strong className="font-bold text-slate-900">{successBanner.productName}</strong> &bull; Lote:{' '}
                <strong className="font-mono font-bold text-slate-900">{successBanner.lotCode}</strong> &bull; Cantidad:{' '}
                <strong className="font-bold text-fnvac-blue-900">{successBanner.quantity} {successBanner.unit}</strong>
                {successBanner.consolidated && successBanner.totalQuantity !== undefined && (
                  <span className="text-xs bg-fnvac-blue-100 text-fnvac-blue-800 px-2 py-0.5 rounded font-bold ml-2">
                    Total Acumulado: {successBanner.totalQuantity} {successBanner.unit}
                  </span>
                )}
              </p>
              {successBanner.warning && (
                <div className="text-xs text-amber-800 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{successBanner.warning}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="p-1.5 text-fnvac-blue-800 hover:text-fnvac-blue-950 hover:bg-fnvac-blue-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form Error Banner */}
      {formError && (
        <div className="rounded-2xl p-4 bg-rose-50 border-2 border-rose-400 text-rose-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-bold">{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="p-1 text-rose-700 hover:text-rose-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Scanner / Product Section & Right Batch Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Scanner & Product Selection */}
        <div className="lg:col-span-5 space-y-5">
          {/* Barcode Scanner Gun Card */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-fnvac-blue-600" />
                <h2 className="text-base font-extrabold text-slate-900">
                  Escáner & Código de Barras
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isCameraActive
                    ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cerrar Cámara</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5 text-slate-700" />
                    <span>Activar Cámara</span>
                  </>
                )}
              </button>
            </div>

            {/* Gun Barcode Input Form */}
            <form onSubmit={handleSubmitBarcode} className="space-y-3">
              <label htmlFor="barcode-gun-input" className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Lectura con Pistola o Entrada Manual
              </label>
              <div className="relative flex items-center">
                <input
                  ref={barcodeInputRef}
                  id="barcode-gun-input"
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escanea con pistola o teclea..."
                  className="w-full h-12 pl-3.5 pr-24 rounded-xl border-2 border-slate-400 focus:border-fnvac-blue-600 focus:ring-2 focus:ring-fnvac-blue-500 text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-sans transition-all"
                  autoComplete="off"
                  disabled={isSearchingProduct}
                />
                <button
                  type="submit"
                  disabled={!barcodeInput.trim() || isSearchingProduct}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 rounded-lg bg-fnvac-blue-600 hover:bg-fnvac-blue-700 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  {isSearchingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                La pistola láser enviará el código y presionará Enter automáticamente.
              </p>
            </form>

            {/* Optional Camera Scanner Area */}
            {isCameraActive && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <BarcodeScanner
                  onScan={(scanned) => {
                    handleScanBarcode(scanned);
                    setIsCameraActive(false);
                  }}
                  onAddNewProduct={handleOpenNewProductModal}
                  defaultCameraActive={true}
                  onCameraActiveChange={(active) => setIsCameraActive(active)}
                />
              </div>
            )}

            {/* Action to create uncataloged product */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">¿No tiene código o no existe?</span>
              <button
                type="button"
                onClick={handleOpenNewProductModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fnvac-blue-50 hover:bg-fnvac-blue-100 border border-fnvac-blue-300 text-fnvac-blue-800 text-xs font-bold transition-all cursor-pointer select-none active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-fnvac-blue-600" />
                <span>+ Registrar producto inexistente</span>
              </button>
            </div>
          </div>

          {/* Quick Bulk Produce Shortcuts Card */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Perecederos a Granel (Atajos Rápidos)</span>
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">Sin código de barras</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {BULK_PRODUCE_SHORTCUTS.map((item) => {
                const isSelected = selectedProduct?.barcode === item.barcode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectBulkProduce(item)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'border-fnvac-blue-600 bg-fnvac-blue-50 ring-2 ring-fnvac-blue-500/30 font-bold'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 font-medium'
                    }`}
                  >
                    <span className="text-2xl select-none">{item.emoji}</span>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Granel ({item.unit})
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolved Product Details Card */}
          {selectedProduct ? (
            <div className="bg-fnvac-blue-50 border-2 border-fnvac-blue-500/60 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-fnvac-blue-600 text-white rounded-xl shadow-xs">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-fnvac-blue-800 tracking-wider">
                      Producto Seleccionado
                    </span>
                    <h3 className="text-base font-black text-slate-950 leading-tight">
                      {selectedProduct.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setBarcodeInput('');
                    barcodeInputRef.current?.focus();
                  }}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-fnvac-blue-100/80 transition-colors"
                  title="Cambiar producto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-fnvac-blue-200">
                <div className="bg-white/80 p-2 rounded-lg border border-fnvac-blue-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Donador</span>
                  <strong className="text-slate-900 font-bold">{selectedProduct.donorType}</strong>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-fnvac-blue-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Almacén Destino</span>
                  <strong className="text-slate-900 font-bold">
                    {selectedProduct.storageArea === 'Camara_Fria'
                      ? 'Cámara Fría'
                      : selectedProduct.storageArea === 'Nave_Secos'
                      ? 'Nave Secos'
                      : 'Andén'}
                  </strong>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-fnvac-blue-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Categoría</span>
                  <strong className="text-slate-900 font-bold">
                    {selectedProduct.category.replace(/_/g, ' ')}
                  </strong>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-fnvac-blue-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Código</span>
                  <span className="font-mono text-slate-700 font-bold truncate block">
                    {selectedProduct.barcode}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-400" />
              <div className="text-sm font-bold text-slate-700">Ningún producto seleccionado</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Escanea un código de barras o pulsa uno de los atajos perecederos para ingresar un lote.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (7 cols): Batch Details, Tactile Steppers & Confirmation */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Detalles del Lote & Registro de Entrada
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedProduct
                    ? `Ingresando mercancía para "${selectedProduct.name}"`
                    : 'Selecciona un producto para habilitar la entrada'}
                </p>
              </div>
              {selectedProduct && (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-fnvac-blue-100 text-fnvac-blue-800 border border-fnvac-blue-200">
                  Unidad: {selectedProduct.unit}
                </span>
              )}
            </div>

            {/* Lot Code Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="lot-code-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Código de Lote
                </label>
                <button
                  type="button"
                  onClick={() => setLotCode(generateLotCode())}
                  disabled={!selectedProduct}
                  className="inline-flex items-center gap-1 text-xs font-bold text-fnvac-blue-700 hover:text-fnvac-blue-800 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerar Lote</span>
                </button>
              </div>
              <input
                id="lot-code-input"
                type="text"
                value={lotCode}
                onChange={(e) => setLotCode(e.target.value)}
                placeholder="Ej. LOT-20260918-ABCD"
                disabled={!selectedProduct}
                className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-300 focus:border-fnvac-blue-600 focus:ring-2 focus:ring-fnvac-blue-500/20 text-sm font-mono font-bold text-slate-900 placeholder:font-sans disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            {/* Batch Quantity with Tactile Steppers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="quantity-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cantidad Recibida ({selectedProduct?.unit || 'unidades'})
                </label>
                <span className="text-xs text-slate-500 font-medium">
                  Usa los pulsadores o escribe directamente
                </span>
              </div>

              {/* Large Quantity Display / Input */}
              <div className="relative flex items-center justify-center">
                <input
                  ref={quantityInputRef}
                  id="quantity-input"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  disabled={!selectedProduct}
                  className="w-full h-16 text-center text-3xl font-black font-mono text-slate-900 rounded-2xl border-2 border-slate-400 focus:border-fnvac-blue-600 focus:ring-4 focus:ring-fnvac-blue-500/15 disabled:bg-slate-50 disabled:text-slate-300 transition-all"
                />
              </div>

              {/* Tactile Touch Stepper Buttons */}
              <div className="space-y-2 pt-1">
                {/* Increment Buttons: +1, +5, +10, +50, +100 */}
                <div className="grid grid-cols-5 gap-2">
                  {[1, 5, 10, 50, 100].map((step) => (
                    <button
                      key={`inc-${step}`}
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => handleAdjustQuantity(step)}
                      className="h-12 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-sm sm:text-base shadow-xs transition-all flex items-center justify-center cursor-pointer select-none border border-fnvac-blue-700"
                    >
                      +{step}
                    </button>
                  ))}
                </div>

                {/* Decrement & Reset Buttons: -1, -5, Reset */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!selectedProduct || (Number(quantity) || 0) <= 0}
                    onClick={() => handleAdjustQuantity(-1)}
                    className="h-11 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-800 font-extrabold text-sm shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                  >
                    <span>-1</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct || (Number(quantity) || 0) < 5}
                    onClick={() => handleAdjustQuantity(-5)}
                    className="h-11 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-800 font-extrabold text-sm shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                  >
                    <span>-5</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={handleResetQuantity}
                    className="h-11 rounded-xl bg-rose-100 hover:bg-rose-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-rose-800 font-extrabold text-sm shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer select-none border border-rose-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Expiration Date Selector & Quick Chips */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="expiration-date-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fecha de Caducidad & Semáforo FEFO
                </label>
                {/* Real-time FEFO Preview Badge */}
                {selectedProduct && expirationDate && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Semáforo:</span>
                    <StatusBadge
                      status={liveFEFOStatus}
                      daysRemaining={liveDaysRemaining}
                    />
                  </div>
                )}
              </div>

              {/* Date Input */}
              <div className="relative">
                <input
                  id="expiration-date-input"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  disabled={!selectedProduct}
                  className="w-full h-12 px-3.5 rounded-xl border-2 border-slate-300 focus:border-fnvac-blue-600 focus:ring-2 focus:ring-fnvac-blue-500/20 text-base font-bold text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 transition-all"
                />
              </div>

              {/* Quick Date Chips: +7d, +15d, +30d, +60d, +90d, +1 año */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-bold block">
                  Atajos Rápidos de Caducidad:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '+7d', days: 7 },
                    { label: '+15d', days: 15 },
                    { label: '+30d', days: 30 },
                    { label: '+60d', days: 60 },
                    { label: '+90d', days: 90 },
                    { label: '+1 año', days: 365 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={!selectedProduct}
                      onClick={() => handleQuickExpiration(chip.days)}
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-fnvac-blue-50 hover:bg-fnvac-blue-100 border border-fnvac-blue-600 text-fnvac-blue-900 active:scale-95 disabled:opacity-40 transition-all cursor-pointer select-none"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Storage Area Selector */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label htmlFor="storage-area-select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Área de Almacenamiento
              </label>
              <select
                id="storage-area-select"
                value={storageArea}
                onChange={(e) => setStorageArea(e.target.value as StorageArea)}
                disabled={!selectedProduct}
                className="w-full h-11 px-3 rounded-xl border-2 border-slate-300 focus:border-fnvac-blue-600 text-sm font-bold text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="Camara_Fria">Cámara Fría (Refrigeración 2°C a 4°C)</option>
                <option value="Nave_Secos">Nave de Secos (Temperatura ambiente)</option>
                <option value="Anden">Andén de Perecederos (Tránsito rápido)</option>
              </select>
            </div>

            {/* Big Confirmation Button: "CONFIRMAR ENTRADA A BODEGA" */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => handleSubmitBatch(false)}
                disabled={!selectedProduct || isSubmittingBatch}
                className="w-full min-h-[54px] rounded-2xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white text-base sm:text-lg font-black tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none border-2 border-fnvac-blue-700"
              >
                {isSubmittingBatch ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>REGISTRANDO EN BODEGA...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-6 h-6 stroke-[3]" />
                    <span>CONFIRMAR ENTRADA A BODEGA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* "Mis Registros Recientes" Section */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-fnvac-blue-600" />
              <span>Mis Registros Recientes</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Entradas registradas durante el turno. Puedes deshacer o eliminar si hubo algún error.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRecentBatches}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBatches ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Table / List */}
        {isLoadingBatches && shiftBatches.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-medium">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-fnvac-blue-600" />
            <span>Cargando registros recientes...</span>
          </div>
        ) : shiftBatches.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">Aún no hay registros en este turno</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Los productos que ingreses aparecerán aquí con opción para deshacer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3 rounded-l-lg">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3">Caducidad</th>
                  <th className="py-2.5 px-3 text-center">Semáforo</th>
                  <th className="py-2.5 px-3 text-center rounded-r-lg">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftBatches.map((batch) => {
                  const daysRem = calculateDaysRemaining(batch.expirationDate);
                  const status = getFEFOStatus(daysRem, batch.currentQuantity);
                  const formattedTime = batch.receivedAt
                    ? new Date(batch.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-';
                  const canDelete =
                    sessionUser?.role === 'admin' ||
                    (sessionUser?.role === 'operator' && batch.createdBy === sessionUser.userId);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 leading-tight">
                          {batch.product?.name || 'Producto sin nombre'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {batch.product?.donorType || 'Donador'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                        {batch.lotCode}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {batch.currentQuantity} {batch.product?.unit || 'unid'}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {batch.expirationDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={status} daysRemaining={daysRem} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteBatch(batch)}
                            aria-label={`Eliminar o deshacer lote ${batch.lotCode}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-95 transition-all cursor-pointer"
                            title="Deshacer / Eliminar este registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Deshacer</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No editable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Product Modal for uncataloged items */}
      <QuickProductModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        scannedBarcode={barcodeForModal}
        suggestedName={suggestedNameForModal}
        onProductCreated={handleProductCreated}
      />

      {/* Expired Product Warning Confirmation Modal */}
      {showExpiredWarningModal && (
        <Modal
          isOpen={showExpiredWarningModal}
          onClose={() => setShowExpiredWarningModal(false)}
          title="Advertencia: Mercancía Vencida"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">
                  La fecha de caducidad ingresada ({expirationDate}) ya está vencida.
                </p>
                <p>
                  De acuerdo con el protocolo FEFO del Banco de Alimentos, esta entrada será clasificada como merma inmediata o requerirá autorización para desecho.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExpiredWarningModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Cancelar y Corregir Fecha
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExpiredWarningModal(false);
                  handleSubmitBatch(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
              >
                Registrar como Merma de Todos Modos
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate Lot Collision Modal (HTTP 409) */}
      {duplicateCollisionModal && (
        <Modal
          isOpen={!!duplicateCollisionModal}
          onClose={() => {
            if (!isResolvingCollision) setDuplicateCollisionModal(null);
          }}
          title="Conflicto de Folio de Lote Existente"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>El lote "{duplicateCollisionModal.existingBatch.lotCode}" ya existe en bodega</span>
              </div>
              <p>
                Producto: <strong>{selectedProduct?.name}</strong>. Actualmente hay{' '}
                <strong>
                  {duplicateCollisionModal.existingBatch.currentQuantity} {selectedProduct?.unit}
                </strong>{' '}
                registradas con fecha de vencimiento{' '}
                <strong>{duplicateCollisionModal.existingBatch.expirationDate}</strong>.
              </p>
              <p>
                Estás recibiendo una entrega adicional de{' '}
                <strong>
                  {duplicateCollisionModal.incomingQuantity} {selectedProduct?.unit}
                </strong>{' '}
                con caducidad{' '}
                <strong>{duplicateCollisionModal.incomingExpirationDate}</strong>.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isResolvingCollision}
                onClick={handleConfirmConsolidate}
                className="w-full py-2.5 px-4 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isResolvingCollision ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Consolidar Existencias (Sumar Cantidades)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isResolvingCollision}
                onClick={handleConfirmCreateSeparate}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold transition-all border border-slate-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Crear como Entrada Separada</span>
              </button>

              <button
                type="button"
                disabled={isResolvingCollision}
                onClick={() => setDuplicateCollisionModal(null)}
                className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancelar y Editar Folio
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Undo Batch Confirmation Modal */}
      {deletingBatch && (
        <Modal
          isOpen={!!deletingBatch}
          onClose={handleCloseDeleteBatch}
          title="¿Deshacer o Eliminar Registro de Entrada?"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Confirmar eliminación de inventario</span>
              </div>
              <p className="text-xs text-rose-800">
                ¿Estás seguro de que deseas eliminar la entrada del lote{' '}
                <strong className="font-mono">{deletingBatch.lotCode}</strong> de{' '}
                <strong>{deletingBatch.product?.name || 'Producto'}</strong> por{' '}
                <strong>
                  {deletingBatch.currentQuantity} {deletingBatch.product?.unit || 'unid'}
                </strong>
                ? Esta acción descontará la mercancía inmediatamente del inventario general.
              </p>
            </div>

            {deleteError && (
              <p className="text-xs font-bold text-rose-600">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseDeleteBatch}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteBatch}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Eliminar Registro</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
