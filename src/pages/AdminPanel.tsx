import { useState } from 'react';
import { useTenant } from '../context/TenantContext';
import { ArrowLeft, UserPlus, Trash2, Users, Shield, Copy, Check, Pencil, LogIn, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Tenant } from '../utils/types';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { currentTenant, tenants, createTenant, deleteTenant, updateTenantPin, updateTenant, impersonateTenant, isImpersonating, originalTenant } = useTenant();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit modal state
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Only admin can access (or admin returning from impersonation)
  const canAccess = currentTenant?.isAdmin || (isImpersonating && originalTenant?.isAdmin);

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold text-white mb-2">Acceso Denegado</h1>
          <p className="text-gray-400">Solo el administrador puede acceder aquí.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    setError('');
    setSuccess('');

    if (!newName.trim()) {
      setError('Ingresa un nombre');
      return;
    }
    if (!newShopName.trim()) {
      setError('Ingresa un nombre de tienda');
      return;
    }
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    setIsCreating(true);
    const result = await createTenant(newName.trim(), newPin, newShopName.trim());
    setIsCreating(false);

    if (result.success) {
      setSuccess(`Usuario "${newName}" (${newShopName}) creado con PIN: ${newPin}`);
      setNewName('');
      setNewShopName('');
      setNewPin('');
      setShowCreateForm(false);
    } else {
      setError(result.error || 'Error al crear usuario');
    }
  };

  const handleDelete = async (pin: string, name: string) => {
    if (!confirm(`¿Eliminar usuario "${name}"? Sus datos NO se borrarán.`)) return;

    const success = await deleteTenant(pin);
    if (success) {
      setSuccess(`Usuario "${name}" eliminado`);
    } else {
      setError('No se pudo eliminar');
    }
  };

  const copyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditing = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.name);
    setEditShopName(tenant.shopName || '');
    setEditPin(''); // Don't show current PIN, leave empty for "no change"
    setError('');
  };

  const cancelEditing = () => {
    setEditingTenant(null);
    setEditName('');
    setEditShopName('');
    setEditPin('');
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingTenant) return;
    setError('');
    setIsSaving(true);

    try {
      // Update name/shopName if changed
      if (editName !== editingTenant.name || editShopName !== editingTenant.shopName) {
        await updateTenant(editingTenant.userId, {
          name: editName.trim() || editingTenant.name,
          shopName: editShopName.trim() || editingTenant.shopName
        });
      }

      // Update PIN if provided (not empty)
      if (editPin.length === 4) {
        const result = await updateTenantPin(editingTenant.userId, editPin);
        if (!result.success) {
          setError(result.error || 'Error al cambiar PIN');
          setIsSaving(false);
          return;
        }
      } else if (editPin.length > 0 && editPin.length < 4) {
        setError('El PIN debe tener 4 dígitos');
        setIsSaving(false);
        return;
      }

      setSuccess(`Usuario "${editName}" actualizado`);
      cancelEditing();
    } catch {
      setError('Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImpersonate = (tenant: Tenant) => {
    if (confirm(`¿Entrar como "${tenant.name}"? Verás su dashboard.`)) {
      impersonateTenant(tenant.userId);
      navigate('/');
    }
  };

  const nonAdminTenants = tenants.filter(t => !t.isAdmin);

  return (
    <div className="min-h-screen bg-[#0f111a] text-white">
      {/* Header */}
      <div className="bg-[#0a0d14] border-b border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users size={24} className="text-purple-400" />
              Panel de Administración
            </h1>
            <p className="text-sm text-gray-400">Gestiona los usuarios de la plataforma</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300">
            {success}
          </div>
        )}

        {/* Create User Button / Form */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full p-4 rounded-xl bg-purple-600 hover:bg-purple-500 flex items-center justify-center gap-2 font-bold transition-colors"
          >
            <UserPlus size={20} />
            Crear Nuevo Usuario
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-[#0a0d14] border border-gray-800 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <UserPlus size={20} className="text-purple-400" />
              Nuevo Usuario
            </h3>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Nombre del usuario</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Juan"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Nombre de la tienda</label>
              <input
                type="text"
                value={newShopName}
                onChange={e => setNewShopName(e.target.value)}
                placeholder="Ej: Adri Telecom"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">PIN (4 dígitos)</label>
              <input
                type="text"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 outline-none font-mono text-xl tracking-widest text-center"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewName('');
                  setNewShopName('');
                  setNewPin('');
                  setError('');
                }}
                className="flex-1 p-3 rounded-lg bg-gray-700 hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 p-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 font-bold"
              >
                {isCreating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-400 uppercase text-sm">Usuarios ({tenants.length})</h3>

          {/* Admin user */}
          {tenants.filter(t => t.isAdmin).map(tenant => (
            <div
              key={tenant.userId}
              className="p-4 rounded-xl bg-[#0a0d14] border border-purple-500/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-lg">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold flex items-center gap-2">
                      {tenant.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300">Admin</span>
                    </h4>
                    <p className="text-sm text-cyan-400">{tenant.shopName || 'Sin nombre de tienda'}</p>
                    <p className="text-xs text-gray-500">PIN: {tenant.pin ? '••••' : '(sin PIN)'}</p>
                  </div>
                </div>
                <button
                  onClick={() => copyUserId(tenant.userId)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
                  title="Copiar User ID"
                >
                  {copiedId === tenant.userId ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ))}

          {/* Other users */}
          {nonAdminTenants.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0a0d14] border border-gray-800 text-center text-gray-500">
              <Users size={40} className="mx-auto mb-2 opacity-50" />
              <p>No hay otros usuarios</p>
              <p className="text-sm">Crea uno para compartir la plataforma</p>
            </div>
          ) : (
            nonAdminTenants.map(tenant => (
              <div
                key={tenant.userId}
                className="p-4 rounded-xl bg-[#0a0d14] border border-gray-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center font-bold text-lg">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold">{tenant.name}</h4>
                      <p className="text-sm text-cyan-400">{tenant.shopName || 'Sin nombre de tienda'}</p>
                      <p className="text-xs text-gray-500">PIN: {tenant.pin}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleImpersonate(tenant)}
                      className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
                      title="Entrar como este usuario"
                    >
                      <LogIn size={16} />
                    </button>
                    <button
                      onClick={() => startEditing(tenant)}
                      className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                      title="Editar usuario"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => copyUserId(tenant.userId)}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
                      title="Copiar User ID"
                    >
                      {copiedId === tenant.userId ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.pin, tenant.name)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    Creado: {new Date(tenant.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-600 font-mono truncate">
                    ID: {tenant.userId}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cancelEditing} />
          <div className="relative bg-[#0f111a] border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pencil size={20} className="text-blue-400" />
                Editar Usuario
              </h3>
              <button onClick={cancelEditing} className="p-2 hover:bg-gray-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-400 block mb-1">Nombre del usuario</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Nombre de la tienda</label>
              <input
                type="text"
                value={editShopName}
                onChange={e => setEditShopName(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Nuevo PIN (dejar vacío para no cambiar)</label>
              <input
                type="text"
                value={editPin}
                onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none font-mono text-xl tracking-widest text-center"
              />
              <p className="text-xs text-gray-500 mt-1">PIN actual: {editingTenant.pin}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={cancelEditing}
                className="flex-1 p-3 rounded-lg bg-gray-700 hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 p-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 font-bold flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={16} /> Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
