import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';




import MainLayout from '@/layouts/MainLayout';



import Staff from '@/pages/Staff';
import Materials from '@/pages/Materials';
import Requisitions from '@/pages/Requisitions';
import Controls from '@/pages/Controls';
import Dashboard from '@/pages/Dashboard';
import Statistics from '@/pages/Statistics';
import Expediting from '@/pages/Expediting';
import Defective from '@/pages/Defective';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import { restoreSession } from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';
import PartSearchWidget from '@/components/PartSearchWidget';

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Restore an existing Firebase Authentication session (if any)
    restoreSession().then(setUser).finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>;
  }

  if (!user) {
    return <Login onSuccess={setUser} />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
