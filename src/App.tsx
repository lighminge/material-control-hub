import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';



function ForceRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    // If it's a direct load and not on root, redirect to dashboard
    if (window.location.pathname !== '/' && window.location.pathname !== import.meta.env.BASE_URL) {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  return null;
}

import MainLayout from '@/layouts/MainLayout';
import { loginAnonymously } from '@/lib/firebase/config';



import Staff from '@/pages/Staff';
import Materials from '@/pages/Materials';
import Requisitions from '@/pages/Requisitions';
import Controls from '@/pages/Controls';
import Dashboard from '@/pages/Dashboard';
import Statistics from '@/pages/Statistics';
import Expediting from '@/pages/Expediting';
import Defective from '@/pages/Defective';
import PartSearchWidget from '@/components/PartSearchWidget';

function App() {
  useEffect(() => {
    // Attempt anonymous login on app startup
    loginAnonymously().catch(() => {
      console.error("Firebase is not fully configured yet. Please update config.ts");
    });
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ForceRedirect />
      <PartSearchWidget />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="staff" element={<Staff />} />
          <Route path="materials" element={<Materials />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="requisitions" element={<Requisitions />} />
          <Route path="controls" element={<Controls />} />
          <Route path="expediting" element={<Expediting />} />
          <Route path="defective" element={<Defective />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
