import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { doc, setDoc, onSnapshot, writeBatch, waitForPendingWrites, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Factura, GastoFijo, Transaccion, MetaAhorro, PagoRevendedor, MetaFinanciera } from '../utils/types';
import { STORAGE_KEYS } from '../utils/constants';
import { getColombiaDateOnly } from '../utils/helpers';

// Admin user ID - all data is stored under this path for Firebase permissions
const ADMIN_USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';

// Helper to get the storage key with tenant prefix
const getTenantKey = (baseKey: string, tenantId: string) => {
  if (tenantId === ADMIN_USER_ID) {
    return baseKey;
  }
  return `${tenantId}_${baseKey}`;
};

// Función para corregir integridad de facturas (recalcular abonos desde historial)
const corregirIntegridadFacturas = (facturas: Factura[]): Factura[] => {
  return facturas.map(f => {
    const historial = f.historialAbonos || [];
    if (historial.length === 0) return f;

    const totalAbonado = historial.reduce((sum, h) => sum + (h.monto || 0), 0);
    const cobro = f.cobroCliente || 0;
    const abonoActual = f.abono || 0;

    if (totalAbonado > abonoActual) {
      return {
        ...f,
        abono: totalAbonado,
        cobradoACliente: totalAbonado >= cobro
      };
    }

    return f;
  });
};

interface DataContextType {
  loading: boolean;
  userId: string | null;
  facturas: Factura[];
  setFacturas: (value: Factura[] | ((prev: Factura[]) => Factura[])) => void;
  revendedoresOcultos: string[];
  setRevendedoresOcultos: (value: string[] | ((prev: string[]) => string[])) => void;
  pagosRevendedores: PagoRevendedor[];
  setPagosRevendedores: (value: PagoRevendedor[] | ((prev: PagoRevendedor[]) => PagoRevendedor[])) => void;
  gastosFijos: GastoFijo[];
  setGastosFijos: (value: GastoFijo[] | ((prev: GastoFijo[]) => GastoFijo[])) => void;
  transacciones: Transaccion[];
  setTransacciones: (value: Transaccion[] | ((prev: Transaccion[]) => Transaccion[])) => void;
  metaAhorro: MetaAhorro;
  setMetaAhorro: (value: MetaAhorro | ((prev: MetaAhorro) => MetaAhorro)) => void;
  metasFinancieras: MetaFinanciera[];
  setMetasFinancieras: (value: MetaFinanciera[] | ((prev: MetaFinanciera[]) => MetaFinanciera[])) => void;
  presupuestoMensual: number;
  setPresupuestoMensual: (value: number | ((prev: number) => number)) => void;
  facturasOcultas: number[];
  setFacturasOcultas: (value: number[] | ((prev: number[]) => number[])) => void;
  syncStatus: 'synced' | 'syncing' | 'pending';
  descargarBackup: () => void;
  importarBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_VALUES = {
  facturas: [] as Factura[],
  revendedoresOcultos: [] as string[],
  pagosRevendedores: [] as PagoRevendedor[],
  gastosFijos: [] as GastoFijo[],
  transacciones: [] as Transaccion[],
  metaAhorro: { monto: 500000, activa: true } as MetaAhorro,
  metasFinancieras: [] as MetaFinanciera[],
  presupuestoMensual: 2000000,
  facturasOcultas: [] as number[]
};

interface DataProviderProps {
  children: ReactNode;
  userId: string;
}

export const DataProvider = ({ children, userId }: DataProviderProps) => {
  const [loading, setLoading] = useState(true);

  const [facturas, setFacturasState] = useState<Factura[]>(DEFAULT_VALUES.facturas);
  const [revendedoresOcultos, setRevendedoresOcultosState] = useState<string[]>(DEFAULT_VALUES.revendedoresOcultos);
  const [pagosRevendedores, setPagosRevendedoresState] = useState<PagoRevendedor[]>(DEFAULT_VALUES.pagosRevendedores);
  const [gastosFijos, setGastosFijosState] = useState<GastoFijo[]>(DEFAULT_VALUES.gastosFijos);
  const [transacciones, setTransaccionesState] = useState<Transaccion[]>(DEFAULT_VALUES.transacciones);
  const [metaAhorro, setMetaAhorroState] = useState<MetaAhorro>(DEFAULT_VALUES.metaAhorro);
  const [metasFinancieras, setMetasFinancierasState] = useState<MetaFinanciera[]>(DEFAULT_VALUES.metasFinancieras);
  const [presupuestoMensual, setPresupuestoMensualState] = useState<number>(DEFAULT_VALUES.presupuestoMensual);
  const [facturasOcultas, setFacturasOcultasState] = useState<number[]>(DEFAULT_VALUES.facturasOcultas);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending'>('synced');

  // Track if we're receiving data from Firebase to avoid saving loops
  const isReceivingFromFirebase = useRef(false);
  // Track unsubscribe functions for cleanup
  const unsubscribesRef = useRef<(() => void)[]>([]);

  // Force Firebase to reconnect and sync fresh data
  const forceSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncStatus('syncing');
    try {
      // Temporarily disable and re-enable network to force fresh sync
      await disableNetwork(db);
      await enableNetwork(db);
      await waitForPendingWrites(db);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Force sync error:', err);
      setSyncStatus('pending');
    }
  }, []);

  // Sync when coming back online or when tab becomes visible
  useEffect(() => {
    const handleOnline = async () => {
      setSyncStatus('syncing');
      try {
        await enableNetwork(db);
        await waitForPendingWrites(db);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('pending');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // Force sync when user returns to the tab
        forceSync();
      }
    };

    const handleFocus = () => {
      if (navigator.onLine) {
        // Force sync when window gets focus
        forceSync();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [forceSync]);

  // Set up real-time listeners for all data
  useEffect(() => {
    if (!userId) return;

    let active = true;

    // Clean up any previous listeners immediately before re-subscribing
    unsubscribesRef.current.forEach(unsub => unsub());
    unsubscribesRef.current = [];

    // Defer subscription by one tick so Firebase can fully process the unsubscribes.
    // Without this delay, React StrictMode's rapid unmount→remount causes
    // "Target ID already exists" errors because onSnapshot re-registers before
    // the SDK has cleaned up the previous targets.
    const timerId = setTimeout(() => {
      if (!active) return;

      const setupListener = <T,>(
        key: string,
        setter: React.Dispatch<React.SetStateAction<T>>,
        defaultValue: T,
        transform?: (value: T) => T
      ) => {
        const tenantKey = getTenantKey(key, userId);
        const docRef = doc(db, 'users', ADMIN_USER_ID, 'data', tenantKey);

        // includeMetadataChanges ensures we get updates when data syncs from server
        const unsub = onSnapshot(docRef, { includeMetadataChanges: true }, (snap) => {
          if (!active) return;

          const fromCache = snap.metadata.fromCache;
          const hasPendingWrites = snap.metadata.hasPendingWrites;

          isReceivingFromFirebase.current = true;

          if (snap.exists()) {
            let value = snap.data().value as T;
            if (transform) {
              value = transform(value);
            }
            setter(value);
          } else {
            setter(defaultValue);
          }
          setLoading(false);

          if (hasPendingWrites) {
            setSyncStatus('syncing');
          } else if (!fromCache) {
            setSyncStatus('synced');
          }

          requestAnimationFrame(() => {
            isReceivingFromFirebase.current = false;
          });
        }, (error) => {
          console.error(`Error listening to ${key}:`, error);
          setLoading(false);
          setSyncStatus('pending');
        });

        unsubscribesRef.current.push(unsub);
      };

      setupListener(STORAGE_KEYS.FACTURAS, setFacturasState, DEFAULT_VALUES.facturas, corregirIntegridadFacturas);
      setupListener(STORAGE_KEYS.REVENDEDORES_OCULTOS, setRevendedoresOcultosState, DEFAULT_VALUES.revendedoresOcultos);
      setupListener(STORAGE_KEYS.PAGOS_REVENDEDORES, setPagosRevendedoresState, DEFAULT_VALUES.pagosRevendedores);
      setupListener(STORAGE_KEYS.GASTOS_FIJOS, setGastosFijosState, DEFAULT_VALUES.gastosFijos);
      setupListener(STORAGE_KEYS.TRANSACCIONES, setTransaccionesState, DEFAULT_VALUES.transacciones);
      setupListener(STORAGE_KEYS.META_AHORRO, setMetaAhorroState, DEFAULT_VALUES.metaAhorro);
      setupListener(STORAGE_KEYS.METAS_FINANCIERAS, setMetasFinancierasState, DEFAULT_VALUES.metasFinancieras);
      setupListener(STORAGE_KEYS.PRESUPUESTO, setPresupuestoMensualState, DEFAULT_VALUES.presupuestoMensual);
      setupListener(STORAGE_KEYS.FACTURAS_OCULTAS, setFacturasOcultasState, DEFAULT_VALUES.facturasOcultas);
    }, 0);

    return () => {
      active = false;
      clearTimeout(timerId);
      unsubscribesRef.current.forEach(unsub => unsub());
      unsubscribesRef.current = [];
    };
  }, [userId]);

  const saveToFirestore = useCallback(async (key: string, value: unknown) => {
    if (!userId) return;
    // Don't save if we just received this data from Firebase (prevents loops)
    if (isReceivingFromFirebase.current) return;

    setSyncStatus(navigator.onLine ? 'syncing' : 'pending');
    const tenantKey = userId === ADMIN_USER_ID ? key : `${userId}_${key}`;
    const docRef = doc(db, 'users', ADMIN_USER_ID, 'data', tenantKey);
    const payload = { value, updatedAt: new Date().toISOString() };

    // Retry up to 3 times with exponential backoff for transient Firebase errors
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await setDoc(docRef, payload);
        if (navigator.onLine) {
          setSyncStatus('synced');
        }
        return; // Success, exit
      } catch (error) {
        const isLastAttempt = attempt === 2;
        const errorMsg = error instanceof Error ? error.message : '';
        const isTransient = errorMsg.includes('stream token') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('network');

        if (isLastAttempt || !isTransient) {
          console.error(`Error guardando ${key}:`, error);
          setSyncStatus('pending');
          return;
        }
        // Wait before retrying: 500ms, 1500ms
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }, [userId]);

  // Helper: wraps a React state setter so that after computing the new value
  // it saves to Firestore OUTSIDE the state updater (avoids side-effects in
  // updater and race conditions with isReceivingFromFirebase).
  const pendingSavesRef = useRef<Array<{ key: string; value: unknown }>>([]);

  const createSetter = <T,>(
    rawSetter: React.Dispatch<React.SetStateAction<T>>,
    storageKey: string
  ) => {
    return (value: T | ((prev: T) => T)) => {
      rawSetter(prev => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        // Queue the save - will be flushed after state commit
        pendingSavesRef.current.push({ key: storageKey, value: newValue });
        return newValue;
      });
      // Schedule save after React has committed the state update
      queueMicrotask(() => {
        const saves = pendingSavesRef.current.splice(0);
        for (const { key, value: val } of saves) {
          saveToFirestore(key, val);
        }
      });
    };
  };

  const setFacturas = useCallback(
    createSetter(setFacturasState, STORAGE_KEYS.FACTURAS),
    [saveToFirestore]
  );

  const setRevendedoresOcultos = useCallback(
    createSetter(setRevendedoresOcultosState, STORAGE_KEYS.REVENDEDORES_OCULTOS),
    [saveToFirestore]
  );

  const setPagosRevendedores = useCallback(
    createSetter(setPagosRevendedoresState, STORAGE_KEYS.PAGOS_REVENDEDORES),
    [saveToFirestore]
  );

  const setGastosFijos = useCallback(
    createSetter(setGastosFijosState, STORAGE_KEYS.GASTOS_FIJOS),
    [saveToFirestore]
  );

  const setTransacciones = useCallback(
    createSetter(setTransaccionesState, STORAGE_KEYS.TRANSACCIONES),
    [saveToFirestore]
  );

  const setMetaAhorro = useCallback(
    createSetter(setMetaAhorroState, STORAGE_KEYS.META_AHORRO),
    [saveToFirestore]
  );

  const setMetasFinancieras = useCallback(
    createSetter(setMetasFinancierasState, STORAGE_KEYS.METAS_FINANCIERAS),
    [saveToFirestore]
  );

  const setPresupuestoMensual = useCallback(
    createSetter(setPresupuestoMensualState, STORAGE_KEYS.PRESUPUESTO),
    [saveToFirestore]
  );

  const setFacturasOcultas = useCallback(
    createSetter(setFacturasOcultasState, STORAGE_KEYS.FACTURAS_OCULTAS),
    [saveToFirestore]
  );

  const descargarBackup = () => {
    try {
      const backupData = {
        facturas, revendedoresOcultos, pagosRevendedores, gastosFijos, transacciones,
        metaAhorro, metasFinancieras, presupuestoMensual, facturasOcultas,
        fechaBackup: getColombiaDateOnly(), userId
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seya_shop_backup_${getColombiaDateOnly()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al crear backup:', error);
      alert('Error al crear la copia de seguridad');
    }
  };

  const importarBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        if (Array.isArray(json)) {
          if (window.confirm(`¿Restaurar ${json.length} facturas?`)) {
            setFacturas(json);
            alert("Facturas restauradas.");
          }
        } else if (json.facturas) {
          if (window.confirm(`¿Restaurar backup del ${json.fechaBackup || 'archivo'}?`)) {
            const batch = writeBatch(db);
            const updates = [
              { key: STORAGE_KEYS.FACTURAS, value: json.facturas || [] },
              { key: STORAGE_KEYS.REVENDEDORES_OCULTOS, value: json.revendedoresOcultos || [] },
              { key: STORAGE_KEYS.PAGOS_REVENDEDORES, value: json.pagosRevendedores || [] },
              { key: STORAGE_KEYS.GASTOS_FIJOS, value: json.gastosFijos || [] },
              { key: STORAGE_KEYS.TRANSACCIONES, value: json.transacciones || [] },
              { key: STORAGE_KEYS.META_AHORRO, value: json.metaAhorro || DEFAULT_VALUES.metaAhorro },
              { key: STORAGE_KEYS.METAS_FINANCIERAS, value: json.metasFinancieras || DEFAULT_VALUES.metasFinancieras },
              { key: STORAGE_KEYS.PRESUPUESTO, value: json.presupuestoMensual || DEFAULT_VALUES.presupuestoMensual },
              { key: STORAGE_KEYS.FACTURAS_OCULTAS, value: json.facturasOcultas || [] },
            ];

            updates.forEach(({ key, value }) => {
              // All data stored under ADMIN path, with tenant-specific key prefix
              const tenantKey = userId === ADMIN_USER_ID ? key : `${userId}_${key}`;
              const docRef = doc(db, 'users', ADMIN_USER_ID, 'data', tenantKey);
              batch.set(docRef, { value, updatedAt: new Date().toISOString() });
            });

            await batch.commit();

            setFacturasState(json.facturas || []);
            setRevendedoresOcultosState(json.revendedoresOcultos || []);
            setPagosRevendedoresState(json.pagosRevendedores || []);
            setGastosFijosState(json.gastosFijos || []);
            setTransaccionesState(json.transacciones || []);
            setMetaAhorroState(json.metaAhorro || DEFAULT_VALUES.metaAhorro);
            setMetasFinancierasState(json.metasFinancieras || DEFAULT_VALUES.metasFinancieras);
            setPresupuestoMensualState(json.presupuestoMensual || DEFAULT_VALUES.presupuestoMensual);
            setFacturasOcultasState(json.facturasOcultas || []);
            
            alert("Backup restaurado y sincronizado con Firebase.");
          }
        }
      } catch (error) { 
        console.error('Error al importar:', error);
        alert("Error al leer el archivo."); 
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <DataContext.Provider value={{
      loading, userId,
      facturas, setFacturas,
      revendedoresOcultos, setRevendedoresOcultos,
      pagosRevendedores, setPagosRevendedores,
      gastosFijos, setGastosFijos,
      transacciones, setTransacciones,
      metaAhorro, setMetaAhorro,
      metasFinancieras, setMetasFinancieras,
      presupuestoMensual, setPresupuestoMensual,
      facturasOcultas, setFacturasOcultas,
      syncStatus,
      descargarBackup, importarBackup,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
