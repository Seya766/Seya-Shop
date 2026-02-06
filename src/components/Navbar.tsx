import { Link, useLocation } from 'react-router-dom';
import { Zap, Store, Wallet, Bot, Settings, Download, Upload, X, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';

interface NavbarProps {
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
  children?: React.ReactNode;
}

const Navbar = ({ onBackup, onRestore, onToggleChat, chatOpen, children }: NavbarProps) => {
  const location = useLocation();
  const { currentTenant } = useTenant();
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isNegocio = location.pathname === '/' || location.pathname === '/negocio';
  const isFinanzas = location.pathname === '/finanzas';

  const shopName = currentTenant?.shopName || 'Seya Shop';
  const userName = currentTenant?.name || 'Usuario';

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
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">{shopName}</h1>
              <span className="text-[10px] text-purple-400 font-medium tracking-wide flex items-center gap-1">
                <User size={10} /> {userName}
              </span>
            </div>
          </div>

          {/* Toggle de Navegación */}
          <div className="flex items-center gap-1 bg-[#0f111a]/80 backdrop-blur p-1 rounded-xl border border-gray-700/50">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isNegocio 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Store size={16} />
              <span className="hidden sm:inline">Negocio</span>
            </Link>
            <Link
              to="/finanzas"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isFinanzas
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Wallet size={16} />
              <span className="hidden sm:inline">Finanzas</span>
            </Link>
            <button
              onClick={onToggleChat}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                chatOpen
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Bot size={16} />
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
                className={`p-2.5 rounded-xl border transition-all ${
                  mostrarMenu 
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25' 
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Settings size={18} className={mostrarMenu ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
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
            className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 w-72 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
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

            {/* Opciones */}
            <div className="p-3 space-y-2">
              <button 
                onClick={() => {
                  console.log('Click en backup');
                  onBackup();
                }} 
                className="w-full text-left px-4 py-3.5 rounded-xl text-sm text-gray-300 hover:bg-emerald-900/30 hover:text-emerald-400 flex items-center gap-3 transition-all group border border-transparent hover:border-emerald-500/30"
              >
                <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                  <Download size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium">Copia de Seguridad</p>
                  <p className="text-xs text-gray-500">Descargar datos</p>
                </div>
              </button>
              
              <button 
                onClick={handleRestoreClick} 
                className="w-full text-left px-4 py-3.5 rounded-xl text-sm text-gray-300 hover:bg-blue-900/30 hover:text-blue-400 flex items-center gap-3 transition-all group border border-transparent hover:border-blue-500/30"
              >
                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                  <Upload size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Restaurar Datos</p>
                  <p className="text-xs text-gray-500">Cargar archivo .json</p>
                </div>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;