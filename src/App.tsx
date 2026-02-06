import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { TenantProvider, useTenant } from './context/TenantContext';
import { DataProvider, useData } from './context/DataContext';
import Navbar from './components/Navbar';
import ConnectionStatus from './components/ConnectionStatus';
import AIChatPanel from './components/AIChatPanel';
import NegocioPage from './pages/NegocioPage';
import FinanzasPage from './pages/FinanzasPage';
import ResellerPortal from './pages/ResellerPortal';
import AdminPanel from './pages/AdminPanel';
import PinLock from './components/PinLock';
import { LoadingScreen } from './components/LoadingScreen';
import { Settings, X, Eye } from 'lucide-react';

const AppContent = () => {
  const { descargarBackup, importarBackup, loading } = useData();
  const { currentTenant, isImpersonating, originalTenant, stopImpersonating } = useTenant();
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className={`min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-purple-500 selection:text-white ${isImpersonating ? 'pt-10' : ''}`}>
      {/* Impersonation Banner */}
      {isImpersonating && originalTenant && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span className="text-sm font-medium">
              Viendo como: <strong>{currentTenant?.name}</strong> ({currentTenant?.shopName})
            </span>
          </div>
          <button
            onClick={() => {
              stopImpersonating();
              navigate('/admin');
            }}
            className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            <X size={14} />
            Salir
          </button>
        </div>
      )}
      <Navbar
        onBackup={descargarBackup}
        onRestore={importarBackup}
        onToggleChat={() => setChatOpen(prev => !prev)}
        chatOpen={chatOpen}
      />
      {/* Admin button - only visible to admin */}
      {currentTenant?.isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="fixed bottom-4 left-4 z-40 p-3 rounded-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 transition-colors"
          title="Panel de Admin"
        >
          <Settings size={20} />
        </button>
      )}
      <ConnectionStatus />
      <Routes>
        <Route path="/" element={<NegocioPage />} />
        <Route path="/negocio" element={<NegocioPage />} />
        <Route path="/finanzas" element={<FinanzasPage />} />
      </Routes>
      <AIChatPanel isOpen={chatOpen} onToggle={() => setChatOpen(prev => !prev)} />
    </div>
  );
};

const AuthenticatedApp = () => {
  const { loading, currentTenant } = useTenant();
  const [isUnlocked, setIsUnlocked] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  // If not logged in, show PIN screen
  if (!currentTenant && !isUnlocked) {
    return <PinLock onUnlock={() => setIsUnlocked(true)} />;
  }

  // If we just unlocked, useTenant will have currentTenant set
  // If currentTenant is still null after unlock, something went wrong
  const tenant = currentTenant;
  if (!tenant) {
    return <PinLock onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <DataProvider userId={tenant.userId}>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </DataProvider>
  );
};

const App = () => {
  return (
    <Router>
      <TenantProvider>
        <Routes>
          {/* Public route for resellers - no auth needed */}
          <Route path="/v/:userId/:revendedor" element={<ResellerPortal />} />

          {/* All other routes require authentication */}
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </TenantProvider>
    </Router>
  );
};

export default App;
