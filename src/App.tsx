import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import Navbar from './components/Navbar';
import ConnectionStatus from './components/ConnectionStatus';
import NegocioPage from './pages/NegocioPage';
import FinanzasPage from './pages/FinanzasPage';
import AsistentePage from './pages/AsistentePage';
import { LoadingScreen } from './components/LoadingScreen';

const AppContent = () => {
  const { descargarBackup, importarBackup, loading, isOnline, syncStatus } = useData();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
      <Navbar onBackup={descargarBackup} onRestore={importarBackup} />
      <ConnectionStatus isOnline={isOnline} syncStatus={syncStatus} />
      <Routes>
        <Route path="/" element={<NegocioPage />} />
        <Route path="/negocio" element={<NegocioPage />} />
        <Route path="/finanzas" element={<FinanzasPage />} />
        <Route path="/asistente" element={<AsistentePage />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </Router>
  );
};

export default App;