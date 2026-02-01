import { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectionStatusProps {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending';
}

const ConnectionStatus = ({ isOnline, syncStatus }: ConnectionStatusProps) => {
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const prevSyncRef = useRef(syncStatus);
  const wasOfflineRef = useRef(false);

  // Detectar cuando se restaura conexión y los datos se sincronizan
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    }
    if (prevSyncRef.current === 'syncing' && syncStatus === 'synced' && wasOfflineRef.current) {
      setShowSyncedToast(true);
      wasOfflineRef.current = false;
      const timer = setTimeout(() => setShowSyncedToast(false), 3000);
      return () => clearTimeout(timer);
    }
    prevSyncRef.current = syncStatus;
  }, [syncStatus, isOnline]);

  return (
    <AnimatePresence>
      {/* Banner de sin conexión */}
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-b border-amber-500/30 px-4 py-2.5">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-sm">
              <WifiOff size={14} className="text-amber-400 shrink-0" />
              <span className="text-amber-200 font-medium">
                Sin conexión
              </span>
              <span className="text-amber-300/70 hidden sm:inline">
                — Los cambios se guardan localmente y se sincronizarán al reconectar
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Indicador de sincronización */}
      {isOnline && syncStatus === 'syncing' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-900/80 to-indigo-900/80 border-b border-blue-500/30 px-4 py-2">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-sm">
              <RefreshCw size={14} className="text-blue-400 animate-spin" />
              <span className="text-blue-200 font-medium">Sincronizando cambios...</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Toast de sincronización completada */}
      {showSyncedToast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[300]"
        >
          <div className="bg-emerald-900/90 border border-emerald-500/40 rounded-xl px-4 py-2.5 shadow-lg shadow-emerald-500/20 flex items-center gap-2 backdrop-blur-sm">
            <div className="bg-emerald-500/20 p-1 rounded-full">
              <Check size={12} className="text-emerald-400" />
            </div>
            <span className="text-emerald-200 text-sm font-medium">Cambios sincronizados</span>
            <Wifi size={12} className="text-emerald-400" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConnectionStatus;
