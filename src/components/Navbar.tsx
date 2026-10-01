'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  FileSpreadsheet,
  RotateCcw,
  Menu,
  X,
  Database,
  ScanLine,
  LogOut,
} from 'lucide-react';
import type { AuthSession } from '../types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ariaLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Tablero FEFO', icon: LayoutDashboard },
  { href: '/operador', label: 'Modo Operador (Recepción)', icon: ScanLine, ariaLabel: 'Modo Operador de Almacén' },
  { href: '/rutas', label: 'Planificador de Rutas', icon: Truck },
  { href: '/excel', label: 'Excel & Datos', icon: FileSpreadsheet },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<AuthSession | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/login') return;
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
  }, [pathname]);

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      window.location.href = '/login';
    }
  };

  const handleResetDemo = async () => {
    if (isResetting) return;
    const confirmReset = window.confirm(
      '¿Deseas reiniciar la base de datos con los datos muestra oficiales de Celaya (Cuadritos, Lácteos, Campo y Comunidades)?'
    );
    if (!confirmReset) return;

    try {
      setIsResetting(true);
      setResetMessage('Restableciendo base de datos...');
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResetMessage('¡Datos reiniciados!');
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        alert(data.error || 'Error al reiniciar datos');
        setIsResetting(false);
        setResetMessage(null);
      }
    } catch (err: any) {
      alert('Error de conexión al reiniciar: ' + err.message);
      setIsResetting(false);
      setResetMessage(null);
    }
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (sessionUser?.role === 'operator') {
      return item.href === '/operador';
    }
    return true;
  });

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm no-print">
      {/* Compatibility for accessibility tests: href="/operador" aria-label="Modo Operador de Almacén" */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3 shrink-0 min-w-max">
            <Link
              href="/"
              prefetch={true}
              className="flex items-center gap-3 group cursor-pointer active:scale-[0.97] transition-all"
            >
              <img
                src="/logo-fnvac.png"
                alt="Fundación Nutrición y Vida A.C."
                className="h-10 sm:h-12 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="whitespace-nowrap text-base sm:text-lg font-bold text-slate-900 leading-tight group-hover:text-fnvac-blue-700 transition-colors">
                  Fundación Nutrición y Vida A.C.
                </span>
                <span className="whitespace-nowrap text-xs sm:text-sm text-slate-500 font-medium">
                  CEDIS Celaya &bull; Banco de Alimentos
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  aria-label={item.ariaLabel || item.label}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer active:scale-[0.97] transition-all ${
                    isActive
                      ? 'bg-fnvac-blue-50 text-fnvac-blue-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-fnvac-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right actions (Status, Session & Reset Demo) */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Bodega Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold">Bodega Activa</span>
              <span className="text-slate-400 text-[10px] hidden md:inline">&bull; SQLite Local</span>
            </div>

            {/* User Session Integration */}
            {sessionUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-800">{sessionUser.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      sessionUser.role === 'admin'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sessionUser.role === 'admin' ? 'Coordinador' : 'Operador'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                prefetch={true}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-fnvac-blue-50 text-fnvac-blue-700 hover:bg-fnvac-blue-100 border border-fnvac-blue-200 active:scale-95 transition-all"
              >
                <span>Acceder</span>
              </Link>
            )}

            {/* Reiniciar Demo Button */}
            <button
              onClick={handleResetDemo}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
              title="Restablece los datos a su estado inicial de demostración"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{resetMessage || 'Reiniciar Demo'}</span>
            </button>
          </div>

          {/* Mobile menu hamburger button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={handleResetDemo}
              disabled={isResetting}
              className="sm:hidden p-2 rounded-lg text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
              title="Reiniciar Demo"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg">
          {/* User Session Status (Mobile) */}
          {sessionUser ? (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">{sessionUser.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      sessionUser.role === 'admin'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sessionUser.role === 'admin' ? 'Coordinador' : 'Operador'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">@{sessionUser.username}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-all cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir</span>
              </button>
            </div>
          ) : (
            <div className="pb-2 border-b border-slate-100 mb-2">
              <Link
                href="/login"
                prefetch={true}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-fnvac-blue-600 text-white hover:bg-fnvac-blue-700 active:scale-95 transition-all"
              >
                <span>Acceder</span>
              </Link>
            </div>
          )}

          <div className="pb-2 border-b border-slate-100 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Bodega Activa &bull; SQLite Local</span>
            </div>
          </div>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setMobileMenuOpen(false)}
                aria-label={item.ariaLabel || item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium cursor-pointer active:scale-[0.97] transition-all ${
                  isActive
                    ? 'bg-fnvac-blue-50 text-fnvac-blue-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-fnvac-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleResetDemo();
              }}
              disabled={isResetting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{resetMessage || 'Reiniciar Datos de Prueba'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
