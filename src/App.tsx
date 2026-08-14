import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { loginAnonymously } from '@/lib/firebase/config';



import Staff from '@/pages/Staff';
import Materials from '@/pages/Materials';
import Requisitions from '@/pages/Requisitions';
import Controls from '@/pages/Controls';
import Dashboard from '@/pages/Dashboard';

function App() {
  useEffect(() => {
    // Attempt anonymous login on app startup
    loginAnonymously().catch(() => {
      console.error("Firebase is not fully configured yet. Please update config.ts");
    });
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="staff" element={<Staff />} />
          <Route path="materials" element={<Materials />} />
          <Route path="requisitions" element={<Requisitions />} />
          <Route path="controls" element={<Controls />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
