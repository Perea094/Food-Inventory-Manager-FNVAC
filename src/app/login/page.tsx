'use client';

import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Warehouse,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeLogin = async (userToAuth: string, passToAuth: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userToAuth,
          password: passToAuth,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Using window.location.href ensures the browser executes a full request
        // carrying the newly set HttpOnly cookie through the middleware.
        window.location.href = data.redirectTo || '/';
      } else {
        setErrorMessage(data.error || 'Usuario o contraseña incorrectos');
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage('Error de comunicación con el servidor. Intente nuevamente.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Por favor ingrese su usuario y contraseña.');
      return;
    }
    await executeLogin(username.trim(), password);
  };

  const handleQuickDemoLogin = async (userDemo: string, passDemo: string) => {
    setUsername(userDemo);
    setPassword(passDemo);
    await executeLogin(userDemo, passDemo);
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-6 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Institutional Header */}
        <div className="text-center space-y-3">
          <img
            src="/logo-fnvac.png"
            alt="Fundación Nutrición y Vida A.C."
            className="h-16 w-auto mx-auto object-contain"
          />
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Fundación Nutrición y Vida A.C.
            </h1>
            <p className="text-sm font-medium text-slate-600">
              Sistema de Inventario FEFO &amp; Logística &bull; CEDIS Celaya
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8 space-y-6">
          {/* Interactive Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm animate-in fade-in slide-in-from-top-1"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5"
              >
                Nombre de Usuario
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="usuario (ej. admin o operador)"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-600 focus:border-fnvac-blue-600 focus:bg-white transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="contraseña del sistema"
                  className="block w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-600 focus:border-fnvac-blue-600 focus:bg-white transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-fnvac-blue-600 hover:bg-fnvac-blue-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-md shadow-fnvac-blue-600/25 hover:shadow-lg transition-all cursor-pointer select-none disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Iniciar Sesión</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Access / Demo Section */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Acceso Rápido para Demostración</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Haga clic para acceder al instante con las credenciales preconfiguradas del Banco de Alimentos:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Admin Demo Button */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('admin', 'admin123')}
              disabled={isLoading}
              title="Iniciar sesión directa con perfil de Administrador / Coordinador"
              className="flex flex-col items-start p-3 rounded-xl border border-fnvac-blue-200 bg-fnvac-blue-50/60 hover:bg-fnvac-blue-100/70 text-fnvac-blue-950 active:scale-[0.98] transition-all cursor-pointer text-left group disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-xs text-fnvac-blue-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-fnvac-blue-700" />
                  Coordinador
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-fnvac-blue-700 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <span className="text-[11px] font-semibold text-fnvac-blue-800 mt-1">
                Entrar como Coordinador (Admin)
              </span>
              <span className="text-[10px] text-fnvac-blue-700 font-mono mt-0.5">
                user: admin &bull; pass: admin123
              </span>
            </button>

            {/* Operador Demo Button */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('operador', 'operador123')}
              disabled={isLoading}
              title="Iniciar sesión directa con perfil de Operador de Almacén"
              className="flex flex-col items-start p-3 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 active:scale-[0.98] transition-all cursor-pointer text-left group disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-amber-700" />
                  Almacén
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <span className="text-[11px] font-semibold text-amber-800 mt-1">
                Entrar como Operador de Almacén
              </span>
              <span className="text-[10px] text-amber-600 font-mono mt-0.5">
                user: operador &bull; pass: operador123
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
