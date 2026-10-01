'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  FlipHorizontal,
  HelpCircle,
  Volume2,
  VolumeX,
  PlusCircle,
  Zap,
  ZapOff,
} from 'lucide-react';

import { BulkProduceShortcut, BULK_PRODUCE_SHORTCUTS } from '../lib/produce.ts';
export { type BulkProduceShortcut, BULK_PRODUCE_SHORTCUTS };

export interface BarcodeScannerProps {
  onScan: (barcode: string, suggestedName?: string) => void;
  isLoading?: boolean;
  className?: string;
  autoFocus?: boolean;
  onAddNewProduct?: () => void;
  defaultCameraActive?: boolean;
  onCameraActiveChange?: (active: boolean) => void;
}

/**
 * Calculates dynamic rectangular qrbox optimized for standard 1D linear barcodes (EAN-13, CODE-128)
 */
export const calculateQrBox = (viewfinderWidth: number, viewfinderHeight: number) => ({
  width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
  height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
});

/**
 * Synthesizes an audible confirmation beep using Web Audio API AudioContext
 */
export const playScanBeep = (enabled: boolean) => {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch (_) {
    // AudioContext may be restricted before user gesture or in headless environments
  }
};

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  isLoading = false,
  className = '',
  autoFocus = true,
  onAddNewProduct,
  defaultCameraActive = false,
  onCameraActiveChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(defaultCameraActive);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Advanced camera and feedback state
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [detectedCodeOverlay, setDetectedCodeOverlay] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSwitchingRef = useRef<boolean>(false);

  // Keep soundEnabledRef in sync for audio synthesizer without re-initializing video stream
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Restore persisted camera preference from localStorage if available
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedCam = localStorage.getItem('nutricion_scanner_camera_id');
        if (savedCam) {
          setSelectedCameraId(savedCam);
        }
      }
    } catch (_) {}
  }, []);

  // Synchronize mirror mode (scale-x-[-1]) on the video element inside #qr-reader
  useEffect(() => {
    if (!isCameraActive) return;

    const qrContainer = document.getElementById('qr-reader');
    if (!qrContainer) return;

    const syncMirror = () => {
      const video = qrContainer.querySelector('video');
      if (video) {
        if (isMirrored) {
          video.classList.add('scale-x-[-1]');
        } else {
          video.classList.remove('scale-x-[-1]');
        }
      }
    };

    syncMirror();
    const observer = new MutationObserver(syncMirror);
    observer.observe(qrContainer, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [isMirrored, isCameraActive]);

  // Auto-focus physical input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Flash feedback helper
  const triggerSuccessFeedback = useCallback((code: string) => {
    setLastScannedCode(code);
    setIsSuccessFlash(true);
    const timer = setTimeout(() => {
      setIsSuccessFlash(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  // Process decoded code with debounce and multi-sensory feedback
  const handleDecodedCode = useCallback(
    (code: string, suggestedName?: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      // Debounce mechanism: prevent rapid repeated scans of exact same code within 1.5s
      const now = Date.now();
      if (
        lastScannedTimeRef.current.code === cleanCode &&
        now - lastScannedTimeRef.current.timestamp < 1500
      ) {
        return;
      }
      lastScannedTimeRef.current = { code: cleanCode, timestamp: now };

      // Multi-sensory feedback: sound synthesizer beep
      playScanBeep(soundEnabledRef.current);

      // Multi-sensory feedback: tactile vibration on mobile devices
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(100);
        } catch (_) {}
      }

      // Visual flash on scanner container
      triggerSuccessFeedback(cleanCode);

      // Detected code badge overlay in viewfinder for 1.2s
      setDetectedCodeOverlay(cleanCode);
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      overlayTimeoutRef.current = setTimeout(() => {
        setDetectedCodeOverlay(null);
      }, 1200);

      // Forward to parent handler
      onScan(cleanCode, suggestedName);
    },
    [triggerSuccessFeedback, onScan]
  );

  // Handle manual / physical reader scan submission
  const handleSubmitCode = (codeToSubmit?: string, suggestedName?: string) => {
    const raw = codeToSubmit !== undefined ? codeToSubmit : inputValue;
    const cleanCode = String(raw).trim();
    if (!cleanCode) return;

    handleDecodedCode(cleanCode, suggestedName);
    setInputValue('');

    // Maintain focus for continuous physical scanner capture
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 80);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitCode();
    }
  };

  // Helper to cleanly stop and clear any active scanner instance
  const stopScannerInstance = async () => {
    if (html5QrCodeRef.current) {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.warn('Error stopping html5-qrcode scanner:', err);
      }
      try {
        scanner.clear();
      } catch (_) {}
    }
    const container = document.getElementById('qr-reader');
    if (container) {
      container.innerHTML = '';
    }
  };

  // Dedicated camera initializer supporting explicit target camera
  const initCamera = async (overrideCameraId?: string) => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      // 1. Cleanly stop any existing scanner instance and wait for hardware release
      await stopScannerInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const container = document.getElementById('qr-reader');
      if (!container) {
        setIsCameraInitializing(false);
        return;
      }

      // Supported barcode and 2D formats configuration
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ];

      // Instantiate scanner with formats and hardware-accelerated BarcodeDetector
      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      // Determine active camera ID (respect explicit parameter or state)
      const activeCameraId = overrideCameraId !== undefined ? overrideCameraId : selectedCameraId;

      // Query available cameras initially
      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      if (cameras && cameras.length > 0) {
        const formattedCameras = cameras.map((c: any, idx: number) => {
          const raw = c.label || '';
          const lower = raw.toLowerCase();
          let label = raw;
          if (
            lower.includes('back') ||
            lower.includes('rear') ||
            lower.includes('trasera') ||
            lower.includes('posterior') ||
            lower.includes('environment')
          ) {
            label = `📸 Trasera (${raw || `Cámara ${idx + 1}`})`;
          } else if (
            lower.includes('front') ||
            lower.includes('frontal') ||
            lower.includes('user') ||
            lower.includes('selfie')
          ) {
            label = `🤳 Frontal (${raw || `Cámara ${idx + 1}`})`;
          } else {
            label = raw ? `📷 ${raw}` : `Cámara ${idx + 1}`;
          }
          return { id: c.id, label };
        });
        setAvailableCameras(formattedCameras);

        // Restore or pick camera preference
        if (!activeCameraId) {
          try {
            const saved = localStorage.getItem('nutricion_scanner_camera_id');
            if (saved && formattedCameras.some((c) => c.id === saved)) {
              setSelectedCameraId(saved);
            }
          } catch (_) {}
        }
      }

      // Camera constraints configuration
      let cameraConfig: any;
      if (selectedCameraId) {
        cameraConfig = { deviceId: { exact: selectedCameraId } };
      } else {
        cameraConfig = { facingMode: 'environment' };
      }

      // Optimized video scanning configuration: 15 fps, dynamic rectangular qrbox, continuous focus
      const scanConfig = {
        fps: 15,
        disableFlip: true,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
          height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
        }),
        videoConstraints: selectedCameraId
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              focusMode: 'continuous',
            }
          : {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              focusMode: 'continuous',
            },
      };

      const onScanSuccess = (decodedText: string) => {
        handleDecodedCode(decodedText);
      };

      const onScanFailure = () => {
        // Ignored per-frame scan misses
      };

      // Flexible camera startup with environmental, user, and device ID fallbacks
      try {
        await scanner.start(cameraConfig, scanConfig, onScanSuccess, onScanFailure);
      } catch (startErr: any) {
        if (!activeCameraId) {
          try {
            // Fallback to user facing mode (common for laptops/desktops)
            const fallbackScanConfig = {
              fps: 15,
              disableFlip: true,
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
                width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
                height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
              }),
              videoConstraints: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                focusMode: 'continuous',
              },
            };
            await scanner.start(
              { facingMode: 'user' },
              fallbackScanConfig,
              onScanSuccess,
              onScanFailure
            );
          } catch (userErr: any) {
            if (cameras && cameras.length > 0) {
              // Fallback to first available camera device ID
              await scanner.start(
                { deviceId: { exact: cameras[0].id } },
                {
                  fps: 15,
                  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
                    width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
                    height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
                  }),
                },
                onScanSuccess,
                onScanFailure
              );
            } else {
              throw userErr || startErr;
            }
          }
        } else {
          // If explicit activeCameraId failed with strict constraints, retry with simple deviceId
          await scanner.start(
            { deviceId: { exact: activeCameraId } },
            {
              fps: 15,
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
                width: Math.min(Math.floor(viewfinderWidth * 0.88), 420),
                height: Math.min(Math.floor(viewfinderHeight * 0.48), 200),
              }),
            },
            onScanSuccess,
            onScanFailure
          );
        }
      }

      setIsCameraInitializing(false);

      // Now that camera permission is granted, query available cameras to refresh with real labels
      Html5Qrcode.getCameras()
        .then((updatedCameras) => {
          if (updatedCameras && updatedCameras.length > 0) {
            const formatted = updatedCameras.map((c: any, idx: number) => {
              const raw = c.label || '';
              const lower = raw.toLowerCase();
              let label = raw;
              if (
                lower.includes('back') ||
                lower.includes('rear') ||
                lower.includes('trasera') ||
                lower.includes('posterior') ||
                lower.includes('environment')
              ) {
                label = `📸 Trasera (${raw || `Cámara ${idx + 1}`})`;
              } else if (
                lower.includes('front') ||
                lower.includes('frontal') ||
                lower.includes('user') ||
                lower.includes('selfie')
              ) {
                label = `🤳 Frontal (${raw || `Cámara ${idx + 1}`})`;
              } else {
                label = raw ? `📷 ${raw}` : `Cámara ${idx + 1}`;
              }
              return { id: c.id, label };
            });
            setAvailableCameras(formatted);
          }
        })
        .catch(() => {});

      // Check for torch / flash capability
      try {
        const qrContainer = document.getElementById('qr-reader');
        const video = qrContainer?.querySelector('video') as HTMLVideoElement | null;
        const stream = video?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()?.[0];
        const capabilities = (track as any)?.getCapabilities?.();
        setIsTorchSupported(Boolean(capabilities && capabilities.torch));
        setIsTorchOn(false);
      } catch (_) {
        setIsTorchSupported(false);
      }
    } catch (err: any) {
      setIsCameraInitializing(false);
      setIsCameraActive(false);
      onCameraActiveChange?.(false);
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Concede permisos en tu navegador.'
          : err?.message || 'No se pudo acceder a la cámara del dispositivo.';
      setCameraError(msg);
    }
  };

  // Camera scanner lifecycle using html5-qrcode
  useEffect(() => {
    if (!isCameraActive) {
      stopScannerInstance();
      return;
    }

    setIsCameraInitializing(true);
    setCameraError(null);

    initCamera(selectedCameraId);

    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      stopScannerInstance();
    };
  }, [isCameraActive, handleDecodedCode]);

  // Toggle Camera Handler
  const toggleCamera = () => {
    setCameraError(null);
    setIsCameraActive((prev) => {
      const next = !prev;
      onCameraActiveChange?.(next);
      return next;
    });
  };

  // Camera selection handler with persistence and smooth async switch
  const handleSelectCamera = async (cameraId: string) => {
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;
    setSelectedCameraId(cameraId);
    try {
      if (typeof window !== 'undefined') {
        if (cameraId) {
          localStorage.setItem('nutricion_scanner_camera_id', cameraId);
        } else {
          localStorage.removeItem('nutricion_scanner_camera_id');
        }
      }
    } catch (_) {}

    if (isCameraActive) {
      setIsCameraInitializing(true);
      setCameraError(null);
      try {
        await initCamera(cameraId);
      } finally {
        isSwitchingRef.current = false;
      }
    } else {
      isSwitchingRef.current = false;
    }
  };

  // Quick camera flip button (toggles next camera in list)
  const handleFlipCamera = async () => {
    if (availableCameras.length < 2 || isSwitchingRef.current) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    if (nextCamera) {
      await handleSelectCamera(nextCamera.id);
    }
  };

  // Toggle Torch / Flashlight on supported mobile devices
  const toggleTorch = async () => {
    try {
      const qrContainer = document.getElementById('qr-reader');
      const video = qrContainer?.querySelector('video') as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.warn('Torch toggle not supported or failed:', e);
    }
  };

  return (
    <div
      className={`rounded-2xl bg-white border transition-all duration-300 shadow-sm p-5 space-y-5 ${
        isSuccessFlash
          ? 'border-fnvac-blue-500 bg-fnvac-blue-50/40 ring-4 ring-fnvac-blue-400/30'
          : 'border-slate-200'
      } ${className}`}
    >
      {/* Top Header & Mode Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl transition-colors ${
              isSuccessFlash ? 'bg-fnvac-blue-600 text-white' : 'bg-fnvac-blue-100 text-fnvac-blue-800'
            }`}
          >
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Escáner de Código de Barras</span>
              {isSuccessFlash && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-fnvac-blue-600 text-white animate-pulse">
                  <CheckCircle2 className="w-3 h-3" /> Capturado
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Compatible con lector láser USB / Bluetooth continuo o cámara web móvil
            </p>
          </div>
        </div>

        {/* Toggle Camera Button */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-xs active:scale-95 cursor-pointer select-none ${
            isCameraActive
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          {isCameraActive ? (
            <>
              <CameraOff className="w-4 h-4 text-red-600" />
              <span>Desactivar Cámara</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 text-fnvac-blue-700" />
              <span>Activar Escáner con Cámara</span>
            </>
          )}
        </button>
      </div>

      {/* Camera Error Banner */}
      {cameraError && (
        <div className="flex items-start gap-2.5 p-3 text-xs bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Aviso de Cámara: </span>
            {cameraError}
          </div>
        </div>
      )}

      {/* Camera Viewport (Mounted when active) */}
      {isCameraActive && (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3.5 shadow-md">
          {/* Top Status & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between w-full max-w-md gap-2 px-1 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-fnvac-blue-400 animate-ping" />
              Sensor activo: alinea el código
            </span>

            {isCameraInitializing ? (
              <span className="flex items-center gap-1 text-amber-400 font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calibrando sensor...
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">15 FPS • Enfoque continuo</span>
            )}
          </div>

          {/* Camera Controls Bar (Camera selector, Mirror mode, Sound toggle, Tips) */}
          <div className="flex flex-wrap items-center justify-between w-full max-w-md gap-2 p-2 bg-slate-800/80 rounded-xl border border-slate-700/80">
            {/* Camera selector if multiple cameras detected */}
            {availableCameras.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                <select
                  id="cameraSelect"
                  aria-label="Seleccionar cámara"
                  value={selectedCameraId}
                  onChange={(e) => handleSelectCamera(e.target.value)}
                  className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-fnvac-blue-500 cursor-pointer max-w-[150px] sm:max-w-[190px] truncate"
                >
                  <option value="">📸 Trasera (Automática)</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Cámara ${cam.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleFlipCamera}
                  title="Cambiar a la siguiente cámara (Frontal / Trasera)"
                  aria-label="Cambiar cámara"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-fnvac-blue-400" />
                  <span className="hidden sm:inline">Cambiar</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>📸 Cámara Trasera HD</span>
              </div>
            )}

            {/* Quick Actions: Torch, Mirror, Sound, Help Tips */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Toggle Torch if supported */}
              {isTorchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  title={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
                  aria-label={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isTorchOn
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {isTorchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">Flash</span>
                </button>
              )}

              {/* Toggle Mirror Mode */}
              <button
                type="button"
                onClick={() => setIsMirrored((prev) => !prev)}
                title={isMirrored ? 'Modo espejo activado (clic para desactivar)' : 'Activar modo espejo'}
                aria-label={isMirrored ? 'Desactivar modo espejo' : 'Activar modo espejo'}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                  isMirrored
                    ? 'bg-fnvac-blue-600 text-white border-fnvac-blue-500 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Espejo</span>
              </button>

              {/* Toggle Sound */}
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
                aria-label={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                  soundEnabled
                    ? 'bg-slate-900 text-fnvac-blue-400 border-fnvac-blue-500/50 hover:bg-slate-800'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-fnvac-blue-400" />
                    <span className="hidden xs:inline">Beep</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden xs:inline">Mute</span>
                  </>
                )}
              </button>

              {/* Toggle Scanning Tips */}
              <button
                type="button"
                onClick={() => setShowTips((prev) => !prev)}
                title="Consejos para escaneo óptimo"
                aria-label="Ver consejos de escaneo"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                  showTips
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Guía</span>
              </button>
            </div>
          </div>

          {/* Scanning Tips Accordion / Box */}
          {showTips && (
            <div className="w-full max-w-md p-3.5 bg-slate-800 border border-blue-500/30 rounded-xl text-slate-200 text-xs space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-blue-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" /> Consejos para escaneo óptimo:
                </span>
                <button
                  type="button"
                  onClick={() => setShowTips(false)}
                  className="text-slate-400 hover:text-slate-200 text-[11px] cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed pl-1">
                <li>Mantén el código a 15-25 cm de distancia</li>
                <li>Alinea las barras horizontalmente dentro de la guía roja</li>
                <li>Asegura buena iluminación sin reflejos directos</li>
              </ul>
            </div>
          )}

          {/* Camera Viewfinder with Overlay and Laser Line */}
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-black min-h-[260px] flex items-center justify-center border border-slate-800">
            {/* HTML5 QR Code Container */}
            <div
              id="qr-reader"
              className={`w-full overflow-hidden rounded-xl ${isMirrored ? '[&_video]:scale-x-[-1]' : ''}`}
            />

            {/* Viewfinder Target Overlays (Red Box & Scanning Laser) */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              {/* Outer guide box */}
              <div className="relative w-full max-w-[420px] h-[160px] sm:h-[180px] border-2 border-dashed border-red-500/80 rounded-xl flex items-center justify-center">
                {/* Corner crosshairs */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-red-500" />
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-red-500" />
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-red-500" />
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-red-500" />

                {/* Animated horizontal scanning red laser line */}
                <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.9)] animate-laser-sweep" />
              </div>
            </div>

            {/* Detected Code Overlay Confirmation Badge */}
            {detectedCodeOverlay && (
              <div className="pointer-events-none absolute bottom-5 px-3.5 py-1.5 rounded-xl bg-fnvac-blue-600/95 text-white font-mono text-xs font-bold shadow-lg backdrop-blur-xs flex items-center gap-2 animate-bounce border border-fnvac-blue-400">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>¡Leído!: {detectedCodeOverlay}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Physical Scanner / Manual Input Box */}
      <div className="space-y-2">
        <label
          htmlFor="barcodeInput"
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
        >
          Modo Pistola / Lector Físico USB &amp; Bluetooth (Autofocus)
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="barcodeInput"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escanee con pistola o escriba código y presione Enter..."
              disabled={isLoading}
              className={`w-full pl-10 pr-4 py-2.5 text-sm font-mono rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                isSuccessFlash
                  ? 'border-fnvac-blue-500 bg-fnvac-blue-50/50 ring-fnvac-blue-500 font-bold text-fnvac-blue-900'
                  : 'border-slate-300 bg-white text-slate-900 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500'
              }`}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Barcode className="w-5 h-5" />
            </div>
            {isLoading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <RefreshCw className="w-4 h-4 text-fnvac-blue-600 animate-spin" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSubmitCode()}
            disabled={isLoading || !inputValue.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-fnvac-blue-700 hover:bg-fnvac-blue-800 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 active:scale-95 cursor-pointer select-none transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-fnvac-blue-600 flex-shrink-0" />
          El cursor vuelve automáticamente a esta casilla tras cada captura para escaneo continuo.
        </p>
      </div>

      {/* Bulk Produce Quick Shortcuts */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Artículos perecederos (sin código físico)
          </span>
          {onAddNewProduct ? (
            <button
              type="button"
              onClick={onAddNewProduct}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-fnvac-blue-700 hover:text-fnvac-blue-800 bg-fnvac-blue-50 hover:bg-fnvac-blue-100 px-2.5 py-1 rounded-lg border border-fnvac-blue-200 transition-all active:scale-95 cursor-pointer select-none"
            >
              <PlusCircle className="w-3.5 h-3.5 text-fnvac-blue-600" />
              <span>+ Registrar nuevo</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Donaciones directas de campo</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {BULK_PRODUCE_SHORTCUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSubmitCode(item.barcode, item.name)}
              disabled={isLoading}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-fnvac-blue-50 hover:border-fnvac-blue-300 hover:text-fnvac-blue-900 active:scale-95 cursor-pointer select-none transition-all text-left group shadow-2xs disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
            >
              <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                {item.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 group-hover:text-fnvac-blue-950 truncate">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {item.unit === 'kilos' ? 'Granel (kg)' : 'Piezas'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {onAddNewProduct && (
          <button
            type="button"
            onClick={onAddNewProduct}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 hover:border-fnvac-blue-500 hover:bg-fnvac-blue-50/60 text-slate-700 hover:text-fnvac-blue-900 transition-all active:scale-95 cursor-pointer text-xs font-semibold select-none shadow-2xs"
          >
            <PlusCircle className="w-4 h-4 text-fnvac-blue-600" />
            <span>Registrar producto inexistente (dar de alta en catálogo)</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
