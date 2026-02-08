import { Link, useLocation } from 'react-router-dom';
import { Zap, Store, Wallet, Bot, Settings, Download, Upload, X, User, Cloud, CloudOff, CheckCircle, Clock, Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';

interface NavbarProps {
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
  children?: React.ReactNode;
  syncStatus?: 'synced' | 'syncing' | 'pending';
}

const LAST_BACKUP_KEY = 'seya_last_backup';

const Navbar = ({ onBackup, onRestore, onToggleChat, chatOpen, children, syncStatus = 'synced' }: NavbarProps) => {
  const location = useLocation();
  const { currentTenant } = useTenant();
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isNegocio = location.pathname === '/' || location.pathname === '/negocio';
  const isFinanzas = location.pathname === '/finanzas';

  const shopName = currentTenant?.shopName || 'Seya Shop';
  const userName = currentTenant?.name || 'Usuario';

  // Load last backup date
  useEffect(() => {
    const saved = localStorage.getItem(LAST_BACKUP_KEY);
    if (saved) setLastBackup(saved);
  }, []);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMostrarMenu(false);
      }
    };

    if (mostrarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mostrarMenu]);

  // Handler para abrir el selector de archivos
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // Handler para cuando se selecciona un archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMostrarMenu(false);
    onRestore(e);
  };

  // Handler for backup with date tracking
  const handleBackup = () => {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, now);
    setLastBackup(now);
    setBackupSuccess(true);
    setTimeout(() => setBackupSuccess(false), 3000);
    onBackup();
  };

  // Format relative time
  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  // Check if backup is old (more than 7 days)
  const isBackupOld = lastBackup ? (new Date().getTime() - new Date(lastBackup).getTime()) > 7 * 24 * 60 * 60 * 1000 : true;

  return (
    <>
      {/* Input file FUERA del modal para que no se desmonte */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json"
      />

      <nav className="bg-[#161b2c]/80 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-[100] shadow-lg shadow-black/20">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow">
              <Zap className="text-white w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white leading-none truncate max-w-[140px] sm:max-w-none">{shopName}</h1>
              <span className="text-[9px] sm:text-[10px] text-purple-400 font-medium tracking-wide flex items-center gap-1">
                <User size={9} className="sm:w-[10px] sm:h-[10px]" /> {userName}
              </span>
            </div>
          </div>

          {/* Toggle de Navegación */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#0f111a]/80 backdrop-blur p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-gray-700/50">
            <Link
              to="/"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isNegocio
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Store size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Negocio</span>
            </Link>
            <Link
              to="/finanzas"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isFinanzas
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Wallet size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Finanzas</span>
            </Link>
            <button
              onClick={onToggleChat}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                chatOpen
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Bot size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">IA</span>
            </button>
          </div>

          {/* Área derecha (stats + settings) */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Stats específicos de cada página */}
            {children}

            {/* Menú de configuración */}
            <div className="relative">
              <button
                onClick={() => setMostrarMenu(!mostrarMenu)}
                className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl border transition-all relative ${
                  mostrarMenu
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Settings size={16} className={`sm:w-[18px] sm:h-[18px] ${mostrarMenu ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                {/* Warning dot if backup is old */}
                {isBackupOld && !mostrarMenu && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[#161b2c] animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Modal de Configuración - Fuera del nav para evitar problemas de z-index */}
      {mostrarMenu && (
        <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 pt-20">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMostrarMenu(false)}
          />

          {/* Panel de configuración - menuRef aquí para que los clicks dentro no cierren el menú */}
          <div
            ref={menuRef}
            className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 w-80 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Settings size={16} className="text-purple-400" />
                </div>
                <span className="font-bold text-white">Configuración</span>
              </div>
              <button
                onClick={() => setMostrarMenu(false)}
                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sync Status */}
            <div className="px-4 py-3 border-b border-gray-700/30 bg-gray-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {syncStatus === 'synced' ? (
                    <Cloud size={16} className="text-emerald-400" />
                  ) : syncStatus === 'syncing' ? (
                    <Cloud size={16} className="text-blue-400 animate-pulse" />
                  ) : (
                    <CloudOff size={16} className="text-amber-400" />
                  )}
                  <span className="text-sm text-gray-300">
                    {syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Sin conexión'}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  syncStatus === 'synced' ? 'bg-emerald-500/20 text-emerald-400' :
                  syncStatus === 'syncing' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {syncStatus === 'synced' ? 'OK' : syncStatus === 'syncing' ? '...' : 'Pendiente'}
                </span>
              </div>
            </div>

            {/* Backup Section */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Shield size={14} className="text-gray-500" />
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">Copias de Seguridad</span>
              </div>

              {/* Last backup info */}
              {lastBackup && (
                <div className={`mb-3 p-3 rounded-xl border ${isBackupOld ? 'bg-amber-900/10 border-amber-500/20' : 'bg-emerald-900/10 border-emerald-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isBackupOld ? (
                        <Clock size={14} className="text-amber-400" />
                      ) : (
                        <CheckCircle size={14} className="text-emerald-400" />
                      )}
                      <span className={`text-xs font-medium ${isBackupOld ? 'text-amber-300' : 'text-emerald-300'}`}>
                        Último backup
                      </span>
                    </div>
                    <span className={`text-xs ${isBackupOld ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatRelativeTime(lastBackup)}
                    </span>
                  </div>
                  {isBackupOld && (
                    <p className="text-[10px] text-amber-400/70 mt-1.5">
                      Recomendamos hacer backup semanal
                    </p>
                  )}
                </div>
              )}

              {/* Backup success message */}
              {backupSuccess && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/30 flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-sm text-emerald-300">Backup descargado</span>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleBackup}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm text-gray-300 hover:bg-emerald-900/30 hover:text-emerald-400 flex items-center gap-3 transition-all group border ${
                    isBackupOld ? 'border-amber-500/30 bg-amber-900/10' : 'border-transparent hover:border-emerald-500/30'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    isBackupOld ? 'bg-amber-500/20 group-hover:bg-emerald-500/30' : 'bg-emerald-500/20 group-hover:bg-emerald-500/30'
                  }`}>
                    <Download size={16} className={isBackupOld ? 'text-amber-400 group-hover:text-emerald-400' : 'text-emerald-400'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Descargar Backup</p>
                    <p className="text-xs text-gray-500">Guardar todos tus datos</p>
                  </div>
                  {isBackupOld && (
                    <span className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">
                      Recomendado
                    </span>
                  )}
                </button>

                <button
                  onClick={handleRestoreClick}
                  className="w-full text-left px-4 py-3.5 rounded-xl text-sm text-gray-300 hover:bg-blue-900/30 hover:text-blue-400 flex items-center gap-3 transition-all group border border-transparent hover:border-blue-500/30"
                >
                  <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                    <Upload size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">Restaurar Backup</p>
                    <p className="text-xs text-gray-500">Cargar archivo .json</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer info */}
            <div className="px-4 py-3 border-t border-gray-700/30 bg-gray-900/20">
              <p className="text-[10px] text-gray-500 text-center">
                Los datos se guardan automáticamente en la nube
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
