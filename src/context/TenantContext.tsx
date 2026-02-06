import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import type { Tenant } from '../utils/types';

// Store tenants under admin's data path (which has Firebase permissions)
const ADMIN_USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';
const TENANTS_KEY = 'seyaShop_tenants';
const TENANT_STORAGE_KEY = 'seya-tenant';

// Default admin tenant (your original account)
const DEFAULT_ADMIN: Tenant = {
  pin: '', // Will be set on first login
  userId: ADMIN_USER_ID,
  name: 'Admin',
  shopName: 'Seya Shop',
  isAdmin: true,
  createdAt: '2024-01-01'
};

interface TenantContextType {
  loading: boolean;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  isImpersonating: boolean;
  originalTenant: Tenant | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  createTenant: (name: string, pin: string, shopName: string) => Promise<{ success: boolean; error?: string }>;
  deleteTenant: (pin: string) => Promise<boolean>;
  updateAdminPin: (newPin: string) => Promise<boolean>;
  updateTenantPin: (userId: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  updateTenant: (userId: string, updates: Partial<Pick<Tenant, 'name' | 'shopName'>>) => Promise<boolean>;
  impersonateTenant: (userId: string) => void;
  stopImpersonating: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalTenant, setOriginalTenant] = useState<Tenant | null>(null);

  // Initialize Firebase auth and load tenants
  useEffect(() => {
    const init = async () => {
      try {
        // Ensure Firebase auth
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        // Load tenants from Firestore (stored under admin user's data)
        const tenantsRef = doc(db, 'users', ADMIN_USER_ID, 'data', TENANTS_KEY);
        const snap = await getDoc(tenantsRef);

        let loadedTenants: Tenant[] = [];

        if (snap.exists()) {
          loadedTenants = snap.data().value || [];
        } else {
          // First time: create with default admin (no PIN yet)
          loadedTenants = [DEFAULT_ADMIN];
          await setDoc(tenantsRef, { value: loadedTenants, updatedAt: new Date().toISOString() });
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
    const tenantsRef = doc(db, 'users', ADMIN_USER_ID, 'data', TENANTS_KEY);
    await setDoc(tenantsRef, { value: newTenants, updatedAt: new Date().toISOString() });
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

  const createTenant = useCallback(async (name: string, pin: string, shopName: string): Promise<{ success: boolean; error?: string }> => {
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
      shopName,
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

  const updateTenantPin = useCallback(async (userId: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    // Check if PIN already exists
    if (tenants.some(t => t.pin === newPin)) {
      return { success: false, error: 'Este PIN ya está en uso' };
    }

    const newTenants = tenants.map(t =>
      t.userId === userId ? { ...t, pin: newPin } : t
    );
    await saveTenants(newTenants);
    return { success: true };
  }, [tenants]);

  const updateTenant = useCallback(async (userId: string, updates: Partial<Pick<Tenant, 'name' | 'shopName'>>): Promise<boolean> => {
    const newTenants = tenants.map(t =>
      t.userId === userId ? { ...t, ...updates } : t
    );
    await saveTenants(newTenants);
    return true;
  }, [tenants]);

  const impersonateTenant = useCallback((userId: string) => {
    const tenant = tenants.find(t => t.userId === userId);
    if (tenant && currentTenant) {
      // Save original tenant for returning later
      setOriginalTenant(currentTenant);
      setIsImpersonating(true);
      setCurrentTenant(tenant);
      // Don't save to localStorage - we want to restore on page refresh
    }
  }, [tenants, currentTenant]);

  const stopImpersonating = useCallback(() => {
    if (originalTenant) {
      setCurrentTenant(originalTenant);
      setIsImpersonating(false);
      setOriginalTenant(null);
    }
  }, [originalTenant]);

  return (
    <TenantContext.Provider value={{
      loading,
      currentTenant,
      tenants,
      isImpersonating,
      originalTenant,
      login,
      logout,
      createTenant,
      deleteTenant,
      updateAdminPin,
      updateTenantPin,
      updateTenant,
      impersonateTenant,
      stopImpersonating
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
