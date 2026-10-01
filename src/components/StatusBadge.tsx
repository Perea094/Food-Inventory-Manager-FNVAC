'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import type { FEFOStatus } from '../types/index';

export interface StatusBadgeProps {
  status: FEFOStatus | string;
  daysRemaining?: number;
  showDays?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  daysRemaining,
  showDays = true,
  className = '',
  size = 'md',
}) => {
  const normStatus = (status || '').toUpperCase() as FEFOStatus;

  let daysText = '';
  if (showDays && daysRemaining !== undefined) {
    if (daysRemaining < 0) {
      daysText = `Vencido hace ${Math.abs(daysRemaining)} d`;
    } else if (daysRemaining === 0) {
      daysText = '¡Vence hoy!';
    } else if (daysRemaining === 1) {
      daysText = '1 día restante';
    } else {
      daysText = `${daysRemaining} días restantes`;
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  switch (normStatus) {
    case 'CRITICO':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 shadow-sm ${sizeClasses} ${className}`}
          title="Lote crítico: caducidad en 3 días o menos"
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span>{daysText || 'Crítico (≤ 3d)'}</span>
        </span>
      );

    case 'ATENCION':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-sm ${sizeClasses} ${className}`}
          title="Lote en atención: caducidad en 4 a 7 días"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>{daysText || 'Atención (4-7d)'}</span>
        </span>
      );

    case 'ESTABLE':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm ${sizeClasses} ${className}`}
          title="Lote estable: caducidad mayor a 7 días"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>{daysText || 'Estable (> 7d)'}</span>
        </span>
      );

    case 'AGOTADO':
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-sm ${sizeClasses} ${className}`}
          title="Stock agotado o saldo cero"
        >
          <MinusCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span>{daysRemaining !== undefined && daysRemaining <= 0 ? 'Agotado' : (daysText || 'Agotado')}</span>
        </span>
      );
  }
};

export default StatusBadge;
