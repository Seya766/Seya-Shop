import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Check } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';

const ConnectionStatus = () => {
  const isOnline = useOnlineStatus();
  const { syncStatus } = useData();
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  useEffect(() => {
    if (wasOffline && isOnline && syncStatus === 'synced') {
      setShowSyncComplete(true);
      setWasOffline(false);
      const timer = setTimeout(() => setShowSyncComplete(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, syncStatus]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-b border-amber-700/50 overflow-hidden"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-amber-200 text-sm">
            <WifiOff size={16} />
            <span>Sin conexión — Los cambios se guardarán localmente</span>
          </div>
        </motion.div>
      )}

      {isOnline && syncStatus === 'syncing' && (
        <motion.div
          key="syncing"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-gradient-to-r from-blue-900/80 to-indigo-900/80 border-b border-blue-700/50 overflow-hidden"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-blue-200 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            <span>Sincronizando cambios...</span>
          </div>
        </motion.div>
      )}

      {showSyncComplete && (
        <motion.div
          key="synced"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-gradient-to-r from-emerald-900/80 to-green-900/80 border-b border-emerald-700/50 overflow-hidden"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-emerald-200 text-sm">
            <Check size={16} />
            <span>Todos los cambios sincronizados</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConnectionStatus;
