'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export type KPICardVariant = 'critical' | 'attention' | 'success' | 'cold' | 'neutral';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: KPICardVariant;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
  badge?: React.ReactNode;
  actionHint?: string;
}

const variantStyles: Record<
  KPICardVariant,
  {
    container: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    borderHighlight: string;
  }
> = {
  critical: {
    container: 'bg-red-50/60 border-red-200 hover:border-red-300',
    iconBg: 'bg-red-100 text-red-700',
    iconColor: 'text-red-600',
    valueColor: 'text-red-900',
    borderHighlight: 'border-l-4 border-l-red-500',
  },
  attention: {
    container: 'bg-amber-50/60 border-amber-200 hover:border-amber-300',
    iconBg: 'bg-amber-100 text-amber-700',
    iconColor: 'text-amber-600',
    valueColor: 'text-amber-900',
    borderHighlight: 'border-l-4 border-l-amber-500',
  },
  success: {
    container: 'bg-fnvac-blue-50/60 border-fnvac-blue-200 hover:border-fnvac-blue-300',
    iconBg: 'bg-fnvac-blue-100 text-fnvac-blue-700',
    iconColor: 'text-fnvac-blue-600',
    valueColor: 'text-fnvac-blue-900',
    borderHighlight: 'border-l-4 border-l-fnvac-blue-600',
  },
  cold: {
    container: 'bg-cyan-50/60 border-cyan-200 hover:border-cyan-300',
    iconBg: 'bg-cyan-100 text-cyan-700',
    iconColor: 'text-cyan-600',
    valueColor: 'text-cyan-900',
    borderHighlight: 'border-l-4 border-l-cyan-500',
  },
  neutral: {
    container: 'bg-white border-slate-200 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-700',
    iconColor: 'text-slate-600',
    valueColor: 'text-slate-900',
    borderHighlight: 'border-l-4 border-l-slate-400',
  },
};

const activeVariantStyles: Record<KPICardVariant, string> = {
  critical: 'ring-2 ring-red-500 ring-offset-1 shadow-md bg-red-100/50',
  attention: 'ring-2 ring-amber-500 ring-offset-1 shadow-md bg-amber-100/50',
  success: 'ring-2 ring-fnvac-blue-600 ring-offset-1 shadow-md bg-fnvac-blue-100/50',
  cold: 'ring-2 ring-cyan-500 ring-offset-1 shadow-md bg-cyan-100/50',
  neutral: 'ring-2 ring-slate-600 ring-offset-1 shadow-md bg-slate-100/70',
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'neutral',
  onClick,
  className = '',
  isActive = false,
  badge,
  actionHint,
}) => {
  const styles = variantStyles[variant];
  const activeClass = isActive ? (activeVariantStyles[variant] || 'ring-2 ring-slate-500') : '';

  const content = (
    <div
      className={`relative rounded-xl border p-5 shadow-sm transition-all duration-200 ${styles.container} ${styles.borderHighlight} ${
        onClick ? 'cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 select-none' : ''
      } ${activeClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? isActive : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>
            {badge && <div>{badge}</div>}
          </div>
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${styles.valueColor}`}>
            {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
          </div>
          {subtext && (
            <p className="text-xs text-slate-600 flex items-center gap-1 font-medium">
              {subtext}
            </p>
          )}
          {actionHint && (
            <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
              {actionHint}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg flex-shrink-0 ${styles.iconBg}`}>
          <Icon className={`w-6 h-6 ${styles.iconColor}`} />
        </div>
      </div>
    </div>
  );

  return content;
};

export default KPICard;
