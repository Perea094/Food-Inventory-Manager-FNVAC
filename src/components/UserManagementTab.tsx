'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  User,
  ShieldCheck,
  Shield,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  RefreshCw,
} from 'lucide-react';
import Modal from './Modal.tsx';

interface ManagedUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operator';
  createdAt?: string;
}

export function UserManagementTab() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields for new user
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'operator' | 'admin'>('operator');

  // Messages
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setActionError(null);
      const res = await fetch('/api/users');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al obtener la lista de usuarios');
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setActionError(err.message || 'Error de conexión al cargar personal');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreateModal = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole('operator');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName) {
      setFormError('El nombre completo es obligatorio.');
      return;
    }
    if (!cleanUsername) {
      setFormError('El nombre de usuario / login es obligatorio.');
      return;
    }
    if (!password || password.length < 6) {
      setFormError('La contraseña inicial debe contener al menos 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          username: cleanUsername,
          password,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el operador');
      }

      setActionSuccess(`Personal "${cleanName}" (@${cleanUsername}) registrado con éxito.`);
      setIsCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'No fue posible registrar el nuevo operador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: ManagedUser) => {
    if (userToDelete.role === 'admin') {
      setActionError('No es posible eliminar una cuenta con rol de Administrador. Cuenta Raíz Protegida.');
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas dar de baja a "${userToDelete.name}" (@${userToDelete.username}) del sistema de almacén? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setIsDeletingUser(userToDelete.id);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al dar de baja al operador');
      }

      setActionSuccess(`El operador "${userToDelete.name}" ha sido dado de baja exitosamente.`);
      fetchUsers();
    } catch (err: any) {
      setActionError(err.message || 'Error al intentar eliminar el operador.');
    } finally {
      setIsDeletingUser(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="rounded-2xl bg-fnvac-blue-50 border border-fnvac-blue-200 p-4 text-xs sm:text-sm text-fnvac-blue-900 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-fnvac-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Operación exitosa</p>
            <p className="mt-0.5 text-fnvac-blue-800">{actionSuccess}</p>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-fnvac-blue-700 hover:text-fnvac-blue-900 font-bold text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm text-rose-900 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Aviso de seguridad / Error</p>
            <p className="mt-0.5 text-rose-800">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Header and Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-fnvac-blue-700" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Gestión de Personal & Operadores de Almacén
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Administra las credenciales de acceso para el personal del CEDIS Celaya. Los usuarios con rol de{' '}
            <strong className="text-slate-800">Operador de Almacén</strong> tienen acceso exclusivo a la terminal
            de captura y recepción de donaciones, mientras que los{' '}
            <strong className="text-slate-800">Administradores</strong> pueden supervisar inventarios, reportes y rutas.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-fnvac-blue-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500"
            aria-label="+ Nuevo Usuario"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Nuevo Usuario / Operador</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Cuentas Activas Registradas ({users.length})
          </h3>
          <span className="text-xs text-slate-500">
            Control de Autenticación Basado en Roles (RBAC)
          </span>
        </div>

        {isLoading && users.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-fnvac-blue-600 animate-spin" />
            <span className="text-sm font-medium">Cargando lista de operadores y administradores...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No hay usuarios adicionales registrados</p>
            <p className="text-xs text-slate-400 mt-1">
              Haz clic en "+ Registrar Nuevo Operador" para agregar personal de almacén.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nombre Completo</th>
                  <th className="px-6 py-3.5">Usuario / Login</th>
                  <th className="px-6 py-3.5">Rol en Sistema</th>
                  <th className="px-6 py-3.5">Fecha de Alta</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isAdmin = user.role === 'admin';
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name with icon */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                              isAdmin
                                ? 'bg-fnvac-blue-100 text-fnvac-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="w-5 h-5 text-fnvac-blue-700" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-400 sm:hidden">@{user.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4 font-mono text-xs text-slate-600 font-medium">
                        @{user.username}
                      </td>

                      {/* Role Badge */}
                      <td className="px-6 py-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-fnvac-blue-100 text-fnvac-blue-800 border border-fnvac-blue-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-fnvac-blue-700" />
                            <span>Coordinador / Administrador</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <span>Operador de Almacén</span>
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 text-right">
                        {user.role === 'admin' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 select-none cursor-default"
                            title="La cuenta de administrador está protegida contra eliminación"
                          >
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            <span>Cuenta Raíz Protegida</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isDeletingUser === user.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                            title={`Dar de baja al operador ${user.name}`}
                          >
                            {isDeletingUser === user.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Eliminando...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Dar de Baja</span>
                              </>
                            )}
                          </button>
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

      {/* Modal for Registering New Operator */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsCreateModalOpen(false);
        }}
        title="Registrar Nuevo Operador"
        description="Alta de credenciales de acceso para el terminal de almacén de CEDIS Celaya"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre Completo <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Operador Turno Matutino"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre de Usuario / Login <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Ej. operador_norte"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Identificador único para iniciar sesión en la terminal. Solo minúsculas, números o guión bajo.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña Inicial <span className="text-rose-600">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Rol Asignado <span className="text-rose-600">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'operator' | 'admin')}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-fnvac-blue-500 focus:border-fnvac-blue-500 bg-white"
            >
              <option value="operator">Operador de Almacén (Captura y Recepción FEFO)</option>
              <option value="admin">Coordinador / Administrador (Acceso Total)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-fnvac-blue-600 hover:bg-fnvac-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Registrar Nuevo Operador</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default UserManagementTab;
