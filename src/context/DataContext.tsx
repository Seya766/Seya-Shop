import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { doc, setDoc, getDoc, writeBatch, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Factura, GastoFijo, Transaccion, MetaAhorro, PagoRevendedor, MetaFinanciera } from '../utils/types';
import { STORAGE_KEYS } from '../utils/constants';
import { getColombiaDateOnly } from '../utils/helpers';

// Admin user ID - all data is stored under this path for Firebase permissions
const ADMIN_USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';

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

  // Sync pending writes when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      setSyncStatus('syncing');
      try {
        await waitForPendingWrites(db);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('pending');
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadAllData(userId);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

  // Función para corregir integridad de facturas (recalcular abonos desde historial)
  const corregirIntegridadFacturas = (facturas: Factura[]): Factura[] => {
    return facturas.map(f => {
      const historial = f.historialAbonos || [];
      if (historial.length === 0) return f; // Sin historial = no tocar (pagos antiguos)
      
      // Recalcular abono desde historial
      const totalAbonado = historial.reduce((sum, h) => sum + (h.monto || 0), 0);
      const cobro = f.cobroCliente || 0;
      const abonoActual = f.abono || 0;
      
      // Solo corregir si el historial tiene MÁS que el campo abono
      // (no tocar si historial tiene menos, podría ser un pago parcial antiguo)
      if (totalAbonado > abonoActual) {
        console.log(`Corrigiendo factura ${f.cliente}: abono ${abonoActual} -> ${totalAbonado}`);
        return {
          ...f,
          abono: totalAbonado,
          cobradoACliente: totalAbonado >= cobro
        };
      }
      
      return f;
    });
  };

  // Helper to get the storage key with tenant prefix
  // All data stored under ADMIN_USER_ID path for Firebase permissions
  const getTenantKey = (baseKey: string, tenantId: string) => {
    // For admin, use the base key directly (backwards compatible)
    if (tenantId === ADMIN_USER_ID) {
      return baseKey;
    }
    // For other tenants, prefix with their ID
    return `${tenantId}_${baseKey}`;
  };

  const loadAllData = async (uid: string) => {
    const keys = [
      { key: STORAGE_KEYS.FACTURAS, setter: setFacturasState, corregir: true },
      { key: STORAGE_KEYS.REVENDEDORES_OCULTOS, setter: setRevendedoresOcultosState },
      { key: STORAGE_KEYS.PAGOS_REVENDEDORES, setter: setPagosRevendedoresState },
      { key: STORAGE_KEYS.GASTOS_FIJOS, setter: setGastosFijosState },
      { key: STORAGE_KEYS.TRANSACCIONES, setter: setTransaccionesState },
      { key: STORAGE_KEYS.META_AHORRO, setter: setMetaAhorroState },
      { key: STORAGE_KEYS.METAS_FINANCIERAS, setter: setMetasFinancierasState },
      { key: STORAGE_KEYS.PRESUPUESTO, setter: setPresupuestoMensualState },
      { key: STORAGE_KEYS.FACTURAS_OCULTAS, setter: setFacturasOcultasState },
    ];

    await Promise.all(
      keys.map(async ({ key, setter, corregir }) => {
        try {
          // All data stored under ADMIN path, with tenant-specific key prefix
          const tenantKey = getTenantKey(key, uid);
          const docRef = doc(db, 'users', ADMIN_USER_ID, 'data', tenantKey);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            let value = snapshot.data().value;
            // Corregir integridad de facturas si es necesario
            if (corregir && key === STORAGE_KEYS.FACTURAS && Array.isArray(value)) {
              value = corregirIntegridadFacturas(value);
            }
            setter(value);
          }
        } catch (error) {
          console.error(`Error cargando ${key}:`, error);
        }
      })
    );
  };

  const saveToFirestore = useCallback(async (key: string, value: unknown) => {
    if (!userId) return;
    setSyncStatus(navigator.onLine ? 'syncing' : 'pending');
    try {
      // All data stored under ADMIN path, with tenant-specific key prefix
      const tenantKey = userId === ADMIN_USER_ID ? key : `${userId}_${key}`;
      const docRef = doc(db, 'users', ADMIN_USER_ID, 'data', tenantKey);
      await setDoc(docRef, { value, updatedAt: new Date().toISOString() });
      if (navigator.onLine) {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error(`Error guardando ${key}:`, error);
      setSyncStatus('pending');
    }
  }, [userId]);

  const setFacturas = useCallback((value: Factura[] | ((prev: Factura[]) => Factura[])) => {
    setFacturasState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.FACTURAS, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setRevendedoresOcultos = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    setRevendedoresOcultosState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.REVENDEDORES_OCULTOS, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setPagosRevendedores = useCallback((value: PagoRevendedor[] | ((prev: PagoRevendedor[]) => PagoRevendedor[])) => {
    setPagosRevendedoresState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.PAGOS_REVENDEDORES, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setGastosFijos = useCallback((value: GastoFijo[] | ((prev: GastoFijo[]) => GastoFijo[])) => {
    setGastosFijosState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.GASTOS_FIJOS, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setTransacciones = useCallback((value: Transaccion[] | ((prev: Transaccion[]) => Transaccion[])) => {
    setTransaccionesState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.TRANSACCIONES, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setMetaAhorro = useCallback((value: MetaAhorro | ((prev: MetaAhorro) => MetaAhorro)) => {
    setMetaAhorroState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.META_AHORRO, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setMetasFinancieras = useCallback((value: MetaFinanciera[] | ((prev: MetaFinanciera[]) => MetaFinanciera[])) => {
    setMetasFinancierasState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.METAS_FINANCIERAS, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setPresupuestoMensual = useCallback((value: number | ((prev: number) => number)) => {
    setPresupuestoMensualState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.PRESUPUESTO, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

  const setFacturasOcultas = useCallback((value: number[] | ((prev: number[]) => number[])) => {
    setFacturasOcultasState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToFirestore(STORAGE_KEYS.FACTURAS_OCULTAS, newValue);
      return newValue;
    });
  }, [saveToFirestore]);

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
