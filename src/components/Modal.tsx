'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  onConfirm?: () => void;
  confirmText?: string;
  confirmLoading?: boolean;
  cancelText?: string;
  primaryButtonClass?: string;
}

export const MODAL_PRIMARY_BUTTON_CLASS =
  'bg-fnvac-blue-600 hover:bg-fnvac-blue-700 focus:ring-fnvac-blue-500';

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
  onConfirm,
  confirmText = 'Confirmar',
  confirmLoading = false,
  cancelText = 'Cancelar',
  primaryButtonClass,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full ${maxWidthMap[maxWidth]} border border-slate-200`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
            <div>
              <h3 className="text-lg font-semibold leading-6 text-slate-900">{title}</h3>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 max-h-[calc(85vh-120px)] overflow-y-auto">{children}</div>

          {/* Footer if onConfirm provided */}
          {onConfirm && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/70 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmLoading}
                className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-fnvac-blue-600 hover:bg-fnvac-blue-700 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                  primaryButtonClass || ''
                }`}
              >
                {confirmLoading ? 'Procesando...' : confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
