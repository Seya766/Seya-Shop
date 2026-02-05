import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import type { Tenant } from '../utils/types';

const TENANTS_DOC = 'config/tenants';
const TENANT_STORAGE_KEY = 'seya-tenant';

// Default admin tenant (your original account)
const DEFAULT_ADMIN: Tenant = {
  pin: '', // Will be set on first login
  userId: 'T8lrzfd7vFfab9SXAgMjl1AIHv33',
  name: 'Admin',
  isAdmin: true,
  createdAt: '2024-01-01'
};

interface TenantContextType {
  loading: boolean;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  createTenant: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  deleteTenant: (pin: string) => Promise<boolean>;
  updateAdminPin: (newPin: string) => Promise<boolean>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);

  // Initialize Firebase auth and load tenants
  useEffect(() => {
    const init = async () => {
      try {
        // Ensure Firebase auth
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        // Load tenants from Firestore
        const tenantsRef = doc(db, TENANTS_DOC);
        const snap = await getDoc(tenantsRef);

        let loadedTenants: Tenant[] = [];

        if (snap.exists()) {
          loadedTenants = snap.data().tenants || [];
        } else {
          // First time: create with default admin (no PIN yet)
          loadedTenants = [DEFAULT_ADMIN];
          await setDoc(tenantsRef, { tenants: loadedTenants });
        }

        setTenants(loadedTenants);

        // Check if user was previously logged in
        const savedTenantPin = localStorage.getItem(TENANT_STORAGE_KEY);
        if (savedTenantPin) {
          const tenant = loadedTenants.find(t => t.pin === savedTenantPin);
          if (tenant) {
            setCurrentTenant(tenant);
          } else {
            localStorage.removeItem(TENANT_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Error loading tenants:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const saveTenants = async (newTenants: Tenant[]) => {
    const tenantsRef = doc(db, TENANTS_DOC);
    await setDoc(tenantsRef, { tenants: newTenants, updatedAt: new Date().toISOString() });
    setTenants(newTenants);
  };

  const login = useCallback(async (pin: string): Promise<boolean> => {
    // Special case: admin with no PIN set yet (first time setup)
    const adminNoPin = tenants.find(t => t.isAdmin && !t.pin);
    if (adminNoPin && tenants.length === 1) {
      // First time: set admin PIN
      const updatedAdmin = { ...adminNoPin, pin };
      await saveTenants([updatedAdmin]);
      setCurrentTenant(updatedAdmin);
      localStorage.setItem(TENANT_STORAGE_KEY, pin);
      return true;
    }

    // Normal login
    const tenant = tenants.find(t => t.pin === pin);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem(TENANT_STORAGE_KEY, pin);
      return true;
    }
    return false;
  }, [tenants]);

  const logout = useCallback(() => {
    setCurrentTenant(null);
    localStorage.removeItem(TENANT_STORAGE_KEY);
  }, []);

  const createTenant = useCallback(async (name: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    // Check if PIN already exists
    if (tenants.some(t => t.pin === pin)) {
      return { success: false, error: 'Este PIN ya está en uso' };
    }

    // Generate new userId
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newTenant: Tenant = {
      pin,
      userId: newUserId,
      name,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };

    const newTenants = [...tenants, newTenant];
    await saveTenants(newTenants);

    return { success: true };
  }, [tenants]);

  const deleteTenant = useCallback(async (pin: string): Promise<boolean> => {
    const tenant = tenants.find(t => t.pin === pin);
    if (!tenant || tenant.isAdmin) {
      return false; // Can't delete admin
    }

    const newTenants = tenants.filter(t => t.pin !== pin);
    await saveTenants(newTenants);
    return true;
  }, [tenants]);

  const updateAdminPin = useCallback(async (newPin: string): Promise<boolean> => {
    if (tenants.some(t => t.pin === newPin && !t.isAdmin)) {
      return false; // PIN already in use
    }

    const newTenants = tenants.map(t =>
      t.isAdmin ? { ...t, pin: newPin } : t
    );
    await saveTenants(newTenants);

    // Update current tenant if admin is logged in
    if (currentTenant?.isAdmin) {
      const updatedAdmin = newTenants.find(t => t.isAdmin);
      if (updatedAdmin) {
        setCurrentTenant(updatedAdmin);
        localStorage.setItem(TENANT_STORAGE_KEY, newPin);
      }
    }

    return true;
  }, [tenants, currentTenant]);

  return (
    <TenantContext.Provider value={{
      loading,
      currentTenant,
      tenants,
      login,
      logout,
      createTenant,
      deleteTenant,
      updateAdminPin
    }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
