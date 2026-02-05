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
import { Settings } from 'lucide-react';

const AppContent = () => {
  const { descargarBackup, importarBackup, loading } = useData();
  const { currentTenant } = useTenant();
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
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
